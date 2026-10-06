import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.VIS_BASE_URL;
const expected = process.env.EXPECTED_COMMIT;

if (!base) {
  console.error('VIS_BASE_URL is required.');
  process.exit(1);
}

const fail = (message) => {
  console.error(`FAIL ${message}`);
  process.exit(1);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { redirect: 'follow' });
  return res;
}

async function readRelease(retries = 13) {
  // A valid manifest reporting the previous commit right after upload is a
  // propagation delay, not a failed release. An old commit is never accepted:
  // either the new one appears within the window or the release fails.
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const res = await get(`${base.replace(/\/$/, '')}/release.json`);
    if (res.status !== 200) fail(`release.json returned ${res.status}`);
    if ((res.headers.get('cache-control') ?? '').includes('no-store')) {
      const text = await res.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        fail('release.json is not valid JSON.');
      }
      if (parsed.application !== 'vis-knowledge-bank') fail('release.json names the wrong application.');
      if (!expected) return parsed;
      if (parsed.commit === expected) return parsed;
      console.log(`  attempt ${attempt}/${retries}: live commit ${parsed.commit} is not ${expected}`);
      await sleep(5000);
      continue;
    }
    fail(`release.json must be served no-store, got "${res.headers.get('cache-control') ?? 'none'}".`);
  }
  if (expected) fail(`live commit never reached ${expected} within the propagation window.`);
  return null;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const local = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

const manifest = await readRelease();
console.log(`live release: ${manifest.version} @ ${manifest.commit ?? 'no commit'}`);

const home = await get(base);
if (home.status !== 200) fail(`root returned ${home.status}`);
const html = await home.text();
if (!html.includes('VIS')) fail('root HTML does not name the application.');
if (!html.includes('https://vis.aserdargun.com/')) fail('root HTML has no canonical address.');

if (!(home.headers.get('content-security-policy') ?? '').includes("default-src 'self'")) {
  fail('root response has no Content-Security-Policy.');
}
if (home.headers.get('x-content-type-options') !== 'nosniff') fail('root response has no nosniff.');

const assetMatch = html.match(/src="(\/assets\/[^"]+\.js)"/);
if (!assetMatch) fail('root HTML references no hashed script.');
const asset = await get(`${base.replace(/\/$/, '')}${assetMatch[1]}`);
if (asset.status !== 200) fail(`script ${assetMatch[1]} returned ${asset.status}`);
if (!(asset.headers.get('cache-control') ?? '').includes('immutable')) {
  fail('hashed assets must be immutable.');
}

// Static Web Apps consumes public/staticwebapp.config.json as its own routing
// input and does not serve it. A 404 here is the expected, healthy result; a
// 200 would mean the config is also being published as content.
const swaConfig = await get(`${base.replace(/\/$/, '')}/staticwebapp.config.json`);
if (swaConfig.status !== 404) {
  fail(`staticwebapp.config.json should be consumed, not served (got ${swaConfig.status})`);
}

// VIS publishes no measurement schema: it explains and cites, and the operator
// results it would describe belong to CVL. A 404 here is the expected result;
// a 200 would mean a measurement contract has crept back into this surface.
const schema = await get(`${base.replace(/\/$/, '')}/schemas/experiment-run.schema.json`);
if (schema.status !== 404) {
  fail(`VIS must not publish a measurement schema (got ${schema.status})`);
}

const robots = await get(`${base.replace(/\/$/, '')}/robots.txt`);
if (robots.status === 200) {
  const text = await robots.text();
  if (!/Sitemap:/.test(text)) fail('robots.txt has no sitemap directive.');
}

console.log(`live verification passed against ${base} (package ${local.name} ${local.version}).`);
