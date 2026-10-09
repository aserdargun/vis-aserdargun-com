import { useEffect } from 'react';
import { CONCEPTS, LAYERS, SOURCES, conceptsInLayer, sourceById } from './content/library.ts';
import type { LayerId } from './content/library.ts';
import { measureLink } from './content/laboratory-link.ts';
import type { LaboratoryLayer } from './content/laboratory-link.ts';
import { t, type Lang } from './content/i18n.ts';

/**
 * The knowledge bank surface.
 *
 * It renders prose and sources. It never renders a measurement, because this
 * file has no access to an engine — a number here could not be recomputed by
 * the reader, and the point of this application is that claims can be checked.
 *
 * The cross-link into the laboratory is the part that keeps it honest: a
 * concept is only worth stating if the reader can go and watch the same idea
 * fail, succeed or become ambiguous against a synthetic answer key. That
 * measurement lives in CVL, so the link leaves this application.
 */

function SourceList({ ids, lang }: { ids: readonly string[]; lang: Lang }) {
  return (
    <ul className="kb-sources" data-testid={`kb-sources-${ids[0]}`}>
      {ids.map((id) => {
        const source = sourceById(id);
        return (
          <li key={id}>
            <a href={source.url} target="_blank" rel="noreferrer" data-testid={`kb-source-${id}`}>
              {source.title}
            </a>
            <span className="kb-source-meta">
              {source.author} · {source.year} · {source.publisher}
            </span>
            <span className="kb-source-supports">{source.supports[lang]}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function KnowledgeBank({ lang }: { lang: Lang }) {
  // A deep link from the laboratory arrives as `#katman-<layer>`. This surface is
  // rendered by script, so the browser resolves the fragment before these sections
  // exist and would silently leave the reader at the top of the page. Honouring the
  // fragment after render is what turns the declared link into a working one.
  useEffect(() => {
    const reveal = () => {
      const id = window.location.hash.slice(1);
      if (!id.startsWith('katman-')) return;
      const target = document.getElementById(id);
      if (!target) return;
      target.scrollIntoView();
      // A keyboard or screen-reader reader must land on the layer, not only see it
      // scrolled into place, so the heading takes focus with the scroll.
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    };
    reveal();
    window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, [lang]);

  return (
    <div className="kb" data-testid="knowledge-bank">
      <section className="panel kb-intro">
        <h2>{t('knowledge', lang)}</h2>
        <p className="kb-lede">{t('sourceNote', lang)}</p>
        <p className="kb-counts" data-testid="kb-counts">
          <b>{LAYERS.length}</b> {lang === 'tr' ? 'katman' : 'layers'} · <b>{CONCEPTS.length}</b>{' '}
          {lang === 'tr' ? 'kavram' : 'concepts'} · <b>{SOURCES.length}</b> {lang === 'tr' ? 'kaynak' : 'sources'}
        </p>
      </section>

      {LAYERS.map((layer) => {
        const concepts = conceptsInLayer(layer.id);
        const builtOn = layer.dependsOn.map((id) => LAYERS.find((l) => l.id === id)?.title[lang] ?? id);
        return (
          <section
            className="panel kb-layer"
            key={layer.id}
            // The reciprocal half of the boundary contract: every CVL layer links
            // here as `vis.aserdargun.com/#katman-<layer>`, so each layer must
            // actually carry that id. Without it the link lands on the top of the
            // page and the reader is never shown the reading they asked for.
            id={`katman-${layer.id}`}
            data-testid={`kb-layer-${layer.id}`}
          >
            <header className="kb-layer-head">
              <span className="kb-layer-index">{String(layer.order).padStart(2, '0')}</span>
              <h2>{layer.title[lang]}</h2>
            </header>

            <dl className="kb-layer-meta">
              <div>
                <dt>{t('responsibility', lang)}</dt>
                <dd>{layer.responsibility[lang]}</dd>
              </div>
              <div className="kb-boundary">
                <dt>{t('notFor', lang)}</dt>
                <dd>{layer.notFor[lang]}</dd>
              </div>
              {builtOn.length > 0 && (
                <div>
                  <dt>{t('buildsOn', lang)}</dt>
                  <dd>
                    {builtOn.map((title, i) => (
                      <span key={title}>
                        {i > 0 && ' · '}
                        {title}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>

            <div className="kb-concepts">
              <h3>{t('concepts', lang)}</h3>
              <ul>
                {concepts.map((concept) => (
                  <li className="kb-concept" key={concept.id} data-testid={`kb-concept-${concept.id}`}>
                    <h4>{concept.term[lang]}</h4>
                    <p>{concept.summary[lang]}</p>
                    <a
                      className="kb-measure"
                      href={measureLink(concept.measures)}
                      target="_blank"
                      rel="noreferrer"
                      data-testid={`kb-measure-${concept.id}`}
                    >
                      {t('measureIt', lang)} · {t('laboratoryLink', lang)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="kb-layer-sources">
              <h3>{t('sources', lang)}</h3>
              <SourceList ids={layer.sourceIds} lang={lang} />
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Every concept names a laboratory layer, and every knowledge layer holds a concept. */
export function libraryCoverage(): { layers: LaboratoryLayer[]; unreferenced: LayerId[] } {
  const used = new Set(CONCEPTS.map((c) => c.measures));
  const unreferenced = LAYERS.filter((l) => conceptsInLayer(l.id).length === 0).map((l) => l.id);
  return { layers: [...used], unreferenced };
}
