import { describe, expect, it } from 'vitest';
import { CARDS, buildQueue, grade, initialCardProgress, isIsoDay, toIsoDay } from '../src/content/flashcards.ts';
import { CONCEPTS, conceptById, layerById } from '../src/content/library.ts';
import { experimentById } from '../src/content/experiments.ts';
import { parseState, emptyState } from '../src/learning/progress.ts';
import type { CardProgress } from '../src/content/flashcards.ts';

const DAY = new Date('2026-10-05T12:00:00Z');
const LANGS = ['tr', 'en'] as const;

describe('card derivation', () => {
  it('covers every concept at least once', () => {
    const concepts = new Set(CARDS.map((c) => c.conceptId));
    for (const concept of CONCEPTS) {
      expect(concepts.has(concept.id), `no card for ${concept.id}`).toBe(true);
    }
  });

  it('binds every card to a real concept, layer and experiment', () => {
    for (const card of CARDS) {
      const concept = conceptById(card.conceptId);
      expect(concept.layer).toBe(card.layer);
      expect(() => layerById(card.layer)).not.toThrow();
      expect(() => experimentById(concept.experiment)).not.toThrow();
    }
  });

  it('has unique ids', () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
  });

  it('asks the boundary of at least a few concepts, not only definitions', () => {
    const boundaryCards = CARDS.filter((c) => c.id.endsWith('-boundary'));
    expect(boundaryCards.length).toBeGreaterThanOrEqual(4);
    for (const card of boundaryCards) {
      expect(card.answer).toEqual(layerById(card.layer).notFor);
    }
  });
});

describe('bilingual parity', () => {
  it('has both languages on every card field', () => {
    for (const card of CARDS) {
      for (const lang of LANGS) {
        expect(card.prompt[lang].length, `${card.id} prompt ${lang}`).toBeGreaterThan(3);
        expect(card.answer[lang].length, `${card.id} answer ${lang}`).toBeGreaterThan(20);
        expect(card.boundary[lang].length, `${card.id} boundary ${lang}`).toBeGreaterThan(15);
      }
      expect(card.prompt.tr).not.toBe(card.prompt.en);
      expect(Object.keys(card.prompt).sort()).toEqual(['en', 'tr']);
    }
  });
});

describe('no numbers in cards', () => {
  it('keeps the deck free of numeric claims', () => {
    for (const card of CARDS) {
      for (const lang of LANGS) {
        const text = `${card.prompt[lang]} ${card.answer[lang]} ${card.boundary[lang]}`;
        expect(text.match(/\d+(?:[.,]\d+)?/g) ?? [], `${card.id} ${lang}`).toEqual([]);
      }
    }
  });
});

describe('SM-2 scheduling', () => {
  it('starts every card due today with no history', () => {
    const state = initialCardProgress(DAY);
    expect(state).toEqual({ ef: 2.5, interval: 0, due: '2026-10-05', reps: 0, lapses: 0 });
  });

  it('walks the success ladder 1 then 6 then ease-scaled', () => {
    let state = initialCardProgress(DAY);
    state = grade(state, 5, DAY).next;
    expect(state.interval).toBe(1);
    state = grade(state, 5, DAY).next;
    expect(state.interval).toBe(6);
    // From here the interval is the previous one scaled by the ease factor this
    // review settles on, so 6 * 2.8 = 16.8 -> 17. Traced, not assumed.
    state = grade(state, 5, DAY).next;
    expect(state.interval).toBe(Math.round(6 * 2.8));
    expect(state.reps).toBe(3);
    expect(state.lapses).toBe(0);
  });

  it('resets on failure and counts a lapse', () => {
    let state = initialCardProgress(DAY);
    state = grade(state, 5, DAY).next;
    state = grade(state, 5, DAY).next;
    const failed = grade(state, 1, DAY);
    expect(failed.success).toBe(false);
    expect(failed.next.reps).toBe(0);
    expect(failed.next.interval).toBe(1);
    expect(failed.next.lapses).toBe(1);
  });

  it('never lets the ease factor fall below the floor', () => {
    let state = initialCardProgress(DAY);
    for (let i = 0; i < 12; i += 1) state = grade(state, 1, DAY).next;
    expect(state.ef).toBeGreaterThanOrEqual(1.3);
  });

  it('makes a hard answer easier and an easy answer harder to repeat', () => {
    const base = initialCardProgress(DAY);
    expect(grade(base, 3, DAY).next.ef).toBeLessThan(base.ef);
    expect(grade(base, 5, DAY).next.ef).toBeGreaterThan(base.ef);
  });

  it('is a pure function of previous state and day', () => {
    const state = initialCardProgress(DAY);
    const a = grade(state, 4, DAY).next;
    const b = grade(state, 4, DAY).next;
    expect(a).toEqual(b);
  });

  it('clamps an out-of-range grade instead of trusting it', () => {
    const state = initialCardProgress(DAY);
    expect(grade(state, 99, DAY).next).toEqual(grade(state, 5, DAY).next);
    expect(grade(state, -4, DAY).next).toEqual(grade(state, 0, DAY).next);
  });

  it('rolls the due day forward by the interval', () => {
    const state = initialCardProgress(DAY);
    expect(grade(state, 5, DAY).next.due).toBe('2026-10-06');
  });
});

