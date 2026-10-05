import { compareEngines, cpuEngine } from './cpuEngine.ts';
import { WebGpuEngine, probeWebGpu } from './gpuEngine.ts';
import { buildScene } from './scene.ts';
import type { EngineReport, Lang, Text, VisionEngine } from './types.ts';

export interface EngineSelection {
  readonly engine: VisionEngine;
  readonly report: EngineReport;
  /** Ops the active engine cannot answer itself; the CPU path serves them. */
  readonly delegated: string[];
  /**
   * Largest disagreement between the two engines on a fixed probe scene, per op.
   * The GPU accumulates in f32 and the CPU in doubles, so small values are
   * expected; a large one means one of the two paths is wrong.
   */
  readonly parity: { op: string; maxDiff: number }[];
}

const detail = (lang: Lang, gpu: boolean, message: string): Text => ({
  tr: gpu
    ? message
    : `Bu tarayıcıda WebGPU yok. ${message} Tüm ölçümler CPU yolunda, aynı sözleşmeyle yapıldı.`,
  en: gpu
    ? message
    : `WebGPU is unavailable here. ${message} Every measurement below ran on the CPU path under the same contract.`,
});

/**
 * Chooses the active engine and produces the report the interface shows.
 *
 * The CPU path is a first-class default, not a degraded mode: Firefox ships
 * WebGPU only partially, and a laboratory whose numbers depend on a discrete
 * GPU would be a laboratory that cannot be reproduced.
 */
export async function selectEngine(lang: Lang, preferGpu: boolean): Promise<EngineSelection> {
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
        report: {
          id: gpu.id,
          describe: gpu.describe,
          secureContext: probe.secureContext,
          navigatorGpu: probe.navigatorGpu,
          adapter: probe.adapter,
          fallbackAdapter: probe.fallbackAdapter,
          vendor: probe.vendor,
          architecture: probe.architecture,
          detail: detail(lang, true, delegated.length > 0
            ? `Sekiz çekirdekli veri paralel iş yükleri WebGPU'da. ${delegated.length} işlem sıralı yapısı gerektirdiği için CPU yolunda çalışıyor.`
            : 'Sekiz çekirdekli veri paralel iş yükleri WebGPU\'da çalışıyor.'),
        },
      };
    }
  }

  const reason = probe.error ?? (probe.adapter ? 'GPU engine could not be created.' : 'No adapter.');
  return {
    engine: cpuEngine,
    delegated: [],
    // No second engine to compare against, so there is nothing to report here
    // and the interface says the CPU path was used rather than implying a check.
    parity: [],
    report: {
      id: cpuEngine.id,
      describe: cpuEngine.describe,
      secureContext: probe.secureContext,
      navigatorGpu: probe.navigatorGpu,
      adapter: probe.adapter,
      fallbackAdapter: probe.fallbackAdapter,
      vendor: probe.vendor,
      architecture: probe.architecture,
      detail: detail(lang, false, reason),
    },
  };
}
