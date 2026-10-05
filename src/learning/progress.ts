import { useCallback, useSyncExternalStore } from 'react';
import { isIsoDay, toIsoDay } from '../content/flashcards.ts';
import type { CardProgress } from '../content/flashcards.ts';

/**
 * Review progress, kept in this browser only.
 *
 * The stored blob is untrusted input: it survives across app versions and can
 * be edited by hand, so every field is re-validated on read and anything that
 * does not parse is dropped rather than trusted. There is no account and no
 * upload, which is the same boundary the rest of the laboratory keeps.
 */

const STORAGE_KEY = 'vis.learn.v1.progress';

export interface ProgressState {
  readonly schema: 1;
  readonly cards: Readonly<Record<string, CardProgress>>;
  readonly reviewedTotal: number;
  readonly lastDay: string;
  readonly streak: { readonly current: number; readonly longest: number };
}

export const emptyState = (): ProgressState => ({
  schema: 1,
  cards: {},
  reviewedTotal: 0,
  lastDay: '',
  streak: { current: 0, longest: 0 },
});

const isCount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && Number.isFinite(v);

const isCardProgress = (v: unknown): v is CardProgress => {
  if (v === null || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.ef === 'number' &&
    Number.isFinite(c.ef) &&
    c.ef >= 1.3 &&
    isCount(c.interval) &&
    isIsoDay(c.due) &&
    isCount(c.reps) &&
    isCount(c.lapses)
  );
};

/** Re-validate a stored blob; unusable fields fall back instead of throwing. */
export const parseState = (raw: unknown): ProgressState => {
  const empty = emptyState();
  if (raw === null || typeof raw !== 'object') return empty;
  const value = raw as Record<string, unknown>;
  if (value.schema !== 1) return empty;

  const cards: Record<string, CardProgress> = {};
  if (value.cards !== null && typeof value.cards === 'object') {
    for (const [id, entry] of Object.entries(value.cards as Record<string, unknown>)) {
      if (isCardProgress(entry)) cards[id] = entry;
    }
  }

  const streakRaw = value.streak as Record<string, unknown> | undefined;
  const current = isCount(streakRaw?.current) ? streakRaw.current : 0;
  const longest = isCount(streakRaw?.longest) ? Math.max(streakRaw.longest, current) : current;

  return {
    schema: 1,
    cards,
    reviewedTotal: isCount(value.reviewedTotal) ? value.reviewedTotal : 0,
    lastDay: isIsoDay(value.lastDay) ? value.lastDay : '',
    streak: { current, longest },
  };
};

const read = (): ProgressState => {
  if (typeof localStorage === 'undefined') return emptyState();
  try {
    return parseState(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    // A corrupt blob is not an error worth surfacing: the reader simply starts
    // over rather than meeting a broken laboratory.
    return emptyState();
  }
};

const write = (state: ProgressState): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing and full quotas both land here. Losing progress is
    // acceptable; breaking the session is not.
  }
};

let state: ProgressState = read();
const listeners = new Set<() => void>();

const emit = (next: ProgressState): void => {
  state = next;
  write(next);
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = (): ProgressState => state;

export const useProgress = (): ProgressState => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/** Record a review and update the day streak. Pure apart from the store. */
export const recordReview = (
  cardId: string,
  next: CardProgress,
  now: Date,
): void => {
  const today = toIsoDay(now);
  const previousDay = state.lastDay;
  let current = state.streak.current;
  if (previousDay === '') current = 1;
  else if (previousDay !== today) {
    const gap = Math.round(
      (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${previousDay}T12:00:00Z`)) / 86_400_000,
    );
    current = gap === 1 ? current + 1 : 1;
  }
  emit({
    schema: 1,
    cards: { ...state.cards, [cardId]: next },
    reviewedTotal: state.reviewedTotal + 1,
    lastDay: today,
    streak: { current, longest: Math.max(state.streak.longest, current) },
  });
};

export const resetProgress = (): void => {
  emit(emptyState());
};

export const useResetProgress = (): (() => void) => useCallback(() => resetProgress(), []);
