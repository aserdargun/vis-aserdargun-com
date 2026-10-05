import { useCallback, useMemo, useState } from 'react';
import { CARDS, buildQueue, grade, initialCardProgress } from './content/flashcards.ts';
import type { Card } from './content/flashcards.ts';
import { experimentById } from './content/experiments.ts';
import { conceptById } from './content/library.ts';
import { t, type Lang } from './content/i18n.ts';
import { recordReview, useProgress, useResetProgress } from './learning/progress.ts';

/**
 * The review surface.
 *
 * A card is graded by the reader, never scored by the application. There is no
 * correctness claim anywhere in this file, because the laboratory's contract is
 * that no number here would be a measurement: the only number it reports is the
 * reader's own review history.
 */
export function LearnView({ lang, onMeasure }: { lang: Lang; onMeasure: (id: ReturnType<typeof experimentById>['id']) => void }) {
  const progress = useProgress();
  const reset = useResetProgress();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [session, setSession] = useState(0);

  const now = useMemo(() => new Date(), [session]);
  const queue = useMemo(() => buildQueue(CARDS, progress.cards, now), [progress.cards, now]);
  const current: Card | undefined = queue.due[index] ?? queue.fresh[index];

  const answer = useCallback(
    (quality: number) => {
      if (!current) return;
      const prev = progress.cards[current.id] ?? initialCardProgress(now);
      const { next } = grade(prev, quality, now);
      recordReview(current.id, next, now);
      setRevealed(false);
      setIndex((i) => (queue.due.length + queue.fresh.length > 1 ? i + 1 : 0));
      setSession((s) => s + 1);
    },
    [current, progress.cards, now, queue.due.length, queue.fresh.length],
  );

  const reviewed = Object.keys(progress.cards).length;

  return (
    <div className="kb learn" data-testid="learn-view">
      <section className="panel kb-intro">
        <h2>{t('learn', lang)}</h2>
        <p className="kb-lede">{t('learnNote', lang)}</p>
        <p className="kb-counts" data-testid="learn-counts">
          <b>{reviewed}</b> / {CARDS.length} {lang === 'tr' ? 'kart gözden geçirildi' : 'cards reviewed'} ·{' '}
          <b>{queue.due.length}</b> {lang === 'tr' ? 'tekrar zamanı' : 'due'} ·{' '}
          <b>{queue.fresh.length}</b> {lang === 'tr' ? 'yeni' : 'new'} ·{' '}
          {lang === 'tr' ? 'seri' : 'streak'} <b>{progress.streak.current}</b>
        </p>
      </section>

      {current ? (
        <section className="panel learn-card" data-testid="learn-card">
          <p className="learn-layer">{current.layer}</p>
          <h3 data-testid="learn-prompt">{current.prompt[lang]}</h3>
          {revealed ? (
            <>
              <p className="learn-answer" data-testid="learn-answer">
                {current.answer[lang]}
              </p>
              <div className="learn-grades" data-testid="learn-grades">
                {[0, 1, 2, 3, 4, 5].map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="chip"
                    onClick={() => answer(q)}
                    data-testid={`learn-grade-${q}`}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="kb-measure"
                onClick={() => onMeasure(conceptById(current.conceptId).experiment)}
                data-testid="learn-measure"
              >
                {t('measureIt', lang)} · {t('experimentLink', lang)}{' '}
                {experimentById(conceptById(current.conceptId).experiment).title[lang]}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="primary"
              onClick={() => setRevealed(true)}
              data-testid="learn-reveal"
            >
              {t('reveal', lang)}
            </button>
          )}
        </section>
      ) : (
        <section className="panel" data-testid="learn-empty">
          <p>{t('learnDone', lang)}</p>
        </section>
      )}

      <section className="panel learn-reset">
        <p className="kb-lede">{t('learnLocal', lang)}</p>
        <button type="button" className="chip" onClick={reset} data-testid="learn-reset">
          {t('learnReset', lang)}
        </button>
      </section>
    </div>
  );
}

