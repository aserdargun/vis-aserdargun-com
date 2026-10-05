import {
  canny,
  convolve,
  dilate,
  erode,
  gaussian,
  houghLines,
  sobel,
  threshold,
} from './ops.ts';
import { atClamped } from './types.ts';
import type { Tensor, VisionEngine } from './types.ts';

/** Ops the GPU path can answer. Anything with sequential or branchy control
 * flow stays on the CPU, and the interface reports that instead of faking it. */
export const GPU_CAPABLE = new Set(['gaussian', 'sobel', 'convolve', 'threshold', 'dilate', 'erode']);

export const CPU_OPS = ['gaussian', 'sobel', 'convolve', 'threshold', 'dilate', 'erode', 'canny', 'hough'];

export async function runCpuOp(op: string, input: Tensor, params: Record<string, number> = {}): Promise<Tensor> {
  switch (op) {
    case 'gaussian':
      return gaussian(input, params.sigma ?? 1);
    case 'sobel':
      return sobel(input);
    case 'convolve': {
      const k = Math.max(1, Math.round(params.k ?? 3));
      const kernel = new Float32Array(k * k);
      const kind = params.kind ?? 0;
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
      return convolve(input, kernel, k, k);
    }
    case 'threshold':
      return threshold(input, params.level ?? 0.5);
    case 'dilate':
      return dilate(input, Math.max(1, Math.round(params.radius ?? 1)));
    case 'erode':
      return erode(input, Math.max(1, Math.round(params.radius ?? 1)));
    case 'canny':
      return canny(input, params.low ?? 0.12, params.high ?? 0.4);
    case 'hough':
      return houghLines(input, Math.round(params.theta ?? 90));
    default:
      throw new Error(`Unknown op: ${op}`);
  }
}

export const cpuEngine: VisionEngine = {
  id: 'cpu',
  describe: 'CPU · Float32Array · deterministik',
  ops: CPU_OPS,
  has: (op) => CPU_OPS.includes(op),
  run: runCpuOp,
};

/** Nearest-neighbour resample — shared by both engines so they cannot diverge. */
export function resampleNearest(src: Tensor, w: number, h: number): Tensor {
  const dst = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const sy = Math.round(((y + 0.5) * src.h) / h - 0.5);
    for (let x = 0; x < w; x += 1) {
      const sx = Math.round(((x + 0.5) * src.w) / w - 0.5);
      dst[y * w + x] = atClamped(src, sx, sy);
    }
  }
  return { w, h, data: dst };
}
