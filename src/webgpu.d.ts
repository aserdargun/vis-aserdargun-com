/**
 * Minimal WebGPU surface.
 *
 * The bundled DOM lib does not ship these yet, and pulling `@webgpu/types` in
 * would add a dependency for a handful of interfaces the engine already uses by
 * name. Only what the engine touches is declared; the shapes follow the spec.
 */

interface GPUObjectBase {
  label: string;
}

interface GPUAdapterInfo {
  readonly vendor: string;
  readonly architecture: string;
  readonly device: string;
  readonly description: string;
}

interface GPUAdapter {
  readonly isFallbackAdapter: boolean;
  readonly info: GPUAdapterInfo;
  requestDevice(descriptor?: Record<string, unknown>): Promise<GPUDevice>;
}

interface GPU {
  requestAdapter(options?: Record<string, unknown>): Promise<GPUAdapter | null>;
}

interface GPUDevice extends GPUObjectBase {
  queue: GPUQueue;
  createShaderModule(descriptor: { code: string; label?: string }): GPUShaderModule;
  createComputePipeline(descriptor: Record<string, unknown>): GPUComputePipeline;
  createBuffer(descriptor: { size: number; usage: number; label?: string }): GPUBuffer;
  createBindGroup(descriptor: Record<string, unknown>): GPUBindGroup;
  createCommandEncoder(): GPUCommandEncoder;
}

interface GPUQueue extends GPUObjectBase {
  // ArrayBufferView rather than BufferSource: a plain `Float32Array` is typed
  // as possibly SharedArrayBuffer-backed in modern lib definitions, and the
  // GPU copy path accepts either at runtime.
  writeBuffer(buffer: GPUBuffer, offset: number, data: ArrayBufferView): void;
  submit(commands: GPUCommandBuffer[]): void;
}

interface GPUShaderModule extends GPUObjectBase {
  getCompilationInfo?(): Promise<{ messages: { type: string; message: string }[] }>;
}

interface GPUComputePipeline extends GPUObjectBase {
  getBindGroupLayout(index: number): GPUBindGroupLayout;
}

type GPUBindGroupLayout = GPUObjectBase;

type GPUBindGroup = GPUObjectBase;

interface GPUBuffer extends GPUObjectBase {
  mapAsync(mode: number): Promise<void>;
  getMappedRange(): ArrayBuffer;
  unmap(): void;
  destroy(): void;
}

type GPUCommandBuffer = GPUObjectBase;

interface GPUCommandEncoder extends GPUObjectBase {
  beginComputePass(): GPUComputePassEncoder;
  copyBufferToBuffer(
    source: GPUBuffer,
    sourceOffset: number,
    destination: GPUBuffer,
    destinationOffset: number,
    size: number,
  ): void;
  finish(): GPUCommandBuffer;
}

interface GPUComputePassEncoder {
  setPipeline(pipeline: GPUComputePipeline): void;
  setBindGroup(index: number, bindGroup: GPUBindGroup): void;
  dispatchWorkgroups(x: number, y?: number, z?: number): void;
  end(): void;
}

interface GPUBufferBinding {
  binding: number;
  resource: { buffer: GPUBuffer };
}

interface GPUBindGroupEntry {
  binding: number;
  resource: GPUBufferBinding['resource'] | { buffer: GPUBuffer };
}

interface GPUMapMode {
  READ: number;
  WRITE: number;
}

interface GPUBufferUsage {
  MAP_READ: number;
  MAP_WRITE: number;
  COPY_SRC: number;
  COPY_DST: number;
  INDEX: number;
  VERTEX: number;
  UNIFORM: number;
  STORAGE: number;
  INDIRECT: number;
  QUERY_RESOLVE: number;
}

declare const GPUBufferUsage: GPUBufferUsage;
declare const GPUMapMode: GPUMapMode;

interface Navigator {
  readonly gpu?: GPU;
}
