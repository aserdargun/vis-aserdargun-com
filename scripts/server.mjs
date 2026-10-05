import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const state = path.join(root, '.local');
const pidFile = path.join(state, 'server.json');
const port = 8062;

function listeners() {
  try {
    return execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(Number);
  } catch {
    return [];
  }
}

/** A PID is only ours when its cwd is this checkout and it is running vite. */
function owned(pid) {
  try {
    const cwd = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8' })
      .split('\n')
      .find((x) => x.startsWith('n'))
      ?.slice(1);
    const args = execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
    return cwd === root && args.includes('vite');
  } catch {
    return false;
  }
}

if (process.argv[2] === 'stop') {
  if (!existsSync(pidFile)) {
    console.log('No managed VIS server to stop.');
    process.exit(0);
  }
  const { pid } = JSON.parse(readFileSync(pidFile, 'utf8'));
  if (!owned(pid)) {
    console.error('Refusing to stop: PID/cwd do not identify this VIS checkout.');
    process.exit(1);
  }
  process.kill(pid, 'SIGTERM');
  unlinkSync(pidFile);
  console.log(`Stopped VIS PID ${pid}.`);
} else {
  const taken = listeners();
  if (taken.length > 0) {
    console.error(`Port ${port} is already in use by PID ${taken.join(', ')}. Close it or use --port; this launcher never stops another checkout.`);
    process.exit(1);
  }
  mkdirSync(state, { recursive: true });
  const out = path.join(state, 'server.log');
  const child = spawn('npm', ['run', 'dev'], { cwd: root, detached: true, stdio: ['ignore', out, out] });
  child.unref();
  writeFileSync(pidFile, `${JSON.stringify({ pid: child.pid, port, cwd: root }, null, 2)}\n`);
  console.log(`VIS starting on http://127.0.0.1:${port} (PID ${child.pid}). Log: ${out}`);
}
