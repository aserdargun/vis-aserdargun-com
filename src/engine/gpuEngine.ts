import { GPU_CAPABLE, runCpuOp } from './cpuEngine.ts';
import { SOBEL_X, SOBEL_Y } from './ops.ts';
import { SHADER_CONVOLVE, SHADER_MORPHOLOGY, SHADER_SOBEL_MAGNITUDE, SHADER_THRESHOLD } from './gpuShaders.ts';
import type { EngineId, Tensor, VisionEngine } from './types.ts';

/**
 * WebGPU engine.
 *
 * It implements only the ops that map cleanly onto a data-parallel kernel. The
 * rest — Canny's hysteresis, connected-component labelling, Hough accumulation
 * and the flow search — keep their sequential structure and are answered by the
 * CPU path. `has()` reports that honestly instead of silently falling back.
 */

export interface GpuProbe {
  readonly secureContext: boolean;
  readonly navigatorGpu: boolean;
  readonly adapter: boolean;
  readonly fallbackAdapter: boolean;
  readonly vendor: string;
  readonly architecture: string;
  readonly error?: string;
}

export async function probeWebGpu(): Promise<GpuProbe> {
  const secureContext = typeof window !== 'undefined' && window.isSecureContext;
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { gpu?: GPU }).gpu : undefined;
  if (!nav) {
    return {
      secureContext,
      navigatorGpu: false,
      adapter: false,
      fallbackAdapter: false,
      vendor: '',
      architecture: '',
      error: secureContext
        ? 'navigator.gpu is undefined: this browser does not expose WebGPU here.'
        : 'Not a secure context: WebGPU requires https or localhost.',
    };
  }
  try {
    const adapter = await nav.requestAdapter();
    if (!adapter) {
      return {
        secureContext,
        navigatorGpu: true,
        adapter: false,
        fallbackAdapter: false,
        vendor: '',
        architecture: '',
        // The silent-failure case. navigator.gpu exists, so a capability check
        // would pass, yet no adapter is available and every kernel would write
        // into nothing.
        error: 'requestAdapter() returned null: navigator.gpu exists but no adapter was granted.',
      };
    }
    const info = adapter.info;
    return {
      secureContext,
      navigatorGpu: true,
      adapter: true,
      fallbackAdapter: adapter.isFallbackAdapter,
      vendor: info?.vendor ?? '',
      architecture: info?.architecture ?? '',
    };
  } catch (error) {
    return {
      secureContext,
      navigatorGpu: true,
      adapter: false,
      fallbackAdapter: false,
      vendor: '',
      architecture: '',
      error: String(error),
    };
  }
}

const UNIFORM_WORDS = 8;

export class WebGpuEngine implements VisionEngine {
  readonly id: EngineId = 'webgpu';
  readonly describe: string;
  private readonly device: GPUDevice;
  private readonly pipelines = new Map<string, GPUComputePipeline>();

  private constructor(device: GPUDevice, describe: string) {
    this.device = device;
    this.describe = describe;
  }

  static async create(): Promise<WebGpuEngine | null> {
    const probe = await probeWebGpu();
    if (!probe.adapter) return null;
    const nav = (navigator as Navigator & { gpu: GPU }).gpu;
    const adapter = await nav.requestAdapter();
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    const adapterInfo = adapter.info;
    const name = adapterInfo?.architecture || adapterInfo?.vendor || 'webgpu';
    const fallback = adapter.isFallbackAdapter ? ' · fallback adapter' : '';
    return new WebGpuEngine(device, `WebGPU · ${name}${fallback}`);
  }

  get ops(): string[] {
    return [...GPU_CAPABLE];
  }

  has(op: string): boolean {
    return GPU_CAPABLE.has(op);
  }

