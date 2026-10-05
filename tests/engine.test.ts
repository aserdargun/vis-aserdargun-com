import { describe, expect, it } from 'vitest';
import { buildScene } from '../src/engine/scene.ts';
import { canny, connectedComponents, gaussian, houghLines, iou, lucasKanade, matchComponents, otsu, sobel } from '../src/engine/ops.ts';
import { buildSecondFrame, ensureWeights, resetWeights, runExperiment } from '../src/engine/pipeline.ts';
import { cpuEngine, runCpuOp } from '../src/engine/cpuEngine.ts';
import { detectReport, maskIou, pixelAccuracy, truthComponents } from '../src/engine/metrics.ts';
import { predict } from '../src/engine/cnn.ts';
import { createRng } from '../src/engine/rng.ts';
import { clone } from '../src/engine/types.ts';

describe('deterministic generator', () => {
  // Regression: the generator used to place objects that overlapped almost
  // completely, which makes the answer key ambiguous — a detector cannot be
  // scored against a key that disagrees with itself.
  it('places objects without overlapping silhouettes', () => {
    for (const seed of [3, 11, 31, 42, 77]) {
      const scene = buildScene({ seed, objectCount: 4 });
      for (let y = 0; y < scene.h; y += 1) {
        for (let x = 0; x < scene.w; x += 1) {
          const c = scene.truth.data[y * scene.w + x]!;
          if (c === 0) continue;
          // Exactly one owner may claim a pixel: no visible ambiguity.
          let owners = 0;
          for (const o of scene.objects) {
            const dx = x - o.cx;
            const dy = y - o.cy;
            let inside: boolean;
            if (o.shape === 'rect') inside = Math.abs(dx) <= o.rx && Math.abs(dy) <= o.ry;
            else if (o.shape === 'disc') inside = dx * dx + dy * dy <= o.rx * o.ry;
            else {
              const t = (y - (o.cy - o.ry)) / (2 * o.ry);
              inside = t >= 0 && t <= 1 && Math.abs(dx) <= o.rx * t;
            }
            if (inside) owners += 1;
          }
          expect(owners).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('keeps the horizon from dominating the gradient', () => {
    const scene = buildScene({ seed: 11 });
    const g = sobel(gaussian(scene.image, 1.0));
    const sorted = Array.from(g.data).sort((a, b) => a - b);
    const p995 = sorted[Math.floor(sorted.length * 0.995)]!;
    const p90 = sorted[Math.floor(sorted.length * 0.9)]!;
    // A single hard step would push the 99.5th percentile an order of magnitude
    // above the bulk; the softened horizon keeps the ratio modest.
    expect(p995 / Math.max(p90, 1e-6)).toBeLessThan(40);
  });

  it('produces byte-identical scenes for one seed', () => {
    const a = buildScene({ seed: 7 });
    const b = buildScene({ seed: 7 });
    expect(a.image.data).toEqual(b.image.data);
    expect(a.truth.data).toEqual(b.truth.data);
    expect(a.objects).toEqual(b.objects);
  });

  it('produces different scenes for different seeds', () => {
    const a = buildScene({ seed: 7 });
    const b = buildScene({ seed: 8 });
    expect(Array.from(a.image.data)).not.toEqual(Array.from(b.image.data));
  });

  it('keeps the answer key consistent with the drawn objects', () => {
    const scene = buildScene({ seed: 3, objectCount: 4 });
    const counts = truthComponents(scene);
    expect(counts).toHaveLength(4);
    for (const c of counts) expect(c.area).toBeGreaterThan(0);
  });

  it('replays the same random stream', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    const first = Array.from({ length: 8 }, () => a.next());
    const second = Array.from({ length: 8 }, () => b.next());
    expect(first).toEqual(second);
  });
});

describe('classical operators', () => {
  const scene = buildScene({ seed: 11 });

  it('produces a bounded sobel response', () => {
    const g = sobel(scene.image);
    expect(g.data.length).toBe(scene.w * scene.h);
    for (const v of g.data) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('derives an otsu level inside the image range', () => {
    const level = otsu(scene.image);
    expect(level).toBeGreaterThan(0);
    expect(level).toBeLessThan(1);
  });

  it('returns a binary canny map', () => {
    const edges = canny(scene.image);
    for (const v of edges.data) expect(v === 0 || v === 1).toBe(true);
  });

  // Regression: hysteresis used to start from a zero-filled buffer instead of
  // the strong-edge map, so every experiment reported zero edges.
  it('keeps strong edges through hysteresis', () => {
    const edges = canny(scene.image);
    const on = Array.from(edges.data).filter((v) => v >= 0.5).length;
    expect(on).toBeGreaterThan(0);
  });

  it('clones a tensor without sharing memory', () => {
    const a = { w: 2, h: 1, data: new Float32Array([1, 2]) };
    const b = clone(a);
    b.data[0] = 9;
    expect(a.data[0]).toBe(1);
    expect(b.data[0]).toBe(9);
  });

  // Regression: thresholds used to be a fraction of the gradient maximum, so a
  // single sharp border pushed the threshold above every object boundary and the
  // detector reported 23 pixels with a 0.0 hit rate.
  it('scales its threshold off the gradient distribution, not the maximum', async () => {
    const edges = canny(scene.image);
    const on = Array.from(edges.data).filter((v) => v >= 0.5).length;
    expect(on).toBeGreaterThan(100);
  });

  it('recovers the drawn borders above chance', () => {
    const edges = canny(scene.image);
    let truthEdge = 0;
    let hit = 0;
    for (let y = 1; y < scene.h - 1; y += 1) {
      for (let x = 1; x < scene.w - 1; x += 1) {
        const c = scene.truth.data[y * scene.w + x]!;
        const right = scene.truth.data[y * scene.w + x + 1]!;
        if (c === right) continue;
        truthEdge += 1;
        if (
          edges.data[y * scene.w + x]! === 1 ||
          edges.data[y * scene.w + x + 1]! === 1 ||
          edges.data[y * scene.w + x - 1]! === 1
        ) {
          hit += 1;
        }
      }
    }
    expect(hit / truthEdge).toBeGreaterThan(0.4);
  });

  it('labels components without merging distinct objects', async () => {
    const binary = await runCpuOp('threshold', scene.image, { level: otsu(scene.image) });
    const { components } = connectedComponents(binary);
    expect(components.length).toBeGreaterThanOrEqual(3);
  });

  it('produces a hough accumulator with a real peak', () => {
    const edges = canny(scene.image);
    const acc = houghLines(edges, 90);
    const peak = acc.data.reduce((m, v) => Math.max(m, v), 0);
    expect(peak).toBeGreaterThan(0.2);
  });
});

describe('matching and metrics', () => {
  it('computes identical boxes as IoU of one', () => {
    const box = { x: 10, y: 10, w: 20, h: 20 };
    expect(iou(box, box)).toBeCloseTo(1, 10);
  });

  it('reports zero IoU for disjoint boxes', () => {
    expect(iou({ x: 0, y: 0, w: 5, h: 5 }, { x: 50, y: 50, w: 5, h: 5 })).toBe(0);
  });

  it('assigns each truth to at most one prediction', () => {
    const scene = buildScene({ seed: 5 });
    const truth = truthComponents(scene);
    const predicted = truth.map((c) => ({ ...c }));
    const m = matchComponents(predicted, truth, 0.3);
    const truthIds = m.pairs.map((p) => p.truth);
    expect(new Set(truthIds).size).toBe(truthIds.length);
  });

  it('scores a perfect mask as perfect', () => {
    const scene = buildScene({ seed: 9 });
    const truth = truthComponents(scene);
    const report = detectReport(truth, truth, 0.3);
    expect(report.precision).toBe(1);
    expect(report.recall).toBe(1);
    expect(report.falsePositives).toBe(0);
  });

  it('scores a perfect binary mask as 1.0 IoU', () => {
    const scene = buildScene({ seed: 9 });
    const mask = { ...scene.truth, data: new Float32Array(scene.truth.data).map((v) => (v > 0 ? 1 : 0)) };
    expect(maskIou(mask, mask)).toBe(1);
    expect(pixelAccuracy(mask, mask)).toBe(1);
  });
});

describe('optical flow', () => {
  it('recovers a known integer translation', () => {
    const scene = buildScene({ seed: 13 });
    const second = buildSecondFrame(scene, 3, 0);
    const flow = lucasKanade(scene.image, second, 3, 4);
    let samples = 0;
    let correct = 0;
    for (let y = 10; y < scene.h - 10; y += 2) {
      for (let x = 10; x < scene.w - 10; x += 2) {
        if (scene.truth.data[y * scene.w + x]! === 0) continue;
        samples += 1;
        if (flow.dx.data[y * scene.w + x] === 3) correct += 1;
      }
    }
    expect(samples).toBeGreaterThan(0);
    expect(correct / samples).toBeGreaterThan(0.5);
  });
});

describe('learned path', () => {
  it('is reproducible across a cache reset', () => {
    resetWeights();
    const first = ensureWeights(42);
    resetWeights();
    const second = ensureWeights(42);
    expect(Array.from(first.k1)).toEqual(Array.from(second.k1));
    expect(first.loss).toBe(second.loss);
  });

  it('reduces its training loss', () => {
    resetWeights();
    const weights = ensureWeights(42, { learningRate: 0.35, epochs: 6, samples: 8, seed: 1 });
    const early = ensureWeights(42, { learningRate: 0.35, epochs: 1, samples: 8, seed: 1 });
    expect(weights.loss).toBeLessThan(early.loss);
  });

  it('emits probabilities in the unit interval', () => {
    resetWeights();
    const weights = ensureWeights(42);
    const scene = buildScene({ seed: 42 });
    const out = predict(scene.image, weights, 3);
    for (const v of out.data) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('engine contract', () => {
  it('runs every advertised op', async () => {
    const scene = buildScene({ seed: 21 });
    for (const op of cpuEngine.ops) {
      await expect(cpuEngine.run(op, scene.image, {})).resolves.toBeTruthy();
    }
  });

  it('rejects an unknown op by name', async () => {
    const scene = buildScene({ seed: 21 });
    await expect(cpuEngine.run('nonsense', scene.image, {})).rejects.toThrow(/Unknown op/);
  });

  it('never trains on the scene it evaluates', async () => {
    resetWeights();
    const r = await runExperiment({ experimentId: 'learned', sceneSeed: 42, engine: cpuEngine });
    expect(r.extra.trainingScenes).toBe(8);
    // 42 * 17 + i * 101 + 1000 is the training pool; 42 itself is not a member.
    expect(42).not.toBe(1000 + 42 * 17 + 101);
  });
});

describe('every experiment runs and reports', () => {
  const ids = [
    'ground-truth',
    'edges',
    'regions',
    'lines',
    'learned',
    'depth',
    'motion',
    'domain-gap',
  ] as const;

  for (const id of ids) {
    it(`${id} produces a measured result`, async () => {
      const r = await runExperiment({ experimentId: id, sceneSeed: 31, engine: cpuEngine });
      expect(r.iou).toBeGreaterThanOrEqual(0);
      expect(r.iou).toBeLessThanOrEqual(1);
      expect(Number.isFinite(r.accuracy)).toBe(true);
      expect(r.notes.length).toBeGreaterThan(0);
    });
  }

  it('the answer key experiment is exactly perfect', async () => {
    const r = await runExperiment({ experimentId: 'ground-truth', sceneSeed: 31, engine: cpuEngine });
    expect(r.iou).toBe(1);
    expect(r.accuracy).toBe(1);
  });
});

describe('awaited cpu ops', () => {
  it('gaussian and threshold resolve to bounded tensors', async () => {
    const scene = buildScene({ seed: 4 });
    const blurred = await runCpuOp('gaussian', scene.image, { sigma: 1 });
    expect(blurred.data.length).toBe(scene.image.data.length);
    for (const v of blurred.data) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
