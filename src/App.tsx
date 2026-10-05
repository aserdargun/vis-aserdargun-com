import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EXPERIMENTS, experimentById } from './content/experiments.ts';
import type { ExperimentId } from './content/experiments.ts';
import { t, type Lang } from './content/i18n.ts';
import { ensureWeights, runExperiment } from './engine/pipeline.ts';
import type { ExperimentResult } from './engine/pipeline.ts';
import { probeEngines, toReport } from './engine/selectEngine.ts';
import type { EngineFacts } from './engine/selectEngine.ts';
import { cpuEngine } from './engine/cpuEngine.ts';
import type { Tensor, VisionEngine } from './engine/types.ts';

const DEFAULT_SEED = 42;

function toDataUrl(src: Tensor, colour: (v: number) => [number, number, number]): string {
  const canvas = document.createElement('canvas');
  canvas.width = src.w;
  canvas.height = src.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(src.w, src.h);
  for (let i = 0; i < src.data.length; i += 1) {
    const [r, g, b] = colour(src.data[i]!);
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

const grey: (v: number) => [number, number, number] = (v) => {
  const c = Math.round(Math.max(0, Math.min(1, v)) * 255);
  return [c, c, c];
};
const blue: (v: number) => [number, number, number] = (v) => {
  const a = Math.max(0, Math.min(1, v));
  return [Math.round(30 + a * 40), Math.round(110 + a * 90), Math.round(220 + a * 35)];
};
const amber: (v: number) => [number, number, number] = (v) => {
  const a = Math.max(0, Math.min(1, v));
  return [Math.round(40 + a * 215), Math.round(160 - a * 40), Math.round(200 - a * 150)];
};

function Pane({ src, colour, alt }: { src: Tensor | undefined; colour: (v: number) => [number, number, number]; alt: string }) {
  const url = useMemo(() => (src ? toDataUrl(src, colour) : ''), [src, colour]);
  if (!url) return null;
  return <img className="tensor" src={url} alt={alt} data-testid="tensor" />;
}

function Metric({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className="metric-value" data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState<Lang>('tr');
  const [experimentId, setExperimentId] = useState<ExperimentId>('ground-truth');
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [objects, setObjects] = useState(4);
  const [noise, setNoise] = useState(0.02);
  const [otsuOffset, setOtsuOffset] = useState(0);
  const [depthWeight, setDepthWeight] = useState(0.5);
  const [preferGpu, setPreferGpu] = useState(true);
  const [engine, setEngine] = useState<VisionEngine>(cpuEngine);
  const [facts, setFacts] = useState<EngineFacts | null>(null);
  const [parity, setParity] = useState<{ op: string; maxDiff: number }[]>([]);
  const [delegated, setDelegated] = useState<string[]>([]);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const experiment = experimentById(experimentId);
  const outputRef = useRef<HTMLDivElement>(null);

  // Engine facts are measurements, so they are computed once per GPU choice.
  // Depending on `lang` here would re-run the whole parity comparison — six GPU
  // round-trips — every time the reader switches language, which is measurement
  // work a language change never justifies. The prose is derived separately.
  useEffect(() => {
    let cancelled = false;
    void probeEngines(preferGpu).then((facts) => {
      if (cancelled) return;
      setFacts(facts);
      setEngine(facts.engine);
      setParity(facts.parity);
      setDelegated(facts.delegated);
    });
    return () => {
      cancelled = true;
    };
  }, [preferGpu]);

  // Translated on render, so switching language is free.
  const report = useMemo(() => (facts ? toReport(facts, lang) : null), [facts, lang]);

  const run = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      if (experimentId === 'learned') ensureWeights(seed);
      const r = await runExperiment({ experimentId, sceneSeed: seed, engine, objectCount: objects, noise, otsuOffset, depthWeight });
      setResult(r);
      requestAnimationFrame(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, [experimentId, seed, engine, objects, noise, otsuOffset, depthWeight]);

  // Re-running on mount and on every parameter change keeps the screen honest:
  // no measurement is ever left over from a previous configuration. The run
  // token is stored in state rather than a ref, so a fresh value re-renders and
  // the effect fires exactly once per configuration.
  const [runToken, setRunToken] = useState('');
  useEffect(() => {
    if (runToken === '') return;
    void run();
  }, [runToken, run]);

  useEffect(() => {
    setRunToken(`${experimentId}:${seed}:${objects}:${noise}:${otsuOffset}:${depthWeight}:${engine.id}`);
  }, [experimentId, seed, objects, noise, otsuOffset, depthWeight, engine]);

  const truth = result?.truth;

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
      </header>

      <nav className="experiments" aria-label={t('experiments', lang)}>
        {EXPERIMENTS.map((e) => (
          <button
            key={e.id}
            type="button"
            className={e.id === experimentId ? 'exp exp-active' : 'exp'}
            onClick={() => setExperimentId(e.id)}
            data-testid={`exp-${e.id}`}
          >
            <span className="exp-index">{String(e.index).padStart(2, '0')}</span>
            <span className="exp-title">{e.title[lang]}</span>
          </button>
        ))}
      </nav>

      <main className="main">
        <section className="panel controls">
          <h2>{t('method', lang)}</h2>
          <p className="question" data-testid="question">
            {experiment.question[lang]}
          </p>
          <p className="method-text">{experiment.method[lang]}</p>
          <p className="expectation">
            <strong>{t('expectation', lang)}:</strong> {experiment.expectation[lang]}
          </p>
          <p className="humanoid">
            <strong>{t('humanoid', lang)}:</strong> {experiment.humanoid[lang]}
          </p>

          <div className="knobs">
            <label>
              <span>
                {t('sceneSeed', lang)} <b>{seed}</b>
              </span>
              <input
                type="range"
                min={1}
                max={99}
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
                data-testid="seed"
              />
            </label>
            <label>
              <span>
                {t('objects', lang)} <b>{objects}</b>
              </span>
              <input
                type="range"
                min={2}
                max={6}
                value={objects}
                onChange={(e) => setObjects(Number(e.target.value))}
                data-testid="objects"
              />
            </label>
            <label>
              <span>
                {t('noise', lang)} <b>{noise.toFixed(3)}</b>
              </span>
              <input
                type="range"
                min={0}
                max={0.12}
                step={0.005}
                value={noise}
                onChange={(e) => setNoise(Number(e.target.value))}
              />
            </label>
            <label>
              <span>
                {t('otsuOffset', lang)} <b>{otsuOffset.toFixed(3)}</b>
              </span>
              <input
                type="range"
                min={-0.15}
                max={0.15}
                step={0.005}
                value={otsuOffset}
                onChange={(e) => setOtsuOffset(Number(e.target.value))}
              />
            </label>
            <label>
              <span>
                {t('depthWeight', lang)} <b>{Math.round(depthWeight * 100)}%</b>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={depthWeight}
                onChange={(e) => setDepthWeight(Number(e.target.value))}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={preferGpu}
                onChange={(e) => setPreferGpu(e.target.checked)}
                data-testid="prefer-gpu"
              />
              <span>{t('preferGpu', lang)}</span>
            </label>
          </div>

          <div className="actions">
            <button type="button" className="primary" onClick={() => void run()} disabled={busy} data-testid="run">
              {busy ? t('running', lang) : t('run', lang)}
            </button>
            <button type="button" onClick={() => setSeed((s) => (s >= 99 ? 1 : s + 1))} data-testid="new-scene">
              {t('resetScene', lang)}
            </button>
          </div>
          {error && (
            <p className="error" role="alert" data-testid="error">
              {error}
            </p>
          )}
        </section>

        <section className="panel engine" data-testid="engine-panel">
          <h2>{t('engine', lang)}</h2>
          <p className="engine-id" data-testid="engine-id">
            {report?.describe ?? cpuEngine.describe}
          </p>
          {report && (
            <ul className="probe" data-testid="probe">
              <li>
                secure context: <b>{String(report.secureContext)}</b>
              </li>
              <li>
                navigator.gpu: <b>{String(report.navigatorGpu)}</b>
              </li>
              <li>
                adapter: <b data-testid="probe-adapter">{String(report.adapter)}</b>
              </li>
              {report.adapter && (
                <>
                  <li>
                    vendor: <b>{report.vendor || '—'}</b>
                  </li>
                  <li>
                    architecture: <b>{report.architecture || '—'}</b>
                  </li>
                </>
              )}
            </ul>
          )}
          <p className="engine-note">{report?.detail[lang] ?? ''}</p>

          {parity.length > 0 && (
            <div className="parity" data-testid="parity">
              <h3>{lang === 'tr' ? 'CPU / GPU uyumu' : 'CPU / GPU agreement'}</h3>
              <ul>
                {parity.map((p) => (
                  <li key={p.op}>
                    <code>{p.op}</code> <b>{p.maxDiff.toExponential(2)}</b>
                  </li>
                ))}
              </ul>
              <p className="parity-note">
                {lang === 'tr'
                  ? 'GPU f32, CPU f64 biriktirir. Küçük fark beklenir; büyük fark bir hata işaretidir.'
                  : 'The GPU accumulates f32, the CPU f64. A small difference is expected; a large one signals a bug.'}
              </p>
            </div>
          )}

          {delegated.length > 0 && (
            <div className="parity" data-testid="delegated">
              <h3>{lang === 'tr' ? 'CPU yolunda çalışan işlemler' : 'Operators running on the CPU path'}</h3>
              <p className="parity-note">
                <code>{delegated.join(', ')}</code>
              </p>
            </div>
          )}
        </section>

        <section className="panel stage" ref={outputRef}>
          <h2>{t('output', lang)}</h2>
          <div className="panes">
            <figure>
              <figcaption>{t('truth', lang)}</figcaption>
              <Pane src={truth} colour={amber} alt={t('truth', lang)} />
            </figure>
            <figure>
              <figcaption>{result?.stage.label ?? '—'}</figcaption>
              <Pane src={result?.stage.mask} colour={blue} alt={result?.stage.label ?? 'output'} />
            </figure>
            {result?.stage2 && (
              <figure>
                <figcaption>{result.stage2.label}</figcaption>
                <Pane src={result.stage2.mask} colour={grey} alt={result.stage2.label} />
              </figure>
            )}
          </div>
          <p className="synthetic" data-testid="synthetic-notice">
            {t('syntheticNotice', lang)} {t('noBackend', lang)}
          </p>
        </section>

        <section className="panel metrics" data-testid="metrics">
          <h2>{t('results', lang)}</h2>
          {result ? (
            <>
              <div className="metric-grid">
                <Metric label={t('iou', lang)} value={result.iou.toFixed(4)} testId="metric-iou" />
                <Metric label={t('accuracy', lang)} value={result.accuracy.toFixed(4)} />
                <Metric label={t('mae', lang)} value={result.mae.toFixed(4)} />
                {result.edgeRecall !== undefined && <Metric label={t('edgeRecall', lang)} value={result.edgeRecall.toFixed(4)} />}
              </div>

              {result.detection && (
                <div className="detection" data-testid="detection">
                  <h3>{t('detection', lang)}</h3>
                  <ul>
                    <li>
                      {t('precision', lang)}: <b>{result.detection.precision.toFixed(4)}</b>
                    </li>
                    <li>
                      {t('recall', lang)}: <b>{result.detection.recall.toFixed(4)}</b>
                    </li>
                    <li>
                      mean IoU: <b>{result.detection.meanIou.toFixed(4)}</b>
                    </li>
                    <li>
                      {t('falsePositives', lang)}: <b>{result.detection.falsePositives}</b>
                    </li>
                    <li>
                      {t('falseNegatives', lang)}: <b>{result.detection.falseNegatives}</b>
                    </li>
                  </ul>
                </div>
              )}

              {result.stage2 && (
                <div className="compare" data-testid="compare">
                  <h3>{t('compared', lang)}</h3>
                  <p>
                    {result.stage.label} → IoU <b>{result.iou.toFixed(4)}</b>
                  </p>
                  <p>
                    {result.stage2.label} → {Object.entries(result.extra)
                      .filter(([k]) => k.endsWith('Iou'))
                      .map(([k, v]) => `${k} ${Number(v).toFixed(4)}`)
                      .join(' · ') || '—'}
                  </p>
                </div>
              )}

              {Object.keys(result.extra).length > 0 && (
                <div className="extra" data-testid="extra">
                  <h3>Ölçümler · Measurements</h3>
                  <ul>
                    {Object.entries(result.extra).map(([k, v]) => (
                      <li key={k}>
                        <code>{k}</code> <b>{String(v)}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.perClass.length > 0 && (
                <div className="perclass" data-testid="per-class">
                  <h3>{t('perClass', lang)}</h3>
                  <ul>
                    {result.perClass.map((c) => (
                      <li key={c.label}>
                        #{c.label}: <b>{c.iou.toFixed(4)}</b> ({c.pixels} px)
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="notes" data-testid="notes">
                <h3>{t('notes', lang)}</h3>
                <ul>
                  {result.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p>{busy ? t('running', lang) : t('run', lang)}</p>
          )}
        </section>
      </main>

      <footer className="footer">
        <p>{t('footerNote', lang)}</p>
        <p>
          <a href="https://aserdargun.com/tr/" target="_blank" rel="noreferrer">
            aserdargun.com
          </a>
          {' · '}
          <a href="https://eng.aserdargun.com/" target="_blank" rel="noreferrer">
            ENG
          </a>
          {' · '}
          <a href="https://hex.aserdargun.com/" target="_blank" rel="noreferrer">
            HEX
          </a>
        </p>
      </footer>
    </div>
  );
}
