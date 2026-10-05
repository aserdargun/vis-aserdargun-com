import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const release = {
  application: 'vis-vision-laboratory',
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
    engineDefault: 'cpu',
    engineOptional: 'webgpu',
  },
};

mkdirSync(dist, { recursive: true });
writeFileSync(path.join(dist, 'release.json'), `${JSON.stringify(release, null, 2)}\n`);

// The schema is canonical in schemas/ and published alongside the app, so a
// recorded result can be validated against the contract it was measured under.
mkdirSync(path.join(dist, 'schemas'), { recursive: true });
copyFileSync(
  path.join(root, 'schemas', 'experiment-run.schema.json'),
  path.join(dist, 'schemas', 'experiment-run.schema.json'),
);

console.log(`release.json written (commit ${commit ?? 'none'})`);
