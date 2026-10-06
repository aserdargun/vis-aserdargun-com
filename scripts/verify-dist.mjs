import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

const fail = (message) => {
  console.error(`FAIL ${message}`);
  process.exit(1);
};

if (!existsSync(dist)) fail('dist/ is missing — the build did not run.');

const required = [
  'index.html',
  'release.json',
  'favicon.svg',
  'favicon-32.png',
  'apple-touch-icon.png',
  'staticwebapp.config.json',
  'robots.txt',
  'sitemap.xml',
];
for (const file of required) {
  if (!existsSync(path.join(dist, file))) fail(`dist/${file} is missing.`);
}

const release = JSON.parse(readFileSync(path.join(dist, 'release.json'), 'utf8'));
if (release.application !== 'vis-knowledge-bank') fail('release.json names the wrong application.');
if (release.scope?.synthetic !== true) fail('release.json must record the synthetic scope.');
if (release.scope?.backend !== false) fail('release.json must record that there is no backend.');
// VIS explains. A measurement engine in this build would be the laboratory
// creeping back in, which is the drift this split exists to prevent.
if (release.scope?.measurementEngine !== false) fail('release.json must record that there is no measurement engine.');
if (!release.builtAt) fail('release.json has no build timestamp.');

const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
if (!html.includes('<div id="root">')) fail('index.html has no root element.');
if (!html.includes('VIS')) fail('index.html does not name the application.');
if (!/lang="tr"/.test(html)) fail('index.html must declare a language.');
if (!html.includes('https://vis.aserdargun.com/')) fail('index.html has no canonical address.');

const assets = path.join(dist, 'assets');
if (!existsSync(assets)) fail('dist/assets is missing.');
const js = readdirSync(assets).filter((f) => f.endsWith('.js'));
const css = readdirSync(assets).filter((f) => f.endsWith('.css'));
if (js.length === 0) fail('no hashed JavaScript bundle in dist/assets.');
if (css.length === 0) fail('no hashed CSS bundle in dist/assets.');
if (!js.some((f) => /-[A-Za-z0-9_-]{8,}\.js$/.test(f))) fail('JavaScript bundle is not content-hashed.');

// VIS publishes no measurement schema: it has no operator to describe and no
// answer key to compare against. The schema belongs to CVL.
if (existsSync(path.join(dist, 'schemas'))) fail('VIS must not publish a measurement schema.')

const swa = JSON.parse(readFileSync(path.join(dist, 'staticwebapp.config.json'), 'utf8'));
if (!swa.globalHeaders?.['Content-Security-Policy']) fail('no Content-Security-Policy header.');
if (!swa.globalHeaders?.['X-Content-Type-Options']) fail('no X-Content-Type-Options header.');
if (!swa.routes?.some((r) => r.route === '/release.json' && r.headers?.['Cache-Control'] === 'no-store')) {
  fail('release.json must be served with no-store.');
}

// Nothing in the published artifact may reach for a backend or a real camera.
const suspicious = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(js|html|css|json)$/.test(entry)) {
      const text = readFileSync(full, 'utf8');
      for (const needle of ['http://', 'https://api.', 'XMLHttpRequest', 'navigator.mediaDevices']) {
        if (text.includes(needle) && !/aserdargun\.com|eng\.aserdargun|hex\.aserdargun|cvl\.aserdargun/.test(text)) {
          suspicious.push(`${path.relative(dist, full)} → ${needle}`);
        }
      }
    }
  }
};
walk(dist);
if (suspicious.length > 0) {
  console.error('FAIL the published artifact references external services:');
  for (const s of suspicious) console.error(`  ${s}`);
  process.exit(1);
}

console.log(`dist verified: ${required.length} required files, ${js.length} js / ${css.length} css bundles, no external calls.`);
