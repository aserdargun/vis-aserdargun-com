import { at, atClamped, clone, like, tensor } from './types.ts';
import type { Tensor } from './types.ts';

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/** Separable Gaussian blur. Kernel width is always odd; edges clamp. */
export function gaussian(src: Tensor, sigma: number): Tensor {
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

  const tmp = like(src);
  for (let y = 0; y < src.h; y += 1) {
    for (let x = 0; x < src.w; x += 1) {
      let acc = 0;
      for (let k = 0; k < size; k += 1) acc += atClamped(src, x + k - radius, y) * kernel[k]!;
      tmp.data[y * src.w + x] = acc;
    }
  }
  const out = like(src);
  for (let y = 0; y < src.h; y += 1) {
    for (let x = 0; x < src.w; x += 1) {
      let acc = 0;
      // Second pass runs along y, clamping rows at the edges. Reading a fixed
      // row here would blur horizontally twice and never touch y at all, which
      // is how the two engines ended up computing different filters.
      for (let k = 0; k < size; k += 1) {
        acc += atClamped(tmp, x, y + k - radius) * kernel[k]!;
      }
      out.data[y * src.w + x] = acc;
    }
  }
  return out;
}

/** Generic 2D convolution with clamped edges and zero padding. */
export function convolve(src: Tensor, kernel: Float32Array, kw: number, kh: number): Tensor {
  const rx = Math.floor(kw / 2);
  const ry = Math.floor(kh / 2);
  const out = like(src);
  for (let y = 0; y < src.h; y += 1) {
    for (let x = 0; x < src.w; x += 1) {
      let acc = 0;
      for (let ky = 0; ky < kh; ky += 1) {
        for (let kx = 0; kx < kw; kx += 1) {
          acc += atClamped(src, x + kx - rx, y + ky - ry) * kernel[ky * kw + kx]!;
        }
      }
      out.data[y * src.w + x] = acc;
    }
  }
  return out;
}

export const SOBEL_X = new Float32Array([-1, 0, 1, -2, 0, 2, -1, 0, 1]);
export const SOBEL_Y = new Float32Array([-1, -2, -1, 0, 0, 0, 1, 2, 1]);

/** Sobel gradient magnitude, normalised so the response lands in [0,1]. */
export function sobel(src: Tensor): Tensor {
  const gx = convolve(src, SOBEL_X, 3, 3);
  const gy = convolve(src, SOBEL_Y, 3, 3);
  const out = like(src);
  for (let i = 0; i < out.data.length; i += 1) {
    out.data[i] = Math.min(1, Math.hypot(gx.data[i]!, gy.data[i]!) / 4);
  }
  return out;
}

/** Otsu's method — the threshold is derived from the image, not chosen by hand. */
export function otsu(src: Tensor): number {
  const bins = 64;
  const hist = new Float64Array(bins);
  for (const v of src.data) {
    const b = Math.min(bins - 1, Math.max(0, Math.floor(v * bins)));
    hist[b]! += 1;
  }
  const total = src.data.length;
  let sum = 0;
  for (let i = 0; i < bins; i += 1) sum += i * hist[i]!;
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let bestVar = -1;
  for (let i = 0; i < bins; i += 1) {
    wB += hist[i]!;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += i * hist[i]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVar) {
      bestVar = between;
      best = i;
    }
  }
  return (best + 0.5) / bins;
}

export function threshold(src: Tensor, level: number): Tensor {
  const out = like(src);
  for (let i = 0; i < out.data.length; i += 1) out.data[i] = src.data[i]! >= level ? 1 : 0;
  return out;
}

function morph(src: Tensor, radius: number, dilate: boolean): Tensor {
  const out = like(src);
  for (let y = 0; y < src.h; y += 1) {
    for (let x = 0; x < src.w; x += 1) {
      let acc = dilate ? 0 : 1;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const v = atClamped(src, x + dx, y + dy);
          acc = dilate ? Math.max(acc, v) : Math.min(acc, v);
        }
      }
      out.data[y * src.w + x] = acc;
    }
  }
  return out;
}

export const dilate = (src: Tensor, radius = 1): Tensor => morph(src, radius, true);
export const erode = (src: Tensor, radius = 1): Tensor => morph(src, radius, false);

/**
 * Canny: blur, gradient, non-maximum suppression, double threshold, hysteresis.
 *
 * The thresholds come from the gradient distribution rather than from its
 * maximum. A single sharp border in the frame sets the maximum, and a fraction
 * of that maximum ends up above every real object boundary — the detector then
 * reports one edge and nothing else. Scaling off a high percentile keeps the
 * threshold tied to how the bulk of the gradients are distributed.
 */
