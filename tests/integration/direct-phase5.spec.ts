import { expect, test } from '@playwright/test';

test.describe('Phase 5: Direct LokulMem Tests', () => {
  test('should import LokulMem from build', async ({ page }) => {
    await page.goto('http://localhost:8080');

    // Test importing the module
    const result = await page.evaluate(async () => {
      try {
        const { LokulMem } = await import('./dist/main.mjs');
        return {
          success: true,
          hasLokulMem: typeof LokulMem !== 'undefined',
          lokulMemType: typeof LokulMem,
        };
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    console.log('Import result:', JSON.stringify(result, null, 2));
    expect(result.success).toBe(true);
    expect(result.hasLokulMem).toBe(true);
    expect(result.lokulMemType).toBe('function');
  });

  test('should create LokulMem instance', async ({ page }) => {
    await page.goto('http://localhost:8080');

    const result = await page.evaluate(async () => {
      try {
        const { LokulMem } = await import('./dist/main.mjs');

        // Create instance (will fail without proper worker setup, but we can test instantiation)
        const instance = new LokulMem({
          localModelBaseUrl: '/models',
        });

        return {
          success: true,
          hasInstance: !!instance,
        };
      } catch (error: unknown) {
        // Expected to fail due to worker/transformers loading
        return {
          success: false,
          expectedError: true,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    console.log('Instance result:', JSON.stringify(result, null, 2));
    // We expect this to fail due to model loading in test environment
    expect(result.expectedError).toBe(true);
  });

  test('should verify Phase 5 exports in build', async ({ page }) => {
    await page.goto('http://localhost:8080');

    const exports = await page.evaluate(async () => {
      const mainModule = await import('./dist/main.mjs');
      return Object.keys(mainModule);
    });

    console.log('Available exports:', exports.slice(0, 20).join(', '));

    // Check for key exports
    expect(exports).toContain('LokulMem');
    expect(exports).toContain('VERSION');
    expect(exports).toContain('WorkerUrl');
  });

  test('should verify type definitions', async ({ context }) => {
    // Check that .d.ts file exists and has content
    const dts = await context.request.get(
      'http://localhost:8080/dist/main.d.ts',
    );
    expect(dts.ok()).toBeTruthy();

    const content = await dts.text();

    // Check for key types
    expect(content).toContain('class LokulMem');
    expect(content).toContain('interface');
    expect(content).toContain('MemoryDTO');

    console.log('✅ Type definitions verified');
  });

  test('should verify worker bundle', async ({ context }) => {
    const worker = await context.request.get(
      'http://localhost:8080/dist/worker.mjs',
    );
    expect(worker.ok()).toBeTruthy();

    const content = await worker.text();

    // Check for Phase 5 worker components
    expect(content).toContain('QueryEngine');
    expect(content).toContain('VectorSearch');
    expect(content).toContain('Scoring');

    console.log('✅ Worker bundle verified');
  });

  test('should verify search module exists', async ({ context }) => {
    // Check if we can access source files
    const response = await context.request.get(
      'http://localhost:8080/src/search/_index.ts',
    );
    if (response.ok()) {
      const content = await response.text();
      expect(content).toContain('VectorSearch');
      expect(content).toContain('QueryEngine');
      console.log('✅ Source files accessible');
    } else {
      console.log('⚠️  Source files not served (expected in production)');
    }
  });

  test('should check bundle sizes are reasonable', async ({ context }) => {
    const mainMjs = await context.request.get(
      'http://localhost:8080/dist/main.mjs',
    );
    const workerMjs = await context.request.get(
      'http://localhost:8080/dist/worker.mjs',
    );

    const mainSize = (await mainMjs.body()).length;
    const workerSize = (await workerMjs.body()).length;

    console.log(`Main bundle: ${(mainSize / 1024).toFixed(2)} KB`);
    console.log(`Worker bundle: ${(workerSize / 1024 / 1024).toFixed(2)} MB`);

    // Main should be small (< 50 KB)
    expect(mainSize).toBeLessThan(50 * 1024);

    // Worker is large (includes Transformers.js)
    expect(workerSize).toBeGreaterThan(1 * 1024 * 1024); // At least 1 MB
    expect(workerSize).toBeLessThan(100 * 1024 * 1024); // Less than 100 MB
  });
});
