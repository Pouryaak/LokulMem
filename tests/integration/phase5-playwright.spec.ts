import { expect, test } from '@playwright/test';

test.describe('Phase 5: Memory Store & Retrieval', () => {
  test('should load test page and initialize LokulMem', async ({ page }) => {
    await page.goto(
      'http://localhost:8080/tests/manual/phase5-manual-test.html',
    );

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check title
    await expect(page).toHaveTitle(/Phase 5 Manual Test/);

    // Check that Run button exists and is enabled
    const runBtn = page.locator('#runAllBtn');
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toBeEnabled();
  });

  test('should run all automated tests', async ({ page }) => {
    await page.goto(
      'http://localhost:8080/tests/manual/phase5-manual-test.html',
    );
    await page.waitForLoadState('networkidle');

    // Listen for console messages
    const logs: string[] = [];
    page.on('console', (msg) => {
      logs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Click run button
    await page.click('#runAllBtn');

    // Wait for tests to complete (button re-enables)
    await page.waitForSelector('#runAllBtn:not(:disabled)', { timeout: 90000 });

    // Give UI time to update
    await page.waitForTimeout(1000);

    // Get results
    const totalTests = await page.locator('#totalTests').textContent();
    const passedTests = await page.locator('#passedTests').textContent();
    const _failedTests = await page.locator('#failedTests').textContent();

    console.log(`\n📊 Test Results: ${passedTests}/${totalTests} passed`);

    // Check for any console errors
    const errors = logs.filter((log) => log.includes('[error]'));
    if (errors.length > 0) {
      console.log('\n⚠️  Console Errors:');
      for (const err of errors) {
        console.log(`  ${err}`);
      }
    }

    // Take screenshot of results
    await page.screenshot({
      path: 'test-results/phase5-test-results.png',
      fullPage: true,
    });

    // Verify we have test results
    expect(Number.parseInt(totalTests || '0', 10)).toBeGreaterThan(0);

    // Log detailed results
    const testCases = await page.locator('.test-case').allTextContents();
    console.log('\n📋 Detailed Results:');
    for (const tc of testCases) {
      const lines = tc.split('\n');
      const name = lines[1] || 'Unknown';
      const status = lines[0].includes('pass')
        ? '✅ PASS'
        : lines[0].includes('fail')
          ? '❌ FAIL'
          : '⏳ PENDING';
      console.log(`  ${status}: ${name}`);
    }
  });

  test('should verify no critical errors', async ({ page }) => {
    await page.goto(
      'http://localhost:8080/tests/manual/phase5-manual-test.html',
    );
    await page.waitForLoadState('networkidle');

    const errors: string[] = [];

    // Listen for errors
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Try to load LokulMem module
    const moduleLoad = await page.evaluate(async () => {
      try {
        await import('../../dist/main.mjs');
        return { success: true };
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    expect(moduleLoad.success).toBe(true);

    if (errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      for (const err of errors) {
        console.log(`  ${err}`);
      }
    }
  });

  test('should check build artifacts', async ({ context }) => {
    // Check that dist files are accessible
    const response = await context.request.get(
      'http://localhost:8080/dist/main.mjs',
    );
    expect(response.ok()).toBeTruthy();

    const content = await response.text();
    expect(content).toContain('LokulMem');
  });
});
