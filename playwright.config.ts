import { defineConfig } from '@playwright/test';

const preview = process.env.VIS_PREVIEW === '1';
const remoteURL = process.env.VIS_BASE_URL;
const baseURL = remoteURL || `http://127.0.0.1:${preview ? 8063 : 8062}`;

// Without these flags Playwright's bundled Chromium exposes `navigator.gpu` but
// `requestAdapter()` resolves to null. The GPU suite would then silently skip
// while still reporting green, so the flags are mandatory, not an optimisation.
const webgpuArgs = ['--enable-unsafe-webgpu', '--use-angle=metal'];

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 45000,
  expect: { timeout: 15000 },
  fullyParallel: true,
  workers: 3,
  reporter: 'list',
  use: {
    baseURL,
    viewport: { width: 1440, height: 1024 },
    headless: true,
    screenshot: 'only-on-failure',
  },
  // `gpu.spec.ts` only ever runs in the webgpu project. Leaving it in the cpu
  // project would make it assert against a browser that was launched without
  // the WebGPU flags, where requestAdapter() is null by design.
  projects: [
    {
      name: 'cpu',
      use: { browserName: 'chromium' },
      testMatch: /browser\.spec\.ts$/,
    },
    {
      // Real adapter or an explicit failure — never a silent skip.
      name: 'webgpu',
      use: { browserName: 'chromium', launchOptions: { args: webgpuArgs } },
      testMatch: /gpu\.spec\.ts$/,
    },
  ],
  webServer: remoteURL
    ? undefined
    : {
        command: preview ? 'npm run preview' : 'npm run dev',
        url: baseURL,
        // A server left by another checkout would silently serve stale code and
        // the suite would pass against the wrong build. Fail loudly instead.
        reuseExistingServer: false,
      },
});
