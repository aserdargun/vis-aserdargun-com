import { createRng } from './rng.ts';
import type { Tensor } from './types.ts';
import { atClamped, like } from './types.ts';

/**
 * A deliberately tiny convolutional segmenter, trained at runtime on synthetic
 * scenes and then frozen for the measured comparison.
 *
 * The point of the laboratory is not that learning wins. It is that both paths
 * are measured on the same answer key, so the difference is a number rather
 * than an opinion.
 *
 *   conv1  1 -> 4, 5x5, stride 2, ReLU
 *   conv2  4 -> 1, 3x3, stride 1, sigmoid
 *
 * Every weight starts from a seeded generator and every update follows the same
 * floating point order, so two runs on two machines agree.
 */

export interface TrainConfig {
  readonly learningRate: number;
  readonly epochs: number;
  readonly samples: number;
  readonly seed: number;
}

export const DEFAULT_TRAINING: TrainConfig = {
  learningRate: 0.35,
  epochs: 6,
  samples: 8,
  seed: 20260101,
};

export interface CnnWeights {
  readonly k1: Float32Array; // 4 filters, 5x5
  readonly b1: Float32Array; // 4
  readonly k2: Float32Array; // 1 filter, 4 channels, 3x3
  readonly b2: number;
  readonly loss: number;
  readonly epochs: number;
  readonly samples: number;
}

const K1 = 4;
const K2 = 1;
const S1 = 5;
const S2 = 3;
const STRIDE = 2;

/** Box-downsamples to the network's working resolution. */
export function downsample(src: Tensor, factor: number): Tensor {
  const w = Math.floor(src.w / factor);
  const h = Math.floor(src.h / factor);
  const out = like(src, 0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let acc = 0;
      for (let dy = 0; dy < factor; dy += 1) {
        for (let dx = 0; dx < factor; dx += 1) acc += atClamped(src, x * factor + dx, y * factor + dy);
      }
      out.data[y * w + x] = acc / (factor * factor);
    }
  }
  return out;
}

interface FeatureMaps {
  a: Float32Array; // conv1 output, K1 channels
  z: Float32Array; // conv2 output, K2 channels
  aw: number;
  ah: number;
  zw: number;
  zh: number;
}

function forward(x: Tensor, k1: Float32Array, b1: Float32Array, k2: Float32Array, b2: number): FeatureMaps {
  const aw = Math.floor((x.w - S1) / STRIDE) + 1;
  const ah = Math.floor((x.h - S1) / STRIDE) + 1;
  const a = new Float32Array(K1 * aw * ah);
  for (let c = 0; c < K1; c += 1) {
    for (let y = 0; y < ah; y += 1) {
      for (let px = 0; px < aw; px += 1) {
        let acc = b1[c]!;
        for (let ky = 0; ky < S1; ky += 1) {
          for (let kx = 0; kx < S1; kx += 1) {
            acc += atClamped(x, px * STRIDE + kx, y * STRIDE + ky) * k1[(c * S1 + ky) * S1 + kx]!;
          }
        }
        a[c * aw * ah + y * aw + px] = acc > 0 ? acc : 0;
      }
    }
  }
  const zw = aw - S2 + 1;
  const zh = ah - S2 + 1;
  const z = new Float32Array(K2 * zw * zh);
  for (let c = 0; c < K2; c += 1) {
    for (let y = 0; y < zh; y += 1) {
      for (let px = 0; px < zw; px += 1) {
        let acc = b2;
        for (let ch = 0; ch < K1; ch += 1) {
          for (let ky = 0; ky < S2; ky += 1) {
            for (let kx = 0; kx < S2; kx += 1) {
              acc += a[ch * aw * ah + (y + ky) * aw + (px + kx)]! * k2[(c * K1 + ch) * S2 * S2 + ky * S2 + kx]!;
            }
          }
        }
        z[c * zw * zh + y * zw + px] = acc;
      }
    }
  }
  return { a, z, aw, ah, zw, zh };
}

const sigmoid = (v: number): number => 1 / (1 + Math.exp(-v));

export interface TrainingSample {
  readonly input: Tensor;
  /** Binary foreground target at the network's working resolution. */
  readonly target: Float32Array;
  readonly tw: number;
  readonly th: number;
}

function sampleFrom(x: Tensor, truth: Tensor, factor: number): TrainingSample {
  const input = downsample(x, factor);
  const tw = Math.floor(input.w / STRIDE) - S2 + 1;
  const th = Math.floor(input.h / STRIDE) - S2 + 1;
  const target = new Float32Array(tw * th);
  for (let y = 0; y < th; y += 1) {
    for (let px = 0; px < tw; px += 1) {
      // Nearest-neighbour label from the answer key, not from the picture.
      const sx = Math.min(truth.w - 1, (px * STRIDE + S2 / 2) * factor);
      const sy = Math.min(truth.h - 1, (y * STRIDE + S2 / 2) * factor);
      target[y * tw + px] = truth.data[sy * truth.w + sx]! > 0 ? 1 : 0;
    }
  }
  return { input, target, tw, th };
}

