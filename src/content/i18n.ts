import type { Text } from '../engine/types.ts';

export type Lang = 'tr' | 'en';

export const LANGS: readonly Lang[] = ['tr', 'en'];

export const UI = {
  appName: { tr: 'VIS', en: 'VIS' } as Text,
  tagline: {
    tr: 'Sentetik sahne · Bilinen cevap · Ölçülen algı',
    en: 'Synthetic scene · Known truth · Measured perception',
  } as Text,
  experiments: { tr: 'Deneyler', en: 'Experiments' } as Text,
  engine: { tr: 'Motor', en: 'Engine' } as Text,
  method: { tr: 'Yöntem', en: 'Method' } as Text,
  results: { tr: 'Sonuçlar', en: 'Results' } as Text,
  question: { tr: 'Soru', en: 'Question' } as Text,
  expectation: { tr: 'Beklenti', en: 'Expectation' } as Text,
  humanoid: { tr: 'İnsanoid neden önemli', en: 'Why a humanoid cares' } as Text,
  run: { tr: 'Deneyi çalıştır', en: 'Run experiment' } as Text,
  running: { tr: 'Çalışıyor', en: 'Running' } as Text,
  sceneSeed: { tr: 'Sahne tohumu', en: 'Scene seed' } as Text,
  objects: { tr: 'Nesne sayısı', en: 'Objects' } as Text,
  noise: { tr: 'Gürültü', en: 'Noise' } as Text,
  otsuOffset: { tr: 'Eşik kaydırması', en: 'Threshold offset' } as Text,
  depthWeight: { tr: 'Boyut ağırlığı', en: 'Size weight' } as Text,
  preferGpu: { tr: 'WebGPU motorunu dene', en: 'Try the WebGPU engine' } as Text,
  resetScene: { tr: 'Yeni sahne', en: 'New scene' } as Text,
  iou: { tr: 'IoU', en: 'IoU' } as Text,
  accuracy: { tr: 'Piksel doğruluğu', en: 'Pixel accuracy' } as Text,
  mae: { tr: 'Ortalama mutlak hata', en: 'Mean absolute error' } as Text,
  edgeRecall: { tr: 'Kenar hatırlama', en: 'Edge recall' } as Text,
  detection: { tr: 'Tespit', en: 'Detection' } as Text,
  perClass: { tr: 'Sınıf bazında IoU', en: 'Per-class IoU' } as Text,
  compared: { tr: 'Karşılaştırma', en: 'Comparison' } as Text,
  notes: { tr: 'Notlar', en: 'Notes' } as Text,
  truth: { tr: 'Cevap anahtarı', en: 'Answer key' } as Text,
  output: { tr: 'Çıktı', en: 'Output' } as Text,
  syntheticNotice: {
    tr: 'Bütün görüntüler sentetiktir. Gerçek kamera, gerçek sahne veya gerçek model kullanılmaz.',
    en: 'Every image is synthetic. No real camera, real scene or real model is used.',
  } as Text,
  noBackend: {
    tr: 'Backend yok, hesap gönderimi yok, hesap kaydı yok. Her şey bu tarayıcıda çalışır.',
    en: 'No backend, no uploads, no account. Everything runs in this browser.',
  } as Text,
  nextStage: { tr: 'İkinci aşama', en: 'Second stage' } as Text,
  precision: { tr: 'Kesinlik', en: 'Precision' } as Text,
  recall: { tr: 'Hatırlama', en: 'Recall' } as Text,
  falsePositives: { tr: 'Yanlış pozitif', en: 'False positives' } as Text,
  falseNegatives: { tr: 'Yanlış negatif', en: 'False negatives' } as Text,
  adapterMissing: {
    tr: 'WebGPU bağdaştırıcısı yok — CPU yolunda ölçülüyor',
    en: 'No WebGPU adapter — measuring on the CPU path',
  } as Text,
  footerNote: {
    tr: 'VIS, ENG dördüncü yılındaki otonom dijital insanoidin algı katmanı olarak tasarlandı. Eğitim, doğrulama ve değişmez tohum.',
    en: 'VIS is designed as the perception layer of the autonomous digital humanoid in year four of ENG. Educational, verified and deterministic.',
  } as Text,
} as const;

export type UiKey = keyof typeof UI;

export const t = (key: UiKey, lang: Lang): string => UI[key][lang];
