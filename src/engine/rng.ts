/**
 * Deterministic pseudo-random source. Every scene in VIS is reproducible from
 * its integer seed alone, so an experiment record replays exactly.
 */
export interface Rng {
  next(): number;
  int(minInclusive: number, maxExclusive: number): number;
  float(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  // mulberry32 — small, fast, and stable across engines because every
  // intermediate step stays inside 32-bit integer range via Math.imul.
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min));
  const float = (min: number, max: number): number => min + next() * (max - min);
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!;
  return { next, int, float, pick };
}