  private pipeline(key: string, code: string, entryPoint = 'main'): GPUComputePipeline {
    const cached = this.pipelines.get(key);
    if (cached) return cached;
    const module = this.device.createShaderModule({ code });
    const pipeline = this.device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint } });
    this.pipelines.set(key, pipeline);
    return pipeline;
  }

  private storage(bytes: number): GPUBuffer {
    return this.device.createBuffer({
      size: bytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
  }

  private async dispatch(
    pipeline: GPUComputePipeline,
    buffers: GPUBuffer[],
    uniforms: Uint32Array,
    w: number,
    h: number,
  ): Promise<Float32Array> {
    const uniform = this.device.createBuffer({
      size: UNIFORM_WORDS * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(uniform, 0, uniforms);
    const entries: GPUBindGroupEntry[] = buffers.map((buffer, i) => ({
      binding: i,
      resource: { buffer },
    }));
    entries.push({ binding: buffers.length, resource: { buffer: uniform } });
    const bind = this.device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries });
    const read = this.device.createBuffer({ size: w * h * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bind);
    pass.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8));
    pass.end();
    encoder.copyBufferToBuffer(buffers[buffers.length - 1]!, 0, read, 0, w * h * 4);
    this.device.queue.submit([encoder.finish()]);
    await read.mapAsync(GPUMapMode.READ);
    const out = new Float32Array(read.getMappedRange()).slice();
    read.unmap();
    read.destroy();
    uniform.destroy();
    return out;
  }

  private async upload(t: Tensor): Promise<GPUBuffer> {
    const buffer = this.storage(t.data.byteLength);
    this.device.queue.writeBuffer(buffer, 0, t.data);
    return buffer;
  }

  async run(op: string, input: Tensor, params: Record<string, number> = {}): Promise<Tensor> {
    switch (op) {
      case 'convolve': {
        const kernel = buildKernel(Math.max(1, Math.round(params.k ?? 3)), params.kind ?? 0);
        const k = Math.max(1, Math.round(params.k ?? 3));
        const pad = Math.floor(k / 2);
        const src = await this.upload(input);
        const kb = this.storage(kernel.byteLength);
        this.device.queue.writeBuffer(kb, 0, kernel);
        const dst = this.storage(input.data.byteLength);
        const u = new Uint32Array(UNIFORM_WORDS);
        u[0] = input.w;
        u[1] = input.h;
        u[2] = k;
        u[3] = k;
        u[4] = pad;
        u[5] = pad;
        const data = await this.dispatch(
          this.pipeline('convolve', SHADER_CONVOLVE),
          [src, kb, dst],
          u,
          input.w,
          input.h,
        );
        return { w: input.w, h: input.h, data };
      }
      case 'sobel': {
        // The two directional passes are genuinely 2D 3x3 kernels, not
        // separable 1D ones. A Sobel row is [-1,0,1] on one line and [-2,0,2]
        // on the next, so it cannot be expressed as a single 1D pass.
        const gxv = await this.convolveKernel(input, SOBEL_X, 3, 3, 1, 1);
        const gyv = await this.convolveKernel(input, SOBEL_Y, 3, 3, 1, 1);
        const gx = await this.upload(gxv);
        const gy = await this.upload(gyv);
        const dst = this.storage(input.data.byteLength);
        const u = new Uint32Array(UNIFORM_WORDS);
        u[0] = input.w;
        u[1] = input.h;
        const data = await this.dispatch(
          this.pipeline('sobel', SHADER_SOBEL_MAGNITUDE),
          [gx, gy, dst],
          u,
          input.w,
          input.h,
        );
        return { w: input.w, h: input.h, data };
      }
      case 'threshold': {
        const src = await this.upload(input);
        const dst = this.storage(input.data.byteLength);
        const u = new Uint32Array(UNIFORM_WORDS);
        u[0] = input.w;
        u[1] = input.h;
        u[2] = Math.round((params.level ?? 0.5) * 1000);
        const data = await this.dispatch(this.pipeline('threshold', SHADER_THRESHOLD), [src, dst], u, input.w, input.h);
        return { w: input.w, h: input.h, data };
      }
      case 'gaussian': {
        const sigma = params.sigma ?? 1;
        const radius = Math.max(1, Math.round(sigma * 2));
        const size = radius * 2 + 1;
        const kernel = new Float32Array(size);
        let sum = 0;
        for (let i = 0; i < size; i += 1) {
          const d = i - radius;
          const v = Math.exp(-(d * d) / (2 * sigma * sigma));
          kernel[i] = v;
          sum += v;
        }
        for (let i = 0; i < size; i += 1) kernel[i]! /= sum;
        const horizontal = await this.convolve1d(input, kernel, radius, 0);
        return this.convolve1d(horizontal, kernel, 0, radius);
      }
      case 'dilate':
      case 'erode': {
        // Rank filters: a 3x3 dilation is the max over the neighbourhood, and
        // erosion is the min. They are data-parallel, so the same kernel shape
        // applies with the reduction swapped.
        const radius = Math.max(1, Math.round(params.radius ?? 1));
        const size = radius * 2 + 1;
        const kernel = new Float32Array(size * size).fill(op === 'dilate' ? 0 : 1);
        const src = await this.upload(input);
        const kb = this.storage(kernel.byteLength);
        this.device.queue.writeBuffer(kb, 0, kernel);
        const dst = this.storage(input.data.byteLength);
        const u = new Uint32Array(UNIFORM_WORDS);
        u[0] = input.w;
        u[1] = input.h;
        u[2] = size;
        u[3] = size;
        u[4] = radius;
        u[5] = radius;
        const entry = op === 'dilate' ? 'main' : 'erodeMain';
        const data = await this.dispatch(
          this.pipeline(op, SHADER_MORPHOLOGY, entry),
          [src, kb, dst],
          u,
          input.w,
          input.h,
        );
        return { w: input.w, h: input.h, data };
      }
      default:
        throw new Error(`WebGPU engine cannot run "${op}"`);
    }
  }

  private async convolveKernel(
    input: Tensor,
    kernel: Float32Array,
    kw: number,
    kh: number,
    padX: number,
    padY: number,
  ): Promise<Tensor> {
    const src = await this.upload(input);
    const kb = this.storage(kernel.byteLength);
    this.device.queue.writeBuffer(kb, 0, kernel);
    const dst = this.storage(input.data.byteLength);
    const u = new Uint32Array(UNIFORM_WORDS);
    u[0] = input.w;
    u[1] = input.h;
    u[2] = kw;
    u[3] = kh;
    u[4] = padX;
    u[5] = padY;
    const data = await this.dispatch(this.pipeline('convolve', SHADER_CONVOLVE), [src, kb, dst], u, input.w, input.h);
    return { w: input.w, h: input.h, data };
  }

  private async convolve1d(input: Tensor, flat: Float32Array, padX: number, padY: number): Promise<Tensor> {
    const kw = padX > 0 ? flat.length : 1;
    const kh = padY > 0 ? flat.length : 1;
    const kernel = padX > 0 || padY > 0 ? flat : new Float32Array([1]);
    const src = await this.upload(input);
    const kb = this.storage(kernel.byteLength);
    this.device.queue.writeBuffer(kb, 0, kernel);
    const dst = this.storage(input.data.byteLength);
    const u = new Uint32Array(UNIFORM_WORDS);
    u[0] = input.w;
    u[1] = input.h;
    u[2] = kw;
    u[3] = kh;
    u[4] = padX;
    u[5] = padY;
    const data = await this.dispatch(this.pipeline('convolve', SHADER_CONVOLVE), [src, kb, dst], u, input.w, input.h);
    return { w: input.w, h: input.h, data };
  }
}

function buildKernel(k: number, kind: number): Float32Array {
  const kernel = new Float32Array(k * k);
  for (let y = 0; y < k; y += 1) {
    for (let x = 0; x < k; x += 1) {
      let v: number;
      if (kind === 1) v = x === Math.floor(k / 2) && y === Math.floor(k / 2) ? 1 : 0;
      else if (kind === 2) v = y === 0 ? -1 : y === k - 1 ? 1 : 0;
      else if (kind === 3) v = x === 0 ? -1 : x === k - 1 ? 1 : 0;
      else v = 1 / (k * k);
      kernel[y * k + x] = v;
    }
  }
  return kernel;
}

export { runCpuOp };
