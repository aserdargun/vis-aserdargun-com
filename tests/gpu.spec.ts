import { expect, test } from '@playwright/test';

/**
 * GPU path verification.
 *
 * This project runs in the `webgpu` Playwright project, which launches Chromium
 * with `--enable-unsafe-webgpu --use-angle=metal`. Without those flags
 * `requestAdapter()` resolves to null, and every assertion below would be
 * asserting against a fallback that is not the code under test.
 */

const PROBE = async () => {
  const out: Record<string, unknown> = {
    secureContext: window.isSecureContext,
    hasNavigatorGpu: !!navigator.gpu,
  };
  if (!navigator.gpu) return out;
  const adapter = await navigator.gpu.requestAdapter();
  out.adapter = !!adapter;
  if (adapter) {
    out.vendor = adapter.info?.vendor ?? '';
    out.architecture = adapter.info?.architecture ?? '';
    const device = await adapter.requestDevice();
    out.device = !!device;
  }
  return out;
};

test('WebGPU is reachable in this browser context', async ({ page }) => {
  await page.goto('/');
  const probe = await page.evaluate(PROBE);

  // Fail loudly rather than skipping. A silent skip here is exactly the trap
  // this file exists to prevent: the suite reports green while the GPU path
  // never executed.
  expect(probe.secureContext, 'tests must run on a secure context (https or localhost)').toBe(true);
  expect(probe.hasNavigatorGpu, 'navigator.gpu missing — the webgpu launch args are missing').toBe(true);
  expect(
    probe.adapter,
    'requestAdapter() returned null — add --enable-unsafe-webgpu and --use-angle=metal to playwright.config.ts',
  ).toBe(true);
  expect(probe.device, 'requestDevice() failed').toBe(true);
});

test('runs a real compute shader end to end', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const adapter = await navigator.gpu!.requestAdapter();
    const device = await adapter!.requestDevice();
    const N = 64;
    const code = `
      @group(0) @binding(0) var<storage, read_write> data: array<f32>;
      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
        let i = gid.x;
        if (i < ${N}u) { data[i] = f32(i) * f32(i); }
      }`;
    const module = device.createShaderModule({ code });
    const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
    const buffer = device.createBuffer({ size: N * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const read = device.createBuffer({ size: N * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const bind = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer } }],
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bind);
    pass.dispatchWorkgroups(1);
    pass.end();
    encoder.copyBufferToBuffer(buffer, 0, read, 0, N * 4);
    device.queue.submit([encoder.finish()]);
    await read.mapAsync(GPUMapMode.READ);
    const out = Array.from(new Float32Array(read.getMappedRange()).slice(0, 8));
    return { architecture: adapter!.info?.architecture, out };
  });

  expect(result.architecture).toBeTruthy();
  expect(result.out).toEqual([0, 1, 4, 9, 16, 25, 36, 49]);
});

test('the interface selects the GPU engine and says so', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('prefer-gpu')).toBeChecked();
  const engine = page.getByTestId('engine-panel');
  await expect(engine).toBeVisible();

  // The probe panel must report the adapter, and the engine id must be webgpu.
  await expect(page.getByTestId('probe-adapter')).toHaveText('true', { timeout: 20000 });
  await expect(page.getByTestId('engine-id')).toContainText('WebGPU', { timeout: 20000 });
});

test('CPU and GPU agree within float tolerance', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('probe-adapter')).toHaveText('true', { timeout: 20000 });

  // The module paths are held in variables so the assertion compares the modules
  // the interface actually loads, without the test file importing them itself.
  const parity = await page.evaluate(async () => {
    const engineDir = '/src/engine/';
    const cpu = (await import(/* @vite-ignore */ `${engineDir}cpuEngine.ts`)) as {
      runCpuOp: (op: string, input: unknown, params?: Record<string, number>) => Promise<{ data: Float32Array }>;
    };
    const gpuMod = (await import(/* @vite-ignore */ `${engineDir}gpuEngine.ts`)) as {
      WebGpuEngine: { create: () => Promise<null | { describe: string; run: (op: string, input: unknown, params?: Record<string, number>) => Promise<{ data: Float32Array }> }> };
    };
    const sceneMod = (await import(/* @vite-ignore */ `${engineDir}scene.ts`)) as {
      buildScene: (o: { seed: number }) => { image: unknown };
    };
    const scene = sceneMod.buildScene({ seed: 42 });
    const gpu = await gpuMod.WebGpuEngine.create();
    if (!gpu) return { ok: false, describe: '', maxDiff: {} as Record<string, number> };
    const out: Record<string, number> = {};
    for (const op of ['gaussian', 'sobel', 'threshold', 'convolve']) {
      const params: Record<string, number> = op === 'threshold' ? { level: 0.5 } : {};
      const a = await cpu.runCpuOp(op, scene.image, params);
      const b = await gpu.run(op, scene.image, params);
      let maxDiff = 0;
      for (let i = 0; i < a.data.length; i += 1) {
        maxDiff = Math.max(maxDiff, Math.abs(a.data[i]! - b.data[i]!));
      }
      out[op] = maxDiff;
    }
    return { ok: true, describe: gpu.describe, maxDiff: out };
  });

  expect(parity.ok).toBe(true);
  const diffs = parity.maxDiff;
  // f32 on the GPU against f64 accumulation in JS: agreement must be close but
  // not bit-exact. 1e-3 is a measurement tolerance, not a rounding allowance.
  for (const [op, value] of Object.entries(diffs)) {
    expect(value, `${op} diverged between engines`).toBeLessThan(1e-3);
  }
});
