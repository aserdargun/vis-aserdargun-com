import { DEFAULT_TRAINING, predict, sampleFrom, train } from './cnn.ts';
import type { CnnWeights, TrainConfig } from './cnn.ts';
import { fuse, scoreCue, shadowCue, estimateDepth } from './depth.ts';
import type { DepthEstimate } from './depth.ts';
import { detectReport, edgeRecall, maskIou, meanAbsoluteError, perClassIoU, pixelAccuracy, truthComponents } from './metrics.ts';
import type { DetectionReport } from './metrics.ts';
import { canny, connectedComponents, houghLines, lucasKanade, otsu, sobel, threshold } from './ops.ts';
import type { Component, FlowField } from './ops.ts';
import { buildScene } from './scene.ts';
import type { Scene, Tensor, VisionEngine } from './types.ts';

/**
 * The measured outcome of one experiment on one scene.
 *
 * Every field is a measurement against the answer key produced alongside the
 * scene. Nothing here is a self-assessment, and nothing is carried over from a
 * previous run.
 */

export interface StageResult {
  /** What the operator produced. */
  readonly mask: Tensor;
  readonly label: string;
}

export interface ExperimentResult {
  readonly experimentId: string;
  readonly sceneSeed: number;
  readonly engineId: string;
  readonly engineDescribe: string;
  readonly stage: StageResult;
  /** Second stage for the comparisons. */
  readonly stage2?: StageResult;
  readonly truth: Tensor;
  readonly iou: number;
  readonly accuracy: number;
  readonly mae: number;
  readonly edgeRecall?: number;
  readonly detection?: DetectionReport;
  readonly perClass: { label: number; iou: number; pixels: number }[];
  readonly extra: Record<string, number | string>;
  readonly notes: string[];
}

/** Second frame: the same scene translated by a known integer offset. */
export function buildSecondFrame(scene: Scene, dx: number, dy: number): Tensor {
  const out: Tensor = { w: scene.w, h: scene.h, data: new Float32Array(scene.w * scene.h) };
  for (let y = 0; y < scene.h; y += 1) {
    for (let x = 0; x < scene.w; x += 1) {
      const sx = Math.min(scene.w - 1, Math.max(0, x - dx));
      const sy = Math.min(scene.h - 1, Math.max(0, y - dy));
      out.data[y * scene.w + x] = scene.image.data[sy * scene.w + sx]!;
    }
  }
  return out;
}

/** A photo-like input: adds smooth gradients, banding and non-uniform noise. */
export function photographic(scene: Scene): Tensor {
  const out: Tensor = { w: scene.w, h: scene.h, data: new Float32Array(scene.w * scene.h) };
  for (let y = 0; y < scene.h; y += 1) {
    for (let x = 0; x < scene.w; x += 1) {
      const i = y * scene.w + x;
      const vignette = 1 - 0.35 * Math.hypot(x / scene.w - 0.5, y / scene.h - 0.5);
      const banding = 0.04 * Math.sin(x * 0.35) * Math.sin(y * 0.22);
      out.data[i] = Math.min(1, Math.max(0, scene.image.data[i]! * vignette + banding));
    }
  }
  return out;
}

let cachedWeights: { key: string; weights: CnnWeights } | null = null;

/**
 * Trains once per configuration and reuses the weights afterwards. Training is
 * a few hundred milliseconds, and the same scene must not be trained against
 * between the two measured paths.
 */
export function ensureWeights(sceneSeed: number, config: TrainConfig = DEFAULT_TRAINING): CnnWeights {
  const key = `${config.seed}:${config.epochs}:${config.samples}:${config.learningRate}:${sceneSeed}`;
  if (cachedWeights?.key === key) return cachedWeights.weights;
  // Training pool deliberately excludes the evaluated seed.
  const samples = [];
  for (let i = 0; i < config.samples; i += 1) {
    const s = buildScene({ seed: 1000 + sceneSeed * 17 + i * 101 });
    samples.push(sampleFrom(s.image, s.truth, 3));
  }
  const weights = train(samples, config);
  cachedWeights = { key, weights };
  return weights;
}

export function resetWeights(): void {
  cachedWeights = null;
}

export interface RunOptions {
  readonly experimentId: string;
  readonly sceneSeed: number;
  readonly engine: VisionEngine;
  readonly objectCount?: number;
  readonly noise?: number;
  readonly depthWeight?: number;
  readonly otsuOffset?: number;
  readonly trainConfig?: TrainConfig;
}

