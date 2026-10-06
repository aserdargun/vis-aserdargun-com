import { useMemo, useState } from 'react';
import { t, type Lang } from './content/i18n.ts';
import { KnowledgeBank } from './KnowledgeBank.tsx';
import { LearnView } from './LearnView.tsx';

/**
 * VIS explains. CVL measures.
 *
 * This application holds the prose, the primary sources and the review deck.
 * It has no engine, no scene and no metrics: a number it could not recompute in
 * front of the reader would be a claim rather than a measurement, and the whole
 * point of this surface is that a claim can be checked — by following the link
 * into the laboratory at https://cvl.aserdargun.com/, where the same idea is
 * measured against a synthetic answer key.
 *
 * There is deliberately no third view. The laboratory used to live here as a
 * copy of CVL; two copies of a measurement is one more thing that can drift out
 * of step with the answer key, and the reader would have had no way to tell
 * which copy was reporting.
 */

type View = 'knowledge' | 'learn';

const VIEWS: readonly View[] = ['knowledge', 'learn'];

export default function App() {
  const [lang, setLang] = useState<Lang>('tr');
  const [view, setView] = useState<View>('knowledge');

  const views = useMemo(() => VIEWS, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">VIS</span>
          <span className="brand-text">
            <strong>{t('appName', lang)}</strong>
            <span>{t('tagline', lang)}</span>
          </span>
        </div>
        <div className="topbar-side">
          <nav className="view-switch" aria-label={t('knowledge', lang)}>
            {views.map((v) => (
              <button
                key={v}
                type="button"
                className={view === v ? 'chip chip-active' : 'chip'}
                onClick={() => setView(v)}
                aria-pressed={view === v}
                data-testid={`view-${v}`}
              >
                {t(v === 'knowledge' ? 'knowledge' : 'learn', lang)}
              </button>
            ))}
          </nav>
          <div className="lang-switch" role="group" aria-label={lang === 'tr' ? 'Dil seçimi' : 'Language'}>
            {(['tr', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                className={lang === l ? 'chip chip-active' : 'chip'}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                data-testid={`lang-${l}`}
                lang={l}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      {view === 'knowledge' ? <KnowledgeBank lang={lang} /> : <LearnView lang={lang} />}

      <footer className="footer">
        <p>{t('footerNote', lang)}</p>
        <p>
          <a href="https://aserdargun.com/tr/" target="_blank" rel="noreferrer">
            aserdargun.com
          </a>
          {' · '}
          <a href="https://cvl.aserdargun.com/" target="_blank" rel="noreferrer">
            CVL
          </a>
          {' · '}
          <a href="https://llm.aserdargun.com/" target="_blank" rel="noreferrer">
            LLM
          </a>
          {' · '}
          <a href="https://eng.aserdargun.com/" target="_blank" rel="noreferrer">
            ENG
          </a>
        </p>
      </footer>
    </div>
  );
}