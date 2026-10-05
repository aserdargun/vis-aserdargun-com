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
  knowledge: { tr: 'Bilgi bankası', en: 'Knowledge bank' } as Text,
  laboratory: { tr: 'Laboratuvar', en: 'Laboratory' } as Text,
  layers: { tr: 'Katmanlar', en: 'Layers' } as Text,
  sources: { tr: 'Kaynaklar', en: 'Sources' } as Text,
  responsibility: { tr: 'Sorumluluk', en: 'Responsibility' } as Text,
  notFor: { tr: 'Ne için değil', en: 'Not for' } as Text,
  buildsOn: { tr: 'Üzerine kurulur', en: 'Builds on' } as Text,
  concepts: { tr: 'Kavramlar', en: 'Concepts' } as Text,
  measureIt: { tr: 'Bunu ölç', en: 'Measure this' } as Text,
  sourceNote: {
    tr: 'Buradaki her açıklama birincil kaynağa bağlıdır ve deneylerden ayrıdır. Buradaki hiçbir sayı ölçüm değildir; ölçümler yalnızca laboratuvarda, cevap anahtarına karşı hesaplanır.',
    en: 'Every explanation here is bound to a primary source and is kept apart from the experiments. No number here is a measurement; measurements are computed in the laboratory only, against the answer key.',
  } as Text,
  experimentLink: { tr: 'Deney', en: 'Experiment' } as Text,
  footerNote: {
    tr: 'VIS, bilgisayarlı görünün temel şeridinde bir bilgi bankasıdır: yedi katman, birincil kaynaklar ve her kavramı ölçebilen deneyler. Laboratuvar ölçer, bilgi bankası açıklar. Eğitim ve değişmez tohum.',
    en: 'VIS is a knowledge bank in the computer-vision foundation lane: seven layers, primary sources, and an experiment that measures every concept. The laboratory measures; the knowledge bank explains. Educational and deterministic.',
  } as Text,
} as const;

export type UiKey = keyof typeof UI;

export const t = (key: UiKey, lang: Lang): string => UI[key][lang];