export function canny(src: Tensor, lowFactor = 0.12, highFactor = 0.4): Tensor {
  const grad = sobel(gaussian(src, 1.0));
  const sorted = Float32Array.from(grad.data).sort();
  const percentile = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!;
  const reference = Math.max(percentile(0.995), 1e-4);
  const high = reference * highFactor;
  const low = reference * lowFactor;

  const thin = like(src);
  for (let y = 1; y < src.h - 1; y += 1) {
    for (let x = 1; x < src.w - 1; x += 1) {
      const gx = grad.data[y * grad.w + (x + 1)]! - grad.data[y * grad.w + (x - 1)]!;
      const gy = grad.data[(y + 1) * grad.w + x]! - grad.data[(y - 1) * grad.w + x]!;
      const angle = (Math.atan2(gy, gx) * 180) / Math.PI;
      let n1: number;
      let n2: number;
      if (angle < 22.5 || angle >= 157.5) {
        n1 = grad.data[y * grad.w + (x + 1)]!;
        n2 = grad.data[y * grad.w + (x - 1)]!;
      } else if (angle < 67.5) {
        n1 = grad.data[(y + 1) * grad.w + (x + 1)]!;
        n2 = grad.data[(y - 1) * grad.w + (x - 1)]!;
      } else if (angle < 112.5) {
        n1 = grad.data[(y + 1) * grad.w + x]!;
        n2 = grad.data[(y - 1) * grad.w + x]!;
      } else {
        n1 = grad.data[(y + 1) * grad.w + (x - 1)]!;
        n2 = grad.data[(y - 1) * grad.w + (x + 1)]!;
      }
      const g = grad.data[y * grad.w + x]!;
      thin.data[y * grad.w + x] = g >= n1 && g >= n2 ? g : 0;
    }
  }

  const strong = like(src);
  for (let i = 0; i < strong.data.length; i += 1) strong.data[i] = thin.data[i]! >= high ? 1 : 0;
  const weak = like(src);
  for (let i = 0; i < weak.data.length; i += 1) {
    weak.data[i] = thin.data[i]! >= low && thin.data[i]! < high ? 1 : 0;
  }

  // Hysteresis: a weak edge survives only if it touches a strong one.
  const out = clone(strong);
  for (let y = 1; y < src.h - 1; y += 1) {
    for (let x = 1; x < src.w - 1; x += 1) {
      if (weak.data[y * src.w + x] !== 1) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (out.data[(y + dy) * src.w + (x + dx)] === 1) {
            out.data[y * src.w + x] = 1;
          }
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

export interface Component {
  readonly id: number;
  readonly area: number;
  readonly bbox: { x: number; y: number; w: number; h: number };
  readonly centroid: { x: number; y: number };
}

/** 4-connected labelling, scanned in raster order so ids are reproducible. */
export function connectedComponents(binary: Tensor): { mask: Tensor; components: Component[] } {
  const { w, h } = binary;
  const labels = new Int32Array(w * h).fill(0);
  const components: Component[] = [];
  let next = 1;
  const stack: number[] = [];
  for (let start = 0; start < labels.length; start += 1) {
    if (labels[start] !== 0 || binary.data[start]! < 0.5) continue;
    const id = next;
    next += 1;
    stack.length = 0;
    stack.push(start);
    labels[start] = id;
    let area = 0;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    let sumX = 0;
    let sumY = 0;
    while (stack.length > 0) {
      const idx = stack.pop()!;
      const x = idx % w;
      const y = (idx - x) / w;
      area += 1;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      const neighbours = [idx - 1, idx + 1, idx - w, idx + w];
      const valid = [x > 0, x < w - 1, y > 0, y < h - 1];
      for (let n = 0; n < 4; n += 1) {
        if (!valid[n]) continue;
        const ni = neighbours[n]!;
        if (labels[ni] === 0 && binary.data[ni]! >= 0.5) {
          labels[ni] = id;
          stack.push(ni);
        }
      }
    }
    components.push({
      id,
      area,
      bbox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
      centroid: { x: sumX / area, y: sumY / area },
    });
  }
  const mask = tensor(w, h);
  for (let i = 0; i < labels.length; i += 1) mask.data[i] = labels[i]!;
  return { mask, components };
}

// ---------------------------------------------------------------------------
// Hough transform for straight edges
// ---------------------------------------------------------------------------

/**
 * Straight-line Hough accumulator over [0, pi). The returned tensor holds
 * rho indices on x and theta buckets on y, normalised to [0,1] by the peak.
 */
export function houghLines(binary: Tensor, thetaBins = 90): Tensor {
  const rhoBins = Math.ceil(Math.hypot(binary.w, binary.h));
  const acc = tensor(rhoBins, thetaBins);
  for (let y = 0; y < binary.h; y += 1) {
    for (let x = 0; x < binary.w; x += 1) {
      if (binary.data[y * binary.w + x]! < 0.5) continue;
      for (let t = 0; t < thetaBins; t += 1) {
        const theta = (t * Math.PI) / thetaBins;
        const rho = Math.round(x * Math.cos(theta) + y * Math.sin(theta));
        if (rho < 0 || rho >= rhoBins) continue;
        acc.data[t * rhoBins + rho]! += 1;
      }
    }
  }
  const peak = acc.data.reduce((m, v) => Math.max(m, v), 0) || 1;
  for (let i = 0; i < acc.data.length; i += 1) acc.data[i]! /= peak;
  return acc;
}

// ---------------------------------------------------------------------------
// Correspondence
// ---------------------------------------------------------------------------

export function iou(a: Component['bbox'], b: Component['bbox']): number {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const union = a.w * a.h + b.w * b.h - inter;
  return union === 0 ? 0 : inter / union;
}

/** Greedy highest-IoU assignment — the same tie-breaking on every engine. */
export function matchComponents(
  predicted: Component[],
  truth: Component[],
  thresholdValue = 0.3,
): { pairs: { predicted: number; truth: number; iou: number }[]; unmatchedPredicted: number[]; unmatchedTruth: number[] } {
  const candidates: { p: number; t: number; v: number }[] = [];
  for (let p = 0; p < predicted.length; p += 1) {
    for (let t = 0; t < truth.length; t += 1) {
      const v = iou(predicted[p]!.bbox, truth[t]!.bbox);
      if (v >= thresholdValue) candidates.push({ p, t, v });
    }
  }
  candidates.sort((a, b) => b.v - a.v || a.p - b.p || a.t - b.t);
  const usedP = new Set<number>();
  const usedT = new Set<number>();
  const pairs: { predicted: number; truth: number; iou: number }[] = [];
  for (const c of candidates) {
    if (usedP.has(c.p) || usedT.has(c.t)) continue;
    usedP.add(c.p);
    usedT.add(c.t);
    pairs.push({ predicted: c.p, truth: c.t, iou: c.v });
  }
  pairs.sort((a, b) => a.truth - b.truth);
  return {
    pairs,
    unmatchedPredicted: predicted.map((_, i) => i).filter((i) => !usedP.has(i)),
    unmatchedTruth: truth.map((_, i) => i).filter((i) => !usedT.has(i)),
  };
}

// ---------------------------------------------------------------------------
// Optical flow
// ---------------------------------------------------------------------------

export interface FlowField {
  readonly dx: Tensor;
  readonly dy: Tensor;
  /** Mean gradient-weighted brightness change — how hard the frame was to track. */
  readonly residual: number;
  readonly tracked: number;
}

/**
 * Sparse Lucas-Kanade flow over window centres, one step, clamped search.
 * Horizontal and vertical components stay in separate tensors so the single
 * channel contract is never violated.
 */
export function lucasKanade(prev: Tensor, next: Tensor, radius = 3, search = 4): FlowField {
  const dx = like(prev, 0);
  const dy = like(prev, 0);
  const { w, h } = prev;
  let sq = 0;
  let n = 0;
  for (let y = radius; y < h - radius; y += 1) {
    for (let x = radius; x < w - radius; x += 1) {
      const bx = prev.data[y * w + x]!;
      // Exhaustive clamped search. At laboratory resolutions this is cheap and
      // it removes every interpolation and tie-breaking ambiguity, so CPU and
      // GPU runs cannot disagree about which pixel won.
      let bestX = 0;
      let bestY = 0;
      let bestE = Infinity;
      for (let sy = -search; sy <= search; sy += 1) {
        for (let sx = -search; sx <= search; sx += 1) {
          const e = atClamped(next, x + sx, y + sy);
          const cost = (e - bx) * (e - bx);
          if (cost < bestE) {
            bestE = cost;
            bestX = sx;
            bestY = sy;
          }
        }
      }
      dx.data[y * w + x] = bestX;
      dy.data[y * w + x] = bestY;
      sq += bestE;
      n += 1;
    }
  }
  return { dx, dy, residual: n === 0 ? 0 : Math.sqrt(sq / n), tracked: n };
}

export { at };