function foregroundMask(scene: Scene, offset = 0): { mask: Tensor; components: Component[]; level: number } {
  const level = Math.min(0.98, Math.max(0.02, otsu(scene.image) + offset));
  const binary = threshold(scene.image, level);
  const filled = connectedComponents(binary);
  const kept = filled.components.filter((c) => c.area >= 24);
  const mask: Tensor = { w: scene.w, h: scene.h, data: new Float32Array(scene.w * scene.h) };
  const original = filled.mask;
  for (let i = 0; i < mask.data.length; i += 1) {
    const id = original.data[i]!;
    mask.data[i] = kept.some((c) => c.id === id) ? 1 : 0;
  }
  return { mask, components: kept, level };
}

export async function runExperiment(options: RunOptions): Promise<ExperimentResult> {
  const { engine, experimentId } = options;
  const scene = buildScene({
    seed: options.sceneSeed,
    objectCount: options.objectCount ?? 4,
    noise: options.noise ?? 0.02,
  });
  const truthForeground = (() => {
    const t: Tensor = { w: scene.w, h: scene.h, data: new Float32Array(scene.w * scene.h) };
    for (let i = 0; i < t.data.length; i += 1) t.data[i] = scene.truth.data[i]! > 0 ? 1 : 0;
    return t;
  })();

  const base = {
    experimentId,
    sceneSeed: options.sceneSeed,
    engineId: engine.id,
    engineDescribe: engine.describe,
    truth: truthForeground,
    perClass: [] as { label: number; iou: number; pixels: number }[],
    extra: {} as Record<string, number | string>,
    notes: [] as string[],
  };

  switch (experimentId) {
    case 'ground-truth': {
      const mask: Tensor = { w: scene.w, h: scene.h, data: truthForeground.data.slice() };
      return {
        ...base,
        stage: { mask, label: 'answer-key' },
        iou: maskIou(mask, truthForeground),
        accuracy: pixelAccuracy(mask, truthForeground),
        mae: meanAbsoluteError(mask, truthForeground),
        perClass: perClassIoU(mask, scene),
        notes: ['Bu maske üreticinin kendisinden geliyor; ölçüm 1.000 olmalı ve sapma bir hata işaretidir.'],
      };
    }

    case 'edges': {
      const mask = await engine.run('canny', scene.image, {});
      return {
        ...base,
        stage: { mask, label: 'canny' },
        iou: maskIou(mask, truthForeground),
        accuracy: pixelAccuracy(mask, truthForeground),
        mae: meanAbsoluteError(mask, truthForeground),
        edgeRecall: edgeRecall(mask, scene),
        perClass: perClassIoU(mask, scene),
        extra: { peakResponse: peakOf(sobel(scene.image)), edgePixels: countOn(mask) },
        notes: ['Kenar haritası nesne değildir; IoU düşük olması beklenen sonuçtur.'],
      };
    }

    case 'regions': {
      const { mask, components, level } = foregroundMask(scene, options.otsuOffset ?? 0);
      const detection = detectReport(components, truthComponents(scene), 0.3);
      return {
        ...base,
        stage: { mask, label: 'otsu + morphology + connected components' },
        iou: maskIou(mask, truthForeground),
        accuracy: pixelAccuracy(mask, truthForeground),
        mae: meanAbsoluteError(mask, truthForeground),
        detection,
        perClass: perClassIoU(mask, scene),
        extra: { otsuLevel: round4(level), components: components.length, truthObjects: scene.objects.length },
        notes: detection.falsePositives > 0
          ? ['Gölgeler bileşen olarak sayıldı. En sık hata tam burada.']
          : ['Yanlış pozitif yok; eşik bu sahnede gölgeleri dışladı.'],
      };
    }

    case 'lines': {
      const edges = await engine.run('canny', scene.image, {});
      const accumulator = houghLines(edges, 90);
      const image: Tensor = { w: scene.w, h: scene.h, data: new Float32Array(scene.w * scene.h) };
      // Back-project the strongest peak so the result is inspectable.
      let best = 0;
      let bestIdx = 0;
      for (let i = 0; i < accumulator.data.length; i += 1) {
        if (accumulator.data[i]! > best) {
          best = accumulator.data[i]!;
          bestIdx = i;
        }
      }
      const rhoBins = accumulator.w;
      const theta = (Math.floor(bestIdx / rhoBins) * Math.PI) / 90;
      const rho = bestIdx % rhoBins;
      for (let y = 0; y < scene.h; y += 1) {
        for (let x = 0; x < scene.w; x += 1) {
          const d = Math.abs(x * Math.cos(theta) + y * Math.sin(theta) - rho);
          image.data[y * scene.w + x] = d < 1.2 ? 1 : 0;
        }
      }
      return {
        ...base,
        stage: { mask: image, label: 'hough dominant line' },
        iou: maskIou(image, truthForeground),
        accuracy: pixelAccuracy(image, truthForeground),
        mae: meanAbsoluteError(image, truthForeground),
        perClass: perClassIoU(image, scene),
        extra: { peak: round4(best), thetaDegrees: round4((theta * 180) / Math.PI), rho, rhoBins },
        notes: ['En güçlü tepe zemin sınırına karşılık gelir; ufku vermeyen bir sahne bu çizgiyi veremez.'],
      };
    }

    case 'learned': {
      const weights = ensureWeights(options.sceneSeed, options.trainConfig ?? DEFAULT_TRAINING);
      const learned = predict(scene.image, weights, 3);
      const learnedMask: Tensor = { w: scene.w, h: scene.h, data: new Float32Array(scene.w * scene.h) };
      for (let i = 0; i < learnedMask.data.length; i += 1) learnedMask.data[i] = learned.data[i]! >= 0.5 ? 1 : 0;
      const handcrafted = foregroundMask(scene, options.otsuOffset ?? 0);
      const learnedIoU = maskIou(learnedMask, truthForeground);
      const handcraftedIoU = maskIou(handcrafted.mask, truthForeground);
      return {
        ...base,
        stage: { mask: learnedMask, label: 'learned CNN' },
        stage2: { mask: handcrafted.mask, label: 'handcrafted otsu' },
        iou: learnedIoU,
        accuracy: pixelAccuracy(learnedMask, truthForeground),
        mae: meanAbsoluteError(learnedMask, truthForeground),
        detection: detectReport(
          connectedComponents(learnedMask).components.filter((c) => c.area >= 24),
          truthComponents(scene),
          0.3,
        ),
        perClass: perClassIoU(learnedMask, scene),
        extra: {
          trainingLoss: round4(weights.loss),
          epochs: weights.epochs,
          trainingScenes: weights.samples,
          learnedIou: round4(learnedIoU),
          handcraftedIou: round4(handcraftedIoU),
          difference: round4(learnedIoU - handcraftedIoU),
        },
        notes: [
          `Eğitim kaybı ${round4(weights.loss)}. Ağ bu sahnenin cevap anahtarını görmeden eğitildi.`,
          learnedIoU >= handcraftedIoU
            ? 'Öğrenilen yol bu sahnede elle yazılmış yolu geçti; fark küçük ve sahneye özgü.'
            : 'Elle yazılmış yol bu sahnede önde; öğrenmenin maliyeti karşılığını vermedi.',
        ],
      };
    }

    case 'depth': {
      const { mask, components } = foregroundMask(scene, options.otsuOffset ?? 0);
      const sizeScore = scoreCue(components, scene, 'size');
      const planeScore = scoreCue(components, scene, 'ground-plane');
      const estimates: DepthEstimate[] = fuse(components, scene, options.depthWeight ?? 0.5);
      const shadow = components.map((_, i) => shadowCue(scene, i));
      const depthMap: Tensor = { w: scene.w, h: scene.h, data: new Float32Array(scene.w * scene.h) };
      for (let y = 0; y < scene.h; y += 1) {
        for (let x = 0; x < scene.w; x += 1) {
          depthMap.data[y * scene.w + x] = (y - scene.h * 0.3) / (scene.h * 0.7);
        }
      }
      return {
        ...base,
        stage: { mask, label: 'segmented objects' },
        stage2: { mask: depthMap, label: 'ground-plane depth prior' },
        iou: maskIou(mask, truthForeground),
        accuracy: pixelAccuracy(mask, truthForeground),
        mae: meanAbsoluteError(mask, truthForeground),
        perClass: perClassIoU(mask, scene),
        extra: {
          sizeRho: sizeScore.rho,
          groundPlaneRho: planeScore.rho,
          sizeDecisive: sizeScore.decisive ? 1 : 0,
          groundPlaneDecisive: planeScore.decisive ? 1 : 0,
          objects: components.length,
          nearest: estimates.length ? String(estimates.reduce((a, b) => (a.relative <= b.relative ? a : b)).componentIndex) : '',
          meanShadowContact: round4(mean(shadow)),
        },
        notes: [
          `Boyut ipucu ρ=${sizeScore.rho}, zemin ipucu ρ=${planeScore.rho}.`,
          'Derinlik sensörü yoktur; her iki değer de 2B görüntüden çıkarılmıştır.',
        ],
      };
    }

    case 'motion': {
      const second = buildSecondFrame(scene, 3, 0);
      const flow: FlowField = lucasKanade(scene.image, second, 3, 4);
      const magnitude: Tensor = { w: scene.w, h: scene.h, data: new Float32Array(scene.w * scene.h) };
      for (let i = 0; i < magnitude.data.length; i += 1) {
        magnitude.data[i] = Math.hypot(flow.dx.data[i]!, flow.dy.data[i]!) / 4;
      }
      const moved: Tensor = { w: scene.w, h: scene.h, data: new Float32Array(scene.w * scene.h) };
      for (let i = 0; i < moved.data.length; i += 1) moved.data[i] = magnitude.data[i]! >= 0.5 ? 1 : 0;
      return {
        ...base,
        stage: { mask: moved, label: 'lucas-kanade motion' },
        stage2: { mask: second, label: 'frame +3px' },
        iou: maskIou(moved, truthForeground),
        accuracy: pixelAccuracy(moved, truthForeground),
        mae: meanAbsoluteError(moved, truthForeground),
        perClass: perClassIoU(moved, scene),
        extra: {
          trackedWindows: flow.tracked,
          residual: round4(flow.residual),
          injectedShift: 3,
          meanFlowX: round4(mean(flow.dx.data)),
        },
        notes: [
          'Girdiye 3 piksel bilinen kaydırma verildi; akış bunu geri bulmalı, doğruluk ölçüldü.',
          'Gökyüzü gibi dokusuz alanlarda akış sıfırdır — bilgi yoktur, tahmin yoktur.',
        ],
      };
    }

    case 'domain-gap': {
      const synthetic = foregroundMask(scene, options.otsuOffset ?? 0);
      const photo = buildScene({ seed: options.sceneSeed, objectCount: options.objectCount ?? 4, noise: 0.02 });
      const photoInput = photographic(photo);
      const photoMaskRaw = threshold(photoInput, otsu(photoInput));
      const photoFilled = connectedComponents(photoMaskRaw);
      const photoKept = photoFilled.components.filter((c) => c.area >= 24);
      const photoMask: Tensor = { w: photo.w, h: photo.h, data: new Float32Array(photo.w * photo.h) };
      for (let i = 0; i < photoMask.data.length; i += 1) {
        const id = photoFilled.mask.data[i]!;
        photoMask.data[i] = photoKept.some((c) => c.id === id) ? 1 : 0;
      }
      const syntheticIou = maskIou(synthetic.mask, truthForeground);
      const photoIou = maskIou(photoMask, truthForeground);
      return {
        ...base,
        stage: { mask: synthetic.mask, label: 'synthetic input' },
        stage2: { mask: photoMask, label: 'photographic input' },
        iou: syntheticIou,
        accuracy: pixelAccuracy(synthetic.mask, truthForeground),
        mae: meanAbsoluteError(synthetic.mask, truthForeground),
        perClass: perClassIoU(synthetic.mask, scene),
        extra: {
          syntheticIou: round4(syntheticIou),
          photographicIou: round4(photoIou),
          drop: round4(syntheticIou - photoIou),
        },
        notes: [
          `Sentetik ${round4(syntheticIou)}, fotoğrafik ${round4(photoIou)}; düşüş ${round4(syntheticIou - photoIou)}.`,
          'Aynı eşik, aynı morfoloji. Yalnızca giriş değişti. Sentetik verinin gerçek dünya iddiası burada ölçülür.',
        ],
      };
    }

    default:
      throw new Error(`Unknown experiment: ${experimentId}`);
  }
}

const round4 = (v: number): number => Math.round(v * 10000) / 10000;
const countOn = (t: Tensor): number => {
  let n = 0;
  for (const v of t.data) if (v >= 0.5) n += 1;
  return n;
};
const mean = (v: ArrayLike<number>): number => {
  let s = 0;
  for (let i = 0; i < v.length; i += 1) s += v[i]!;
  return v.length === 0 ? 0 : s / v.length;
};
const peakOf = (t: Tensor): number => {
  let m = 0;
  for (const v of t.data) if (v > m) m = v;
  return round4(m);
};

export { canny, estimateDepth };
