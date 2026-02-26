import { expect, test } from '@playwright/test';

test.describe('CI integration smoke', () => {
  test('serves built artifacts', async ({ request }) => {
    const main = await request.get('/dist/main.mjs');
    expect(main.ok()).toBeTruthy();

    const worker = await request.get('/dist/worker.mjs');
    expect(worker.ok()).toBeTruthy();
  });

  test('loads manual smoke page', async ({ page }) => {
    await page.goto('/test-manual.html');
    await page.waitForLoadState('domcontentloaded');

    const title = await page.title();
    expect(title).toContain('LokulMem');
  });
});
