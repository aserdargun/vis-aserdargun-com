import { CONCEPTS, LAYERS, SOURCES, conceptsInLayer, sourceById } from './content/library.ts';
import type { LayerId } from './content/library.ts';
import { experimentById } from './content/experiments.ts';
import type { ExperimentId } from './content/experiments.ts';
import { t, type Lang, type UiKey } from './content/i18n.ts';

/**
 * The knowledge bank surface.
 *
 * It renders prose and sources. It never renders a measurement, because this
 * file has no access to an engine — a number here could not be recomputed by
 * the reader, and the whole point of the application is that numbers can be.
 *
 * The cross-link into the laboratory is the part that keeps the two honest: a
 * concept is only useful here if the reader can go and watch the same idea
 * fail, succeed or become ambiguous against a synthetic answer key.
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

export function KnowledgeBank({
  lang,
  onMeasure,
}: {
  lang: Lang;
  onMeasure: (experimentId: ExperimentId) => void;
}) {
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
          <section className="panel kb-layer" key={layer.id} data-testid={`kb-layer-${layer.id}`}>
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
                {concepts.map((concept) => {
                  const experiment = experimentById(concept.experiment);
                  return (
                    <li className="kb-concept" key={concept.id} data-testid={`kb-concept-${concept.id}`}>
                      <h4>{concept.term[lang]}</h4>
                      <p>{concept.summary[lang]}</p>
                      <button
                        type="button"
                        className="kb-measure"
                        onClick={() => onMeasure(concept.experiment)}
                        data-testid={`kb-measure-${concept.id}`}
                      >
                        {t('measureIt', lang)} · {t('experimentLink', lang)} {experiment.index}:{' '}
                        {experiment.title[lang]}
                      </button>
                    </li>
                  );
                })}
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

/** Every concept is reachable from at least one experiment, and vice versa. */
export function libraryCoverage(): { experiments: ExperimentId[]; unreferenced: LayerId[] } {
  const used = new Set(CONCEPTS.map((c) => c.experiment));
  const unreferenced = LAYERS.filter((l) => conceptsInLayer(l.id).length === 0).map((l) => l.id);
  return { experiments: [...used], unreferenced };
}

export type { UiKey };