describe('queue', () => {
  it('separates due, new and later cards', () => {
    const due: CardProgress = { ef: 2.5, interval: 1, due: '2026-10-04', reps: 1, lapses: 0 };
    const later: CardProgress = { ef: 2.5, interval: 6, due: '2026-10-11', reps: 2, lapses: 0 };
    const [a, b, c] = CARDS;
    const queue = buildQueue([a!, b!, c!], { [a!.id]: due, [b!.id]: later }, DAY);
    expect(queue.due.map((x) => x.id)).toEqual([a!.id]);
    expect(queue.later.map((x) => x.id)).toEqual([b!.id]);
    expect(queue.fresh.map((x) => x.id)).toEqual([c!.id]);
  });

  it('caps how many new cards appear in one session', () => {
    const queue = buildQueue(CARDS, {}, DAY, 3);
    expect(queue.fresh).toHaveLength(3);
  });
});

describe('date helpers', () => {
  it('validates a real calendar day', () => {
    expect(isIsoDay('2026-10-05')).toBe(true);
    expect(isIsoDay('2026-02-30')).toBe(false);
    expect(isIsoDay('2026-13-01')).toBe(false);
    expect(isIsoDay('not-a-day')).toBe(false);
    expect(isIsoDay(null)).toBe(false);
  });

  it('formats a local day without drifting by timezone', () => {
    expect(toIsoDay(new Date(2026, 9, 5))).toBe('2026-10-05');
  });
});

describe('stored progress is untrusted input', () => {
  it('starts clean for anything unparseable', () => {
    expect(parseState(null)).toEqual(emptyState());
    expect(parseState('nope')).toEqual(emptyState());
    expect(parseState({ schema: 2, cards: {} })).toEqual(emptyState());
  });

  it('drops a corrupt card and keeps the valid ones', () => {
    const good: CardProgress = { ef: 2.5, interval: 1, due: '2026-10-04', reps: 1, lapses: 0 };
    const parsed = parseState({
      schema: 1,
      cards: { good, bad: { ef: 0.1, interval: -3, due: 'nope' }, worse: 'string' },
      reviewedTotal: 4,
      lastDay: '2026-10-05',
      streak: { current: 2, longest: 5 },
    });
    expect(Object.keys(parsed.cards)).toEqual(['good']);
    expect(parsed.reviewedTotal).toBe(4);
    expect(parsed.streak).toEqual({ current: 2, longest: 5 });
  });

  it('repairs a streak whose longest is below its current', () => {
    const parsed = parseState({ schema: 1, cards: {}, streak: { current: 4, longest: 1 }, lastDay: '' });
    expect(parsed.streak).toEqual({ current: 4, longest: 4 });
  });

  it('refuses an ease factor under the scheduling floor', () => {
    const parsed = parseState({
      schema: 1,
      cards: { x: { ef: 0.5, interval: 1, due: '2026-10-04', reps: 1, lapses: 0 } },
    });
    expect(parsed.cards).toEqual({});
  });
});
