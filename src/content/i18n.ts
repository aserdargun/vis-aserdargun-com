import type { Lang, Text } from './types.ts';

export type { Lang, Text };
export const LANGS: readonly Lang[] = ['tr', 'en'];

/**
 * Interface strings, Turkish and English side by side on purpose.
 *
 * Every key here belongs to a surface that explains. There is no measurement
 * vocabulary in this file — no metric name, no engine probe, no threshold
 * control — because none of those words mean anything without the answer key
 * they were computed against, and the answer key lives in CVL.
 */
export const UI = {
  appName: { tr: 'VIS', en: 'VIS' } as Text,
  tagline: {
    tr: 'Yedi katman · Birincil kaynaklar · Her kavram ölçülebilir',
    en: 'Seven layers · Primary sources · Every concept is measurable',
  } as Text,
  knowledge: { tr: 'Bilgi bankası', en: 'Knowledge bank' } as Text,
  learn: { tr: 'Tekrar', en: 'Review' } as Text,
  sources: { tr: 'Kaynaklar', en: 'Sources' } as Text,
  responsibility: { tr: 'Sorumluluk', en: 'Responsibility' } as Text,
  notFor: { tr: 'Ne için değil', en: 'Not for' } as Text,
  buildsOn: { tr: 'Üzerine kurulur', en: 'Builds on' } as Text,
  concepts: { tr: 'Kavramlar', en: 'Concepts' } as Text,
  measureIt: { tr: 'Bunu ölç', en: 'Measure this' } as Text,
  laboratoryLink: { tr: 'CVL laboratuvarında aç', en: 'Open in the CVL laboratory' } as Text,
  sourceNote: {
    tr: 'Buradaki her açıklama birincil kaynağa bağlıdır. Buradaki hiçbir sayı ölçüm değildir: ölçümler, aynı fikir cevap anahtarına karşı CVL laboratuvarında hesaplanır.',
    en: 'Every explanation here is bound to a primary source. No number here is a measurement: measurements are computed in the CVL laboratory, against an answer key, on the same idea.',
  } as Text,
  learnNote: {
    tr: 'Kartlar bilgi bankasındaki kavramlardan türetilir ve yalnızca bu tarayıcıda saklanır. Doğru ya da yanlış hükmü burada verirsiniz; uygulama puan vermez. Karttan laboratuvara geçtiğinizde ölçüm CVL’de cevap anahtarına karşı hesaplanır.',
    en: 'Cards are derived from the knowledge bank and stay in this browser only. You are the one who judges them right or wrong; the application scores nothing. Following a card into the laboratory puts the measurement back against the answer key, in CVL.',
  } as Text,
  reveal: { tr: 'Yanıtı göster', en: 'Show the answer' } as Text,
  learnDone: { tr: 'Şu an tekrar zamanı olan kart yok. Yeni kartlar yarın açılır.', en: 'No card is due right now. New cards open tomorrow.' } as Text,
  learnLocal: { tr: 'İlerleme bu tarayıcıda tutulur; hesap gönderimi, backend veya çevrimiçi kayıt yoktur.', en: 'Progress stays in this browser; there is no upload, backend or online account.' } as Text,
  learnReset: { tr: 'İlerlemeyi sıfırla', en: 'Reset progress' } as Text,
  footerNote: {
    tr: 'VIS açıklar, ölçmez. Yedi algı katmanı, her biri birincil kaynağa bağlı. Ölçümler CVL’de, cevap anahtarına karşı hesaplanır. Eğitim ve değişmez tohum.',
    en: 'VIS explains, it does not measure. Seven perception layers, each bound to a primary source. Measurements are computed in CVL, against the answer key. Educational and deterministic.',
  } as Text,
} as const;

export type UiKey = keyof typeof UI;

export const t = (key: UiKey, lang: Lang): string => UI[key][lang];