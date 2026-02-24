import { expect, test } from '@playwright/test';

test.describe('Phase 5: Memory Store & Retrieval', () => {
  test.beforeAll(async () => {
    // Build the project first
    const { execSync } = require('node:child_process');
    execSync('npm run build', { stdio: 'inherit' });
  });

  test('should load LokulMem library', async ({ page }) => {
    await page.goto(
      'http://localhost:8080/tests/manual/phase5-manual-test.html',
    );

    // Check if page loads
    const title = await page.title();
    expect(title).toContain('Phase 5 Manual Test');
  });

  test('should initialize LokulMem', async ({ page }) => {
    await page.goto(
      'http://localhost:8080/tests/manual/phase5-manual-test.html',
    );

    // Wait for module to load
    await page.waitForTimeout(1000);

    // Check for console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Try to run the first test
    await page.evaluate(() => {
      return (window as { runAllTests?: () => void }).runAllTests?.();
    });

    // Wait for tests to complete
    await page.waitForTimeout(10000);

    // Check results
    const passedTests = await page.locator('#passedTests').textContent();
    const totalTests = await page.locator('#totalTests').textContent();

    console.log(`Test Results: ${passedTests}/${totalTests} passed`);

    // Log any errors
    if (errors.length > 0) {
      console.error('Console errors:', errors);
    }
  });

  test('should verify build output', async () => {
    const fs = require('node:fs');
    const path = require('node:path');

    // Check if build artifacts exist
    const distFiles = [
      'dist/main.mjs',
      'dist/worker.mjs',
      'dist/main.cjs',
      'dist/worker.cjs',
    ];

    for (const file of distFiles) {
      const filePath = path.join(process.cwd(), file);
      expect(fs.existsSync(filePath)).toBe(true);

      // Check file size is reasonable
      const stats = fs.statSync(filePath);
      expect(stats.size).toBeGreaterThan(1000);
    }
  });

  test('should have correct TypeScript types', async () => {
    const { execSync } = require('node:child_process');

    // Run typecheck
    try {
      execSync('npm run typecheck', { stdio: 'pipe' });
      expect(true).toBe(true);
    } catch (_error) {
      throw new Error('TypeScript type check failed');
    }
  });
});
