import { createRng } from './rng.ts';
import type { Scene, SceneObject, ShapeKind } from './types.ts';
import { tensor } from './types.ts';

/**
 * Shape coverage test in pixel space. All three shapes are expressed as signed
 * tests so a single painter loop can fill the visible raster and the answer key
 * from exactly the same geometry.
 */
function covers(shape: ShapeKind, x: number, y: number, o: SceneObject): boolean {
  const dx = x - o.cx;
  const dy = y - o.cy;
  if (shape === 'rect') return Math.abs(dx) <= o.rx && Math.abs(dy) <= o.ry;
  if (shape === 'disc') return dx * dx + dy * dy <= o.rx * o.ry;
  // Isosceles triangle pointing up, apex at the top of the bounding box.
  const t = (y - (o.cy - o.ry)) / (2 * o.ry);
  if (t < 0 || t > 1) return false;
  const half = o.rx * t;
  return Math.abs(dx) <= half;
}

export interface SceneOptions {
  readonly seed: number;
  readonly w?: number;
  readonly h?: number;
  readonly objectCount?: number;
  readonly noise?: number;
}

/**
 * Builds a synthetic scene together with its answer key.
 *
 * The visible raster and the per-pixel class map are produced in one painting
 * pass, so the truth can never drift from the picture. That is the whole point:
 * a measured number here is a measurement, not an estimate.
 */
export function buildScene(options: SceneOptions): Scene {
  const w = options.w ?? 160;
  const h = options.h ?? 120;
  const objectCount = options.objectCount ?? 4;
  const noise = options.noise ?? 0.02;
  const rng = createRng(options.seed);

  const shapes: ShapeKind[] = ['rect', 'disc', 'triangle'];
  const objects: SceneObject[] = [];
  // Rejection sampling with a real separation gap. Overlapping objects make the
  // answer key ambiguous — one silhouette hides another — and a detector cannot
  // be scored against a key that disagrees with itself.
  // Circular separation radius, not a Manhattan sum: a disc of radius r and a
  // triangle of the same radius can still intersect on the diagonal, and the
  // rejection test has to be conservative enough to rule that out.
  const margin = 6;
  for (let i = 0; i < objectCount; i += 1) {
    let placed = false;
    for (let attempt = 0; attempt < 80 && !placed; attempt += 1) {
      const rx = rng.int(10, 20);
      const ry = rng.int(10, 18);
      // Objects stand on the lower two thirds — the "floor" of the scene.
      const cx = rng.int(rx + 2, w - rx - 2);
      const cy = rng.int(Math.floor(h * 0.34) + ry, h - ry - 4);
      const reach = Math.hypot(rx, ry) + margin;
      const clear = objects.every((o) => Math.hypot(o.cx - cx, o.cy - cy) > reach + Math.hypot(o.rx, o.ry));
      if (!clear) continue;
      const x0 = Math.max(0, cx - rx);
      const y0 = Math.max(0, cy - ry);
      objects.push({
        id: `obj-${i + 1}`,
        shape: rng.pick(shapes),
        label: i + 1,
        cx,
        cy,
        rx,
        ry,
        tone: rng.float(0.62, 0.98),
        bbox: { x: x0, y: y0, w: Math.min(w - 1, cx + rx) - x0, h: Math.min(h - 1, cy + ry) - y0 },
      });
      placed = true;
    }
  }

  const image = tensor(w, h);
  const truth = tensor(w, h);
  const owner = new Int32Array(w * h).fill(-1);
  const horizon = Math.floor(h * 0.3);

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      // Sky above the horizon is bright; the floor darkens toward the camera.
      let v = y < horizon ? 0.82 - (y / horizon) * 0.12 : 0.5 - ((y - horizon) / (h - horizon)) * 0.22;
      // Soft lateral gradient so the background is not flat.
      v += 0.05 * Math.sin((x / w) * Math.PI);
      // The horizon itself is a contrast step, and an edge detector's threshold
      // is set by the strongest gradient in the frame. Left at full strength it
      // would become the only detected edge and drown every object boundary, so
      // the two regions are blended across a few rows.
      if (Math.abs(y - horizon) <= 2) {
        const t = 1 - Math.abs(y - horizon) / 3;
        v = v * (1 - 0.55 * t) + (y < horizon ? 0.8 : 0.5) * (0.55 * t);
      }
      image.data[i] = v;
      truth.data[i] = 0;
    }
  }

  // Paint objects back-to-front; the last one drawn owns the pixel.
  for (let k = 0; k < objects.length; k += 1) {
    const o = objects[k]!;
    for (let y = o.cy - o.ry - 2; y <= o.cy + o.ry + 2; y += 1) {
      if (y < 0 || y >= h) continue;
      for (let x = o.cx - o.rx - 2; x <= o.cx + o.rx + 2; x += 1) {
        if (x < 0 || x >= w) continue;
        if (!covers(o.shape, x, y, o)) continue;
        const i = y * w + x;
        // Cast shadow first: a dimmed floor patch offset down-right of the
        // object. The object body then paints over it, so the shadow survives
        // only where the silhouette does not cover — as it should.
        if (y > o.cy + o.ry * 0.4 && x > o.cx + o.rx * 0.4) {
          image.data[i] = Math.max(0, image.data[i]! - 0.12);
        }
        if (owner[i] === -1) owner[i] = k;
        // Simple directional lighting: brighter towards the top of the shape.
        const lift = 1 - ((y - (o.cy - o.ry)) / (2 * o.ry)) * 0.35;
        image.data[i] = Math.min(1, o.tone * lift);
        truth.data[i] = o.label;
        owner[i] = k;
      }
    }
  }

  // Deterministic sensor noise, applied last so it perturbs the picture but
  // never the answer key.
  for (let i = 0; i < image.data.length; i += 1) {
    image.data[i] = Math.min(1, Math.max(0, image.data[i]! + (rng.next() - 0.5) * noise));
  }

  return { seed: options.seed, w, h, objects, truth, image, owner };
}

/** Counts of each class present in the answer key, background included. */
export function classCounts(scene: Scene): Map<number, number> {
  const counts = new Map<number, number>();
  for (const v of scene.truth.data) counts.set(v, (counts.get(v) ?? 0) + 1);
  return counts;
}
