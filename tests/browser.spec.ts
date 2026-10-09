import { expect, test } from '@playwright/test';

// VIS explains. CVL measures. Everything asserted here is asserted against the
// surface a reader actually sees, and the split between the two applications is
// itself part of what the browser tests check: no measurement may appear here,
// and every "measure this" link must leave for the laboratory.

test('opens on the knowledge bank and never offers a laboratory', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('knowledge-bank')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('view-knowledge')).toBeVisible();
  await expect(page.getByTestId('view-learn')).toBeVisible();
  // The third view is the one that used to be a copy of CVL.
  await expect(page.getByTestId('view-laboratory')).toHaveCount(0);
});

test('renders the knowledge bank as seven sourced layers', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('knowledge-bank')).toBeVisible({ timeout: 20000 });
  // Every layer names what it is not for, so no layer implies it does everything.
  await expect(page.getByTestId('kb-layer-signal')).toBeVisible();
  await expect(page.getByTestId('kb-layer-motion')).toBeVisible();
  await expect(page.locator('.kb-boundary')).toHaveCount(7);
  // Sources are external, primary and opened in a new tab.
  const source = page.getByTestId('kb-source-canny-1986');
  await expect(source).toHaveAttribute('href', 'https://doi.org/10.1109/TPAMI.1986.4767851');
  await expect(source).toHaveAttribute('target', '_blank');
});

test('states that its own numbers are not measurements', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('knowledge-bank')).toContainText('ölçüm değildir', { timeout: 20000 });
  // No measurement surface exists here at all.
  await expect(page.getByTestId('metrics')).toHaveCount(0);
  await expect(page.getByTestId('metric-iou')).toHaveCount(0);
});

test('a concept links out to the laboratory layer that measures it', async ({ page }) => {
  await page.goto('/');
  const link = page.getByTestId('kb-measure-hysteresis');
  await expect(link).toBeVisible({ timeout: 20000 });
  // Hysteresis is an edge idea, so it must point at the edge layer in CVL.
  await expect(link).toHaveAttribute('href', 'https://cvl.aserdargun.com/#katman-edges');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noreferrer');
});

test('every knowledge layer sends the reader to the laboratory', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('knowledge-bank')).toBeVisible({ timeout: 20000 });
  const links = page.locator('a.kb-measure');
  const count = await links.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    await expect(links.nth(i)).toHaveAttribute('href', /^https:\/\/cvl\.aserdargun\.com\/#katman-[a-z]+$/);
  }
});

test('every layer answers the deep link the laboratory sends', async ({ page }) => {
  // The other half of the boundary contract. The laboratory links here as
  // `#katman-<layer>`; this surface is built by script, so the fragment cannot
  // resolve on its own. Without a real id and an explicit scroll, a reader who
  // follows a "read this in VIS" link lands at the top of the page and never sees
  // the layer they asked for. Both halves are asserted, because either one alone
  // would leave the declared link quietly broken.
  for (const layer of ['signal', 'filtering', 'edges', 'regions', 'geometry', 'learning', 'motion']) {
    await page.goto(`/#katman-${layer}`);
    const anchor = page.locator(`#katman-${layer}`);
    await expect(anchor).toBeVisible({ timeout: 20000 });
    await expect(anchor).toHaveAttribute('id', `katman-${layer}`);
    // The section must be the one that reached the top of the viewport, otherwise
    // the link resolved to a name but not to the reading.
    const onScreen = await anchor.evaluate((node) => {
      const box = node.getBoundingClientRect();
      return box.top >= -8 && box.top < window.innerHeight;
    });
    expect(onScreen, `#katman-${layer} did not scroll into view`).toBe(true);
  }
});

test('the knowledge bank switches language in both directions', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('kb-concept-hysteresis')).toContainText('Histerez', { timeout: 20000 });
  await page.getByTestId('lang-en').click();
  await expect(page.getByTestId('kb-concept-hysteresis')).toContainText('Hysteresis');
  await expect(page.getByTestId('knowledge-bank')).toContainText('No number here is a measurement');
  await page.getByTestId('lang-tr').click();
  await expect(page.getByTestId('kb-concept-hysteresis')).toContainText('Histerez');
});

test('links back to the parent learning system and to the laboratory', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: 'aserdargun.com' })).toHaveAttribute('href', 'https://aserdargun.com/tr/');
  await expect(footer.getByRole('link', { name: 'LLM' })).toHaveAttribute('href', 'https://llm.aserdargun.com/');
  await expect(footer.getByRole('link', { name: 'ENG' })).toHaveAttribute('href', 'https://eng.aserdargun.com/');
  await expect(footer.getByRole('link', { name: 'CVL' })).toHaveAttribute('href', 'https://cvl.aserdargun.com/');
});

test('shows no console error during a full pass', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.getByTestId('knowledge-bank')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('lang-en').click();
  await page.getByTestId('lang-tr').click();
  await page.getByTestId('view-learn').click();
  await expect(page.getByTestId('learn-view')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the review deck is derived from the knowledge bank and graded by the reader', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('view-learn').click();
  const card = page.getByTestId('learn-card');
  await expect(card).toBeVisible({ timeout: 20000 });
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
  await expect(page.getByTestId('learn-counts')).not.toContainText(' 0 /');
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

test('a card links out to the laboratory instead of measuring here', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('view-learn').click();
  await page.getByTestId('learn-reveal').click();
  const link = page.getByTestId('learn-measure');
  await expect(link).toBeVisible({ timeout: 20000 });
  await expect(link).toHaveAttribute('href', /^https:\/\/cvl\.aserdargun\.com\/#katman-[a-z]+$/);
  // Following it must not stay on this page pretending to measure.
  await expect(page.getByTestId('metrics')).toHaveCount(0);
});

test('the review surface stays bilingual', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('view-learn').click();
  await expect(page.getByTestId('learn-view')).toContainText('Kartlar bilgi bankasındaki', { timeout: 20000 });
  await page.getByTestId('lang-en').click();
  await expect(page.getByTestId('learn-view')).toContainText('derived from the knowledge bank');
});