/**
 * Trains on scenes that are *not* the evaluated one. Passing the test scene in
 * here would make the comparison meaningless, so the caller supplies the pool
 * and the scene under test is excluded by seed.
 */
export function train(samples: TrainingSample[], config: TrainConfig = DEFAULT_TRAINING): CnnWeights {
  const rng = createRng(config.seed);
  const k1 = new Float32Array(K1 * S1 * S1);
  const b1 = new Float32Array(K1);
  const k2 = new Float32Array(K2 * K1 * S2 * S2);
  let b2 = 0;
  // He-style init keeps the first forward pass away from a dead sigmoid.
  const s1 = Math.sqrt(2 / (S1 * S1));
  for (let i = 0; i < k1.length; i += 1) k1[i] = (rng.next() * 2 - 1) * s1;
  const s2 = Math.sqrt(2 / (K1 * S2 * S2));
  for (let i = 0; i < k2.length; i += 1) k2[i] = (rng.next() * 2 - 1) * s2;

  const gk1 = new Float32Array(k1.length);
  const gb1 = new Float32Array(b1.length);
  const gk2 = new Float32Array(k2.length);
  // Reset at the top of every epoch, like the gradient buffers.
  let gb2: number;
  let loss = 0;
  let seen = 0;

  for (let epoch = 0; epoch < config.epochs; epoch += 1) {
    gk1.fill(0);
    gb1.fill(0);
    gk2.fill(0);
    gb2 = 0;
    loss = 0;
    // gb2 is a scalar accumulator; it is reset per epoch like the buffers.
    for (let s = 0; s < config.samples; s += 1) {
      const sample = samples[s % samples.length]!;
      const f = forward(sample.input, k1, b1, k2, b2);
      const da = new Float32Array(f.a.length);
      for (let i = 0; i < f.z.length; i += 1) {
        const p = sigmoid(f.z[i]!);
        const t = sample.target[i]!;
        const d = p - t;
        loss += -(t * Math.log(Math.max(1e-9, p)) + (1 - t) * Math.log(Math.max(1e-9, 1 - p)));
        gb2 += d;
        const w = d;
        // Row-major index into the conv2 output, not a modulo of the flat id.
        const oy = Math.floor(i / f.zw);
        const ox = i - oy * f.zw;
        for (let ch = 0; ch < K1; ch += 1) {
          for (let ky = 0; ky < S2; ky += 1) {
            for (let kx = 0; kx < S2; kx += 1) {
              const ai = ch * f.aw * f.ah + (oy + ky) * f.aw + (ox + kx);
              gk2[(ch * S2 + ky) * S2 + kx]! += w * f.a[ai]!;
              if (f.a[ai]! > 0) da[ai]! += w * k2[(ch * S2 + ky) * S2 + kx]!;
            }
          }
        }
      }
      for (let c = 0; c < K1; c += 1) {
        for (let y = 0; y < f.ah; y += 1) {
          for (let px = 0; px < f.aw; px += 1) {
            const ai = c * f.aw * f.ah + y * f.aw + px;
            const d = da[ai]!;
            if (d === 0) continue;
            gb1[c]! += d;
            for (let ky = 0; ky < S1; ky += 1) {
              for (let kx = 0; kx < S1; kx += 1) {
                gk1[(c * S1 + ky) * S1 + kx]! += d * atClamped(sample.input, px * STRIDE + kx, y * STRIDE + ky);
              }
            }
          }
        }
      }
      seen += f.z.length;
    }
    const norm = 1 / Math.max(1, config.samples);
    for (let i = 0; i < k1.length; i += 1) k1[i]! -= config.learningRate * norm * gk1[i]!;
    for (let i = 0; i < b1.length; i += 1) b1[i]! -= config.learningRate * norm * gb1[i]!;
    for (let i = 0; i < k2.length; i += 1) k2[i]! -= config.learningRate * norm * gk2[i]!;
    b2 -= config.learningRate * norm * gb2;
  }

  return { k1: k1.slice(), b1: b1.slice(), k2: k2.slice(), b2, loss: loss / Math.max(1, seen), epochs: config.epochs, samples: config.samples };
}

/** Runs the trained network and up-samples the probability map to full size. */
export function predict(input: Tensor, weights: CnnWeights, factor = 3): Tensor {
  const small = downsample(input, factor);
  const f = forward(small, weights.k1, weights.b1, weights.k2, weights.b2);
  const out = like(input, 0);
  for (let y = 0; y < input.h; y += 1) {
    for (let x = 0; x < input.w; x += 1) {
      const zx = Math.min(f.zw - 1, Math.floor(x / factor / STRIDE));
      const zy = Math.min(f.zh - 1, Math.floor(y / factor / STRIDE));
      out.data[y * input.w + x] = sigmoid(f.z[zy * f.zw + zx]!);
    }
  }
  return out;
}

export { forward as forwardCnn, sampleFrom, sigmoid };
