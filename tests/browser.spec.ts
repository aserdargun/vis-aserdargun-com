import { expect, test } from '@playwright/test';

test('renders the laboratory with all eight experiments', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('tensor').first()).toBeVisible({ timeout: 20000 });
  for (const id of [
    'ground-truth',
    'edges',
    'regions',
    'lines',
    'learned',
    'depth',
    'motion',
    'domain-gap',
  ]) {
    await expect(page.getByTestId(`exp-${id}`)).toBeVisible();
  }
});

test('the answer key experiment measures exactly 1.0', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('metric-iou')).toHaveText('1.0000', { timeout: 20000 });
  await expect(page.getByTestId('metric-iou')).toHaveText('1.0000');
});

test('every experiment produces a measurement', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('metric-iou')).toBeVisible({ timeout: 20000 });
  for (const id of ['edges', 'regions', 'lines', 'learned', 'depth', 'motion', 'domain-gap']) {
    await page.getByTestId(`exp-${id}`).click();
    await expect(page.getByTestId('metrics')).toContainText('IoU', { timeout: 30000 });
    await expect(page.getByTestId('notes')).toBeVisible();
    const value = await page.getByTestId('metric-iou').textContent();
    expect(value, `${id} reported no IoU`).toMatch(/^0\.\d{4}$/);
  }
});

test('the learned experiment reports both paths and a difference', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('exp-learned').click();
  const extra = page.getByTestId('extra');
  await expect(extra).toContainText('learnedIou', { timeout: 40000 });
  await expect(extra).toContainText('handcraftedIou');
  await expect(extra).toContainText('difference');
  await expect(extra).toContainText('trainingLoss');
});

test('changing the seed changes the measurement', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('exp-regions').click();
  await expect(page.getByTestId('extra')).toContainText('otsuLevel', { timeout: 20000 });
  const before = await page.getByTestId('extra').textContent();
  // Advance the seed slider: a click on the button cycles it, and the effect
  // must re-run with the new scene rather than keep the previous numbers.
  await page.getByTestId('seed').fill('77');
  await expect
    .poll(async () => page.getByTestId('extra').textContent(), { timeout: 20000 })
    .not.toBe(before);
  await expect(page.getByTestId('extra')).toContainText('otsuLevel');
});

test('declines the synthetic-data scope in both languages', async ({ page }) => {
  await page.goto('/');
  const notice = page.getByTestId('synthetic-notice');
  await expect(notice).toContainText('sentetik', { timeout: 20000 });
  await expect(notice).toContainText('Backend yok');
  await page.getByTestId('lang-en').click();
  await expect(notice).toContainText('synthetic');
  await expect(notice).toContainText('No backend');
});

test('switches the whole laboratory between Turkish and English', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('question')).toContainText('?', { timeout: 20000 });
  await page.getByTestId('lang-en').click();
  await expect(page.getByTestId('exp-edges')).toContainText('Edge, or noise');
  await page.getByTestId('lang-tr').click();
  await expect(page.getByTestId('exp-edges')).toContainText('Kenar mı');
});

test('the CPU path is selectable and remains fully measured', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('metric-iou')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('prefer-gpu').uncheck();
  await expect(page.getByTestId('engine-id')).toContainText('CPU', { timeout: 20000 });
  await page.getByTestId('exp-regions').click();
  await expect(page.getByTestId('detection')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('metric-iou')).toHaveText(/^0\.\d{4}$/);
});

test('reports the depth cue correlations instead of asserting a distance', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('exp-depth').click();
  const extra = page.getByTestId('extra');
  await expect(extra).toContainText('sizeRho', { timeout: 20000 });
  await expect(extra).toContainText('groundPlaneRho');
  await expect(extra).toContainText('meanShadowContact');
  await expect(page.getByTestId('notes')).toContainText('Derinlik sensörü yok');
});

test('recovers the injected motion shift', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('exp-motion').click();
  const extra = page.getByTestId('extra');
  await expect(extra).toContainText('injectedShift', { timeout: 20000 });
  await expect(extra).toContainText('meanFlowX');
  await expect(page.getByTestId('compare')).toBeVisible();
});

test('links back to the parent learning system', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: 'aserdargun.com' })).toHaveAttribute('href', 'https://aserdargun.com/tr/');
  await expect(footer.getByRole('link', { name: 'ENG' })).toHaveAttribute('href', 'https://eng.aserdargun.com/');
  await expect(footer.getByRole('link', { name: 'HEX' })).toHaveAttribute('href', 'https://hex.aserdargun.com/');
});

test('shows no console error during a full pass', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.getByTestId('metric-iou')).toBeVisible({ timeout: 20000 });
  for (const id of ['edges', 'regions', 'lines', 'depth']) {
    await page.getByTestId(`exp-${id}`).click();
    await expect(page.getByTestId('metrics')).toContainText('IoU', { timeout: 30000 });
  }
  expect(errors).toEqual([]);
});
