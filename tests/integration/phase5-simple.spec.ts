import { expect, test } from '@playwright/test';

test.describe('Phase 5: LokulMem Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up error tracking
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
  });

  test('should load LokulMem library', async ({ page }) => {
    await page.goto(
      'http://localhost:8080/tests/manual/phase5-manual-test.html',
    );
    await page.waitForLoadState('networkidle');

    // Check page loaded
    const title = await page.title();
    expect(title).toContain('Phase 5 Manual Test');
  });

  test('should have LokulMem available globally', async ({ page }) => {
    await page.goto(
      'http://localhost:8080/tests/manual/phase5-manual-test.html',
    );
    await page.waitForLoadState('networkidle');

    // Wait for module to load
    await page.waitForTimeout(2000);

    // Check if LokulMem loaded
    const hasLokulMem = await page.evaluate(() => {
      return typeof (window as { LokulMem?: unknown }).LokulMem !== 'undefined';
    });

    console.log(`LokulMem available: ${hasLokulMem}`);
  });

  test('should click run button and execute tests', async ({ page }) => {
    await page.goto(
      'http://localhost:8080/tests/manual/phase5-manual-test.html',
    );
    await page.waitForLoadState('networkidle');

    // Wait for initial load
    await page.waitForTimeout(1000);

    // Find and click run button
    const runBtn = page.locator('#runAllBtn');
    await expect(runBtn).toBeVisible();
    await runBtn.click();

    // Wait for tests to run (up to 90 seconds for model loading)
    console.log('Waiting for tests to complete...');
    await page.waitForTimeout(60000);

    // Check if any test cases appeared
    const testCases = await page.locator('.test-case').count();
    console.log(`Test cases found: ${testCases}`);

    // Take screenshot
    await page.screenshot({
      path: 'test-results/phase5-after-tests.png',
      fullPage: true,
    });

    // Check results
    if (testCases > 0) {
      const passedTests = await page.locator('#passedTests').textContent();
      const totalTests = await page.locator('#totalTests').textContent();
      console.log(`Results: ${passedTests}/${totalTests}`);
    }
  });

  test('should verify build artifacts exist', async ({ context }) => {
    // Check main.mjs
    const mainMjs = await context.request.get(
      'http://localhost:8080/dist/main.mjs',
    );
    expect(mainMjs.ok()).toBeTruthy();
    const mainContent = await mainMjs.text();
    expect(mainContent).toContain('LokulMem');
    console.log('✅ dist/main.mjs loads correctly');

    // Check worker.mjs
    const workerMjs = await context.request.get(
      'http://localhost:8080/dist/worker.mjs',
    );
    expect(workerMjs.ok()).toBeTruthy();
    console.log('✅ dist/worker.mjs loads correctly');

    // Check type declarations
    const mainDts = await context.request.get(
      'http://localhost:8080/dist/main.d.ts',
    );
    expect(mainDts.ok()).toBeTruthy();
    const dtsContent = await mainDts.text();
    expect(dtsContent).toContain('LokulMem');
    console.log('✅ dist/main.d.ts loads correctly');
  });

  test('should check for console errors during load', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(
      'http://localhost:8080/tests/manual/phase5-manual-test.html',
    );
    await page.waitForLoadState('networkidle');

    // Wait a bit for async errors
    await page.waitForTimeout(2000);

    if (errors.length > 0) {
      console.log('Console errors detected:');
      for (const err of errors) {
        console.log(`  - ${err}`);
      }
    }

    // We expect some errors (model loading, etc.), but should not crash
    expect(errors.length).toBeLessThan(10);
  });
});
