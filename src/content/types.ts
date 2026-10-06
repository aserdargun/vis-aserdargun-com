/**
 * The bilingual text shape, owned by the content layer.
 *
 * This type used to live in `engine/types.ts` and travelled with the
 * measurement engine. Once the engine left VIS, the copy in the prose had to
 * bring its own: a Turkish/English pair is a property of a sentence, not of a
 * tensor.
 */
export type Text = Record<'tr' | 'en', string>;

export type Lang = 'tr' | 'en';