import type { Text } from '../engine/types.ts';
import { CONCEPTS, layerById } from './library.ts';
import type { LayerId } from './library.ts';

/**
 * Spaced repetition over the knowledge bank.
 *
 * The cards carry no numbers and no measurements. A card is only allowed to
 * restate something the knowledge bank already says, and every card points at
 * the concept it came from, so a card can never drift away from the layer it
 * claims to review. `tests/flashcards.test.ts` checks that binding.
 *
 * Scheduling is SM-2 (Wozniak, 1990) with the same adaptations the family atlas
 * uses: rounded intervals, an updated ease factor and next-day review on
 * failure. It is a pure function of the previous state and a calendar day, so a
 * given review history always produces the same schedule.
 */

export const MIN_EF = 1.3;
export const DEFAULT_EF = 2.5;

export interface CardProgress {
  readonly ef: number;
  readonly interval: number;
  /** ISO calendar day (YYYY-MM-DD) when the card next becomes due. */
  readonly due: string;
  readonly reps: number;
  readonly lapses: number;
}

export interface Card {
  readonly id: string;
  readonly layer: LayerId;
  readonly conceptId: string;
  /** What is being asked, in both languages. */
  readonly prompt: Text;
  /** The answer. Short by design: a card that needs a paragraph is a concept. */
  readonly answer: Text;
  /** The negative boundary for this idea, which is what the card usually asks. */
  readonly boundary: Text;
}

export interface GradeResult {
  readonly prev: CardProgress;
  readonly next: CardProgress;
  readonly success: boolean;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const isIsoDay = (value: unknown): value is string =>
  typeof value === 'string' &&
  ISO_DAY.test(value) &&
  Number.isFinite(new Date(`${value}T12:00:00Z`).getTime()) &&
  new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;

export const toIsoDay = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const addDays = (date: Date, days: number): Date => {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
};

export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

export const initialCardProgress = (now: Date): CardProgress => ({
  ef: DEFAULT_EF,
  interval: 0,
  due: toIsoDay(now),
  reps: 0,
  lapses: 0,
});

/**
 * Apply a quality grade (0-5) to a card.
 *
 * 0-2 is a failure: the schedule restarts, the card returns tomorrow and the
 * lapse is counted. 3-5 is a success: the interval grows 1, 6, then by the ease
 * factor, and the ease factor itself is adjusted.
 */
export const grade = (prev: CardProgress, quality: number, now: Date): GradeResult => {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  const success = q >= 3;
  const ef = success
    ? Math.max(MIN_EF, prev.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
    : prev.ef;
  const interval = success
    ? prev.reps === 0
      ? 1
      : prev.reps === 1
        ? 6
        : Math.round(prev.interval * ef)
    : 1;
  const reps = success ? prev.reps + 1 : 0;
  const next: CardProgress = {
    ef,
    interval,
    reps,
    lapses: success ? prev.lapses : prev.lapses + 1,
    due: toIsoDay(addDays(now, interval)),
  };
  return { prev, next, success };
};

/** Split the deck into what is due, what is new, and what is not yet due. */
export const buildQueue = (
  cards: readonly Card[],
  progress: Readonly<Record<string, CardProgress>>,
  now: Date,
  newPerDay = 8,
): { due: Card[]; fresh: Card[]; later: Card[] } => {
  const today = toIsoDay(now);
  const due: Card[] = [];
  const fresh: Card[] = [];
  const later: Card[] = [];
  for (const card of cards) {
    const state = progress[card.id];
    if (!state) fresh.push(card);
    else if (daysBetween(state.due, today) >= 0) due.push(card);
    else later.push(card);
  }
  return { due, fresh: fresh.slice(0, newPerDay), later };
};

/**
 * Cards are derived from the concepts rather than written twice. Each concept
 * contributes one recall card, so the deck cannot fall out of step with the
 * knowledge bank, and the boundary of the layer is the answer the card asks for.
 */
const makeCard = (conceptId: string, askBoundary: boolean): Card => {
  const concept = CONCEPTS.find((c) => c.id === conceptId);
  if (!concept) throw new Error(`Unknown concept: ${conceptId}`);
  const layer = layerById(concept.layer);
  return {
    id: `${concept.id}-${askBoundary ? 'boundary' : 'term'}`,
    layer: concept.layer,
    conceptId: concept.id,
    // A boundary card asks for the limit, and its answer *is* the limit; a term
    // card asks for the meaning and answers with the summary. Both always keep
    // the other text on the card, so a reader can see both sides.
    prompt: askBoundary
      ? { tr: `${layer.title.tr} katmanında bu kavram ne için değildir?`, en: `In the ${layer.title.en} layer, what is this concept not for?` }
      : { tr: `Bu kavram ne anlama gelir?`, en: `What does this concept mean?` },
    answer: askBoundary ? layer.notFor : concept.summary,
    boundary: concept.summary,
  };
};

const TERM_CONCEPTS = CONCEPTS.map((c) => c.id);
const BOUNDARY_CONCEPTS = ['hysteresis', 'otsu-threshold', 'horizon-ambiguity', 'texture-dependence', 'morphology-shadow'];

export const CARDS: readonly Card[] = [
  ...TERM_CONCEPTS.map((id) => makeCard(id, false)),
  ...BOUNDARY_CONCEPTS.map((id) => makeCard(id, true)),
];
