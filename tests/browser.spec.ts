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
  await expect(footer.getByRole('link', { name: 'LLM' })).toHaveAttribute('href', 'https://llm.aserdargun.com/');
  await expect(footer.getByRole('link', { name: 'ENG' })).toHaveAttribute('href', 'https://eng.aserdargun.com/');
});

test('renders the knowledge bank as seven sourced layers', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('view-knowledge').click();
  const bank = page.getByTestId('knowledge-bank');
  await expect(bank).toBeVisible();
  // Every layer names what it is not for, so no layer implies it does everything.
  await expect(bank.getByTestId('kb-layer-signal')).toBeVisible();
  await expect(bank.getByTestId('kb-layer-motion')).toBeVisible();
  await expect(bank.locator('.kb-boundary')).toHaveCount(7);
  // Sources are external, primary and opened in a new tab.
  const source = bank.getByTestId('kb-source-canny-1986');
  await expect(source).toHaveAttribute('href', 'https://doi.org/10.1109/TPAMI.1986.4767851');
  await expect(source).toHaveAttribute('target', '_blank');
});

test('the knowledge bank states that its own numbers are not measurements', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('view-knowledge').click();
  await expect(page.getByTestId('knowledge-bank')).toContainText('ölçüm değildir');
  // No measurement is rendered on the reference surface at all.
  await expect(page.getByTestId('metrics')).toHaveCount(0);
});

test('a concept cross-links to the experiment that measures it', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('view-knowledge').click();
  await page.getByTestId('kb-measure-hysteresis').click();
  // Back in the laboratory, on the experiment the concept points at.
  await expect(page.getByTestId('exp-edges')).toHaveClass(/exp-active/);
  await expect(page.getByTestId('metrics')).toContainText('IoU', { timeout: 30000 });
});

test('the knowledge bank switches language in both directions', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('view-knowledge').click();
  await expect(page.getByTestId('kb-concept-hysteresis')).toContainText('Histerez');
  await page.getByTestId('lang-en').click();
  await expect(page.getByTestId('kb-concept-hysteresis')).toContainText('Hysteresis');
  await page.getByTestId('lang-tr').click();
  await expect(page.getByTestId('kb-concept-hysteresis')).toContainText('Histerez');
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

test('the review deck is derived from the knowledge bank and graded by the reader', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('view-learn').click();
  const card = page.getByTestId('learn-card');
  await expect(card).toBeVisible();
  // The answer is hidden until the reader asks, because the reader is the judge.
  await expect(page.getByTestId('learn-answer')).toHaveCount(0);
  await page.getByTestId('learn-reveal').click();
  await expect(page.getByTestId('learn-answer')).toBeVisible();
  await expect(page.getByTestId('learn-grades')).toBeVisible();
  await expect(page.getByTestId('learn-counts')).toContainText('0');
});

test('grading a card records progress that survives a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('view-learn').click();
  await page.getByTestId('learn-reveal').click();
  await page.getByTestId('learn-grade-5').click();
  await expect(page.getByTestId('learn-counts')).not.toContainText('\u00a00 /');
  const stored = await page.evaluate(() => localStorage.getItem('vis.learn.v1.progress'));
  expect(stored).toBeTruthy();
  const state = JSON.parse(stored!);
  expect(Object.keys(state.cards).length).toBe(1);
  expect(state.streak.current).toBe(1);
  // A fresh load must read the stored progress back, not start over.
  await page.reload();
  await page.getByTestId('view-learn').click();
  await expect(page.getByTestId('learn-counts')).toContainText('1');
});

test('a card cross-links to the experiment that measures its concept', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('view-learn').click();
  await page.getByTestId('learn-reveal').click();
  await page.getByTestId('learn-measure').click();
  await expect(page.getByTestId('knowledge-bank')).toHaveCount(0);
  await expect(page.getByTestId('metrics')).toContainText('IoU', { timeout: 30000 });
});

test('the review surface stays bilingual', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('view-learn').click();
  await expect(page.getByTestId('learn-view')).toContainText('Kartlar bilgi bankasındaki');
  await page.getByTestId('lang-en').click();
  await expect(page.getByTestId('learn-view')).toContainText('derived from the knowledge bank');
});
