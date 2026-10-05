export type Lang = 'tr' | 'en';
export type Text = { tr: string; en: string };

/** Single-channel f32 raster. Every operator in the laboratory speaks this type. */
export interface Tensor {
  readonly w: number;
  readonly h: number;
  readonly data: Float32Array;
}

export function tensor(w: number, h: number, fill = 0): Tensor {
  return { w, h, data: new Float32Array(w * h).fill(fill) };
}

export function like(src: Tensor, fill = 0): Tensor {
  return tensor(src.w, src.h, fill);
}

export function at(src: Tensor, x: number, y: number): number {
  return src.data[y * src.w + x]!;
}

export function set(t: Tensor, x: number, y: number, v: number): void {
  if (x < 0 || y < 0 || x >= t.w || y >= t.h) return;
  t.data[y * t.w + x] = v;
}

/** Clamped read — the CPU and GPU paths must agree on out-of-range behaviour. */
export function atClamped(src: Tensor, x: number, y: number): number {
  const cx = x < 0 ? 0 : x >= src.w ? src.w - 1 : x;
  const cy = y < 0 ? 0 : y >= src.h ? src.h - 1 : y;
  return src.data[cy * src.w + cx]!;
}

/** Content copy. `like` allocates zeros; use this when the contents must carry over. */
export function clone(src: Tensor): Tensor {
  const out = tensor(src.w, src.h);
  out.data.set(src.data);
  return out;
}

// ---------------------------------------------------------------------------
// Synthetic scene + ground truth
// ---------------------------------------------------------------------------

export type ShapeKind = 'rect' | 'disc' | 'triangle';

export interface SceneObject {
  readonly id: string;
  readonly shape: ShapeKind;
  /** Normalised class id; 0 is background. */
  readonly label: number;
  readonly cx: number;
  readonly cy: number;
  /** Half extents in pixels. */
  readonly rx: number;
  readonly ry: number;
  readonly tone: number;
  readonly bbox: { x: number; y: number; w: number; h: number };
}

export interface Scene {
  readonly seed: number;
  readonly w: number;
  readonly h: number;
  readonly objects: SceneObject[];
  /** Per-pixel class id — the measured answer key. */
  readonly truth: Tensor;
  /** Rendered luminance, values in [0,1]. */
  readonly image: Tensor;
  /** Per-pixel object index, -1 for background. */
  readonly owner: Int32Array;
}

// ---------------------------------------------------------------------------
// Engine contract
// ---------------------------------------------------------------------------

export type EngineId = 'cpu' | 'webgpu';

export interface OpDescriptor {
  readonly name: string;
  /** Ops the GPU path is allowed to answer with different float rounding. */
  readonly tolerant: boolean;
}

export interface VisionEngine {
  readonly id: EngineId;
  /** Human-readable, honest adapter description shown in the interface. */
  readonly describe: string;
  readonly ops: readonly string[];
  has(op: string): boolean;
  run(op: string, input: Tensor, params?: Record<string, number>): Promise<Tensor>;
}

export interface EngineReport {
  readonly id: EngineId;
  readonly describe: string;
  readonly secureContext: boolean;
  readonly navigatorGpu: boolean;
  readonly adapter: boolean;
  readonly fallbackAdapter: boolean;
  readonly vendor: string;
  readonly architecture: string;
  readonly detail: Text;
}
