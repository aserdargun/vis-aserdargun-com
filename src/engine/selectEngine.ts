import { compareEngines, cpuEngine } from './cpuEngine.ts';
import { WebGpuEngine, probeWebGpu } from './gpuEngine.ts';
import { buildScene } from './scene.ts';
import type { EngineId, EngineReport, Lang, Text, VisionEngine } from './types.ts';

/**
 * Language-independent facts about the active engine.
 *
 * These are measurements and capability probes, so they must be computed once.
 * The prose that describes them is a separate, cheap concern — see
 * `describeSelection`, which takes the current language at render time.
 */
export interface EngineFacts {
  readonly engine: VisionEngine;
  /** Ops the active engine cannot answer itself; the CPU path serves them. */
  readonly delegated: string[];
  /**
   * Largest disagreement between the two engines on a fixed probe scene, per op.
   * The GPU accumulates in f32 and the CPU in doubles, so small values are
   * expected; a large one means one of the two paths is wrong.
   */
  readonly parity: { op: string; maxDiff: number }[];
  readonly id: EngineId;
  readonly describe: string;
  readonly secureContext: boolean;
  readonly navigatorGpu: boolean;
  readonly adapter: boolean;
  readonly fallbackAdapter: boolean;
  readonly vendor: string;
  readonly architecture: string;
  /** Technical reason the CPU path was chosen; empty when the GPU is active. */
  readonly reason: string;
}

const CPU_MESSAGE = 'Bu tarayıcıda WebGPU yok. Tüm ölçümler CPU yolunda, aynı sözleşmeyle yapıldı.';
const CPU_MESSAGE_EN = 'WebGPU is unavailable here. Every measurement below ran on the CPU path under the same contract.';

const GPU_REASON = {
  tr: (delegated: number): string =>
    delegated > 0
      ? `Sekiz çekirdekli veri paralel iş yükleri WebGPU'da. ${delegated} işlem sıralı yapısı gerektirdiği için CPU yolunda çalışıyor.`
      : "Sekiz çekirdekli veri paralel iş yükleri WebGPU'da çalışıyor.",
  en: (delegated: number): string =>
    delegated > 0
      ? `The eight data-parallel work loads run on WebGPU. ${delegated} operators keep a sequential structure and run on the CPU path.`
      : 'The eight data-parallel work loads run on WebGPU.',
};

/** Localized explanation, derived on demand so a language switch costs nothing. */
export function describeSelection(facts: EngineFacts, lang: Lang): Text {
  if (facts.id === 'webgpu') {
    const text = GPU_REASON[lang](facts.delegated.length);
    return { tr: text, en: text };
  }
  return {
    tr: facts.reason ? `${CPU_MESSAGE} ${facts.reason}` : CPU_MESSAGE,
    en: facts.reason ? `${CPU_MESSAGE_EN} ${facts.reason}` : CPU_MESSAGE_EN,
  };
}

export function toReport(facts: EngineFacts, lang: Lang): EngineReport {
  return {
    id: facts.id,
    describe: facts.describe,
    secureContext: facts.secureContext,
    navigatorGpu: facts.navigatorGpu,
    adapter: facts.adapter,
    fallbackAdapter: facts.fallbackAdapter,
    vendor: facts.vendor,
    architecture: facts.architecture,
    detail: describeSelection(facts, lang),
  };
}

/**
 * Chooses the active engine and measures how far the two paths disagree.
 *
 * The CPU path is a first-class default, not a degraded mode: Firefox ships
 * WebGPU only partially, and a laboratory whose numbers depend on a discrete
 * GPU would be a laboratory that cannot be reproduced.
 */
export async function probeEngines(preferGpu: boolean): Promise<EngineFacts> {
  const probe = await probeWebGpu();

  if (preferGpu && probe.adapter) {
    const gpu = await WebGpuEngine.create();
    if (gpu) {
      const delegated = cpuEngine.ops.filter((op) => !gpu.has(op));
      const probeScene = buildScene({ seed: 42 });
      const parity: { op: string; maxDiff: number }[] = [];
      for (const op of gpu.ops) {
        const params: Record<string, number> = op === 'threshold' ? { level: 0.5 } : {};
        const maxDiff = await compareEngines(gpu, probeScene.image, op, params);
        parity.push({ op, maxDiff: Math.round(maxDiff * 1e6) / 1e6 });
      }
      return {
        engine: gpu,
        delegated,
        parity,
        id: gpu.id,
        describe: gpu.describe,
        secureContext: probe.secureContext,
        navigatorGpu: probe.navigatorGpu,
        adapter: probe.adapter,
        fallbackAdapter: probe.fallbackAdapter,
        vendor: probe.vendor,
        architecture: probe.architecture,
        reason: '',
      };
    }
  }

  return {
    engine: cpuEngine,
    delegated: [],
    // No second engine to compare against, so there is nothing to report here
    // and the interface says the CPU path was used rather than implying a check.
    parity: [],
    id: cpuEngine.id,
    describe: cpuEngine.describe,
    secureContext: probe.secureContext,
    navigatorGpu: probe.navigatorGpu,
    adapter: probe.adapter,
    fallbackAdapter: probe.fallbackAdapter,
    vendor: probe.vendor,
    architecture: probe.architecture,
    reason: probe.error ?? (probe.adapter ? 'GPU engine could not be created.' : 'No adapter.'),
  };
}
