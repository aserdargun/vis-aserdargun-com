import { matchComponents } from './ops.ts';
import type { Component } from './ops.ts';
import type { Scene, Tensor } from './types.ts';

export interface Scalar {
  readonly value: number;
  /** What the number means, so a reader cannot mistake it for something else. */
  readonly note: string;
}

export interface DetectionReport {
  readonly predicted: number;
  readonly truth: number;
  readonly matched: number;
  readonly precision: number;
  readonly recall: number;
  readonly meanIou: number;
  readonly falsePositives: number;
  readonly falseNegatives: number;
}

const fmt = (v: number): number => Math.round(v * 10000) / 10000;

/** Pixel intersection over union between a predicted binary mask and a truth. */
export function maskIou(pred: Tensor, truth: Tensor): number {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < pred.data.length; i += 1) {
    const p = pred.data[i]! >= 0.5;
    const t = truth.data[i]! >= 0.5;
    if (p && t) inter += 1;
    if (p || t) union += 1;
  }
  return union === 0 ? 1 : inter / union;
}

export function pixelAccuracy(pred: Tensor, truth: Tensor): number {
  let hit = 0;
  for (let i = 0; i < pred.data.length; i += 1) {
    if ((pred.data[i]! >= 0.5) === (truth.data[i]! >= 0.5)) hit += 1;
  }
  return pred.data.length === 0 ? 1 : hit / pred.data.length;
}

export function meanAbsoluteError(pred: Tensor, truth: Tensor): number {
  let sum = 0;
  for (let i = 0; i < pred.data.length; i += 1) sum += Math.abs(pred.data[i]! - truth.data[i]!);
  return pred.data.length === 0 ? 0 : sum / pred.data.length;
}

/** Edge recall against the answer key: did the detector find the real borders? */
export function edgeRecall(pred: Tensor, scene: Scene): number {
  let truthEdge = 0;
  let hit = 0;
  for (let y = 0; y < scene.h; y += 1) {
    for (let x = 0; x < scene.w; x += 1) {
      const c = scene.truth.data[y * scene.w + x]!;
      if (x + 1 >= scene.w || y + 1 >= scene.h) continue;
      const right = scene.truth.data[y * scene.w + x + 1]!;
      const down = scene.truth.data[(y + 1) * scene.w + x]!;
      if (c === right && c === down) continue;
      truthEdge += 1;
      if (
        pred.data[y * scene.w + x]! >= 0.5 ||
        pred.data[y * scene.w + Math.min(scene.w - 1, x + 1)]! >= 0.5 ||
        pred.data[Math.min(scene.h - 1, y + 1) * scene.w + x]! >= 0.5
      ) {
        hit += 1;
      }
    }
  }
  return truthEdge === 0 ? 1 : hit / truthEdge;
}

/** Ground-truth regions taken directly from the answer key's per-pixel classes. */
export function truthComponents(scene: Scene): Component[] {
  const groups = new Map<number, { xs: number[]; ys: number[] }>();
  for (let y = 0; y < scene.h; y += 1) {
    for (let x = 0; x < scene.w; x += 1) {
      const label = scene.truth.data[y * scene.w + x]!;
      if (label === 0) continue;
      const g = groups.get(label) ?? { xs: [], ys: [] };
      g.xs.push(x);
      g.ys.push(y);
      groups.set(label, g);
    }
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, g]) => {
      const minX = Math.min(...g.xs);
      const maxX = Math.max(...g.xs);
      const minY = Math.min(...g.ys);
      const maxY = Math.max(...g.ys);
      return {
        id,
        area: g.xs.length,
        bbox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
        centroid: {
          x: g.xs.reduce((a, b) => a + b, 0) / g.xs.length,
          y: g.ys.reduce((a, b) => a + b, 0) / g.ys.length,
        },
      };
    });
}

export function detectReport(predicted: Component[], truth: Component[], iouThreshold = 0.3): DetectionReport {
  const m = matchComponents(predicted, truth, iouThreshold);
  const precision = predicted.length === 0 ? (truth.length === 0 ? 1 : 0) : m.pairs.length / predicted.length;
  const recall = truth.length === 0 ? 1 : m.pairs.length / truth.length;
  const meanIou = m.pairs.length === 0 ? 0 : m.pairs.reduce((a, p) => a + p.iou, 0) / m.pairs.length;
  return {
    predicted: predicted.length,
    truth: truth.length,
    matched: m.pairs.length,
    precision: fmt(precision),
    recall: fmt(recall),
    meanIou: fmt(meanIou),
    falsePositives: m.unmatchedPredicted.length,
    falseNegatives: m.unmatchedTruth.length,
  };
}

/** Per-class pixel agreement — shows which object types survive which pipeline. */
export function perClassIoU(pred: Tensor, scene: Scene): { label: number; iou: number; pixels: number }[] {
  const out: { label: number; iou: number; pixels: number }[] = [];
  for (const o of scene.objects) {
    let inter = 0;
    let union = 0;
    let pixels = 0;
    for (let i = 0; i < pred.data.length; i += 1) {
      const t = scene.truth.data[i]! === o.label;
      if (t) pixels += 1;
      const p = pred.data[i]! >= 0.5;
      if (p && t) inter += 1;
      if (p || t) union += 1;
    }
    out.push({ label: o.label, iou: union === 0 ? 1 : fmt(inter / union), pixels });
  }
  return out;
}
