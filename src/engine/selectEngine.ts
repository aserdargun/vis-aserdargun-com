import { cpuEngine } from './cpuEngine.ts';
import { WebGpuEngine, probeWebGpu } from './gpuEngine.ts';
import type { EngineReport, Lang, Text, VisionEngine } from './types.ts';

export interface EngineSelection {
  readonly engine: VisionEngine;
  readonly report: EngineReport;
  /** Ops the active engine cannot answer itself; the CPU path serves them. */
  readonly delegated: string[];
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
      return {
        engine: gpu,
        delegated,
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
