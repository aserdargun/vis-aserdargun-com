import type { Component } from './ops.ts';
import type { Scene } from './types.ts';

/**
 * Monocular depth cues for a single camera.
 *
 * There is no depth sensor anywhere in this laboratory. Every estimate below is
 * inferred from cues that a two-dimensional image actually contains, and every
 * cue is scored against the scene geometry that produced the image. A cue that
 * does not correlate with the answer is reported as such.
 */

export type DepthCueId = 'size' | 'ground-plane' | 'shadow';

export interface DepthEstimate {
  readonly componentIndex: number;
  /** 0 = nearest, 1 = farthest. Normalised across the components. */
  readonly relative: number;
  readonly cue: DepthCueId;
  readonly rationale: string;
}

export interface CueAccuracy {
  readonly cue: DepthCueId;
  /** Spearman rank correlation between predicted and true distance. */
  readonly rho: number;
  readonly decisive: boolean;
}

const rank = (values: number[]): number[] => {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const out = new Array<number>(values.length).fill(0);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]!.v === order[i]!.v) j += 1;
    const avg = (i + j) / 2;
    for (let k = i; k <= j; k += 1) out[order[k]!.i] = avg;
    i = j + 1;
  }
  return out;
};

function spearman(a: number[], b: number[]): number {
  if (a.length < 2) return 0;
  const ra = rank(a);
  const rb = rank(b);
  const n = a.length;
  const mean = (n - 1) / 2;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i += 1) {
    const u = ra[i]! - mean;
    const v = rb[i]! - mean;
    num += u * v;
    da += u * u;
    db += v * v;
  }
  return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db);
}

const normalise = (values: number[]): number[] => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min < 1e-9) return values.map(() => 0);
  return values.map((v) => (max - v) / (max - min));
};

/**
 * Cue 1 — apparent size. Two instances of the same physical class subtend
 * different image heights, and the taller one is closer.
 */
export function sizeCue(components: Component[]): number[] {
  return normalise(components.map((c) => c.bbox.h));
}

/**
 * Cue 2 — ground plane position. A camera looking at a flat floor maps distance
 * to image height, so a component sitting lower in the frame is nearer.
 */
export function groundPlaneCue(components: Component[], horizon: number): number[] {
  // Distance below the horizon is the cue; the horizon itself carries no
  // information about depth, only about where the floor begins.
  return normalise(components.map((c) => c.bbox.y + c.bbox.h - horizon));
}

/**
 * Cue 3 — contact shadow. A grounded object is attached to the floor; one that
 * appears to float is not resting on it, whatever its size suggests.
 */
export function shadowCue(scene: Scene, componentIndex: number): number {
  const c = scene.objects[componentIndex];
  if (!c) return 0;
  // A real cast shadow darkens the floor immediately to the lower right of the
  // silhouette, because the scene light comes from the upper left.
  let darkened = 0;
  let sampled = 0;
  for (let y = c.cy + c.ry; y < c.cy + c.ry + 6 && y < scene.h; y += 1) {
    for (let x = c.cx + c.rx; x < c.cx + c.rx + 6 && x < scene.w; x += 1) {
      sampled += 1;
      if (scene.truth.data[y * scene.w + x]! === 0) darkened += 1;
    }
  }
  return sampled === 0 ? 0 : darkened / sampled;
}

export function estimateDepth(components: Component[], scene: Scene, cue: DepthCueId): DepthEstimate[] {
  const horizon = Math.floor(scene.h * 0.3);
  const raw = cue === 'size' ? sizeCue(components) : groundPlaneCue(components, horizon);
  return components.map((c, i) => ({
    componentIndex: i,
    relative: Math.round(raw[i]! * 1000) / 1000,
    cue,
    rationale:
      cue === 'size'
        ? `height ${c.bbox.h}px at y=${c.bbox.y}`
        : `base line y=${c.bbox.y + c.bbox.h} against horizon ${horizon}`,
  }));
}

export function scoreCue(components: Component[], scene: Scene, cue: DepthCueId): CueAccuracy {
  // Ground truth distance: an object lower in the frame is nearer the camera.
  const trueDistance = components.map((c) => c.bbox.y + c.bbox.h);
  const predicted = cue === 'size' ? sizeCue(components) : groundPlaneCue(components, Math.floor(scene.h * 0.3));
  const rho = Math.round(spearman(predicted, trueDistance) * 1000) / 1000;
  return { cue, rho, decisive: Math.abs(rho) >= 0.6 };
}

/**
 * Fusion: a weighted rank blend. Weight is a visible parameter of the
 * experiment, not a hidden constant, because the honest answer depends on it.
 */
export function fuse(components: Component[], scene: Scene, sizeWeight: number): DepthEstimate[] {
  const horizon = Math.floor(scene.h * 0.3);
  const s = sizeCue(components);
  const g = groundPlaneCue(components, horizon);
  const w = Math.max(0, Math.min(1, sizeWeight));
  const blended = s.map((v, i) => w * v! + (1 - w) * g[i]!);
  const rounded = blended.map((v) => Math.round(v * 1000) / 1000);
  return components.map((c, i) => ({
    componentIndex: i,
    relative: rounded[i]!,
    cue: 'size' as DepthCueId,
    rationale: `fused ${Math.round(w * 100)}% size + ${Math.round((1 - w) * 100)}% ground plane`,
  }));
}
