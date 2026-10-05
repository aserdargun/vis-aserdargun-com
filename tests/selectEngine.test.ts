import { describe, expect, it } from 'vitest';
import { probeEngines } from '../src/engine/selectEngine.ts';
import type { EngineFacts } from '../src/engine/selectEngine.ts';
import { describeSelection, toReport } from '../src/engine/selectEngine.ts';

const facts = (over: Partial<EngineFacts> = {}): EngineFacts => ({
  engine: {
    id: 'cpu',
    describe: 'CPU · Float32Array · deterministik',
    ops: [],
    has: () => false,
    run: async () => {
      throw new Error('unused');
    },
  },
  delegated: [],
  parity: [],
  id: 'cpu',
  describe: 'CPU · Float32Array · deterministik',
  secureContext: true,
  navigatorGpu: false,
  adapter: false,
  fallbackAdapter: false,
  vendor: '',
  architecture: '',
  reason: '',
  ...over,
});

describe('engine description', () => {
  // Regression: the whole parity comparison — six GPU round-trips — used to run
  // again on every language switch, because the report text was built inside the
  // same effect that measured the engines. Prose is now derived at render time.
  it('translates the same facts without re-measuring', () => {
    const base = facts({ id: 'webgpu', adapter: true, navigatorGpu: true, vendor: 'apple', architecture: 'metal-3' });
    const tr = toReport(base, 'tr');
    const en = toReport(base, 'en');
    expect(tr.detail.tr).toContain("WebGPU'da");
    expect(tr.detail.en).toContain('WebGPU');
    expect(en.detail.en).toContain('WebGPU');
    // The measurements themselves are identical between locales.
    expect(en.adapter).toBe(tr.adapter);
    expect(en.architecture).toBe(tr.architecture);
    expect(en.id).toBe(tr.id);
  });

  it('names the delegated operators in both languages', () => {
    const base = facts({ id: 'webgpu', adapter: true, navigatorGpu: true, delegated: ['canny', 'hough'] });
    const text = describeSelection(base, 'tr');
    expect(text.tr).toContain('2 işlem');
    const en = describeSelection(base, 'en');
    expect(en.en).toContain('2 operators');
  });

  it('states the CPU scope rather than implying a comparison', () => {
    const cpu = facts({ reason: 'requestAdapter() returned null' });
    expect(describeSelection(cpu, 'tr').tr).toContain('CPU yolunda');
    expect(describeSelection(cpu, 'en').en).toContain('CPU path');
  });
});

describe('engine probe', () => {
  it('always resolves to a usable engine', async () => {
    for (const preferGpu of [true, false]) {
      const result = await probeEngines(preferGpu);
      expect(result.engine).toBeTruthy();
      expect(typeof result.describe).toBe('string');
      // Without a second engine there is nothing to compare, and the interface
      // must be told that rather than shown an empty comparison.
      if (result.id === 'cpu') expect(result.parity).toEqual([]);
    }
  });
});
