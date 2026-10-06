import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

function gitCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    // A checkout without history still gets a manifest; the field records that
    // rather than inventing a commit.
    return null;
  }
}

const commit = gitCommit();

/**
 * The release manifest states the scope this application actually has.
 *
 * VIS explains and cites. It has no engine, so it publishes no measurement
 * schema and claims no default compute path: an `engineDefault` field on a
 * surface that cannot run an operator would be a claim nothing in the build
 * could support. The measurement contract belongs to CVL, which publishes its
 * own schema at https://cvl.aserdargun.com/schemas/experiment-run.schema.json.
 */
const release = {
  application: 'vis-knowledge-bank',
  code: 'VIS',
  version: pkg.version,
  commit,
  builtAt: new Date().toISOString(),
  buildSource: 'vite build',
  scope: {
    synthetic: true,
    backend: false,
    telemetry: false,
    account: false,
    measurementEngine: false,
    explains: true,
    cites: true,
    laboratory: 'https://cvl.aserdargun.com/',
  },
};

mkdirSync(dist, { recursive: true });
writeFileSync(path.join(dist, 'release.json'), `${JSON.stringify(release, null, 2)}\n`);

console.log(`release.json written (commit ${commit ?? 'none'})`);