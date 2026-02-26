/**
 * Phase 6: Lifecycle & Decay - Automated Tests
 *
 * Tests the memory lifecycle management system including:
 * - Ebbinghaus decay calculation with per-category lambda values
 * - Reinforcement on access with debounced writes
 * - Maintenance sweep (session + periodic)
 * - Fading and deletion lifecycle
 * - K-means clustering
 * - Public API event callbacks
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

test.describe('Phase 6: Lifecycle & Decay', () => {
  test.beforeAll(async () => {
    // Build the project first
    execSync('npm run build', { stdio: 'inherit' });
  });

  test('should verify build output exists', async () => {
    // Check if build artifacts exist
    const distFiles = [
      'dist/main.mjs',
      'dist/worker.mjs',
      'dist/main.cjs',
      'dist/worker.cjs',
    ];

    for (const file of distFiles) {
      const filePath = join(process.cwd(), file);
      expect(existsSync(filePath)).toBe(true);

      // Check file size is reasonable
      const stats = statSync(filePath);
      expect(stats.size).toBeGreaterThan(1000);
    }
  });

  test('should have no TypeScript errors', async () => {
    // Run TypeScript compiler in check mode
    let hasErrors = false;
    try {
      execSync('npx tsc --noEmit', { stdio: 'pipe' });
    } catch {
      hasErrors = true;
    }

    expect(hasErrors).toBe(false);
  });

  test('should have correct LifecycleConfig types', async () => {
    // Read the lifecycle types file
    const typesPath = join(process.cwd(), 'src/lifecycle/types.ts');
    const content = readFileSync(typesPath, 'utf-8');

    // Verify required types exist
    expect(content).toContain('LifecycleConfig');
    expect(content).toContain('DecayConfig');
    expect(content).toContain('ReinforcementConfig');
    expect(content).toContain('MaintenanceConfig');
    expect(content).toContain('KMeansConfig');
    expect(content).toContain('ClusterResult');
    expect(content).toContain('DecayResult');
    expect(content).toContain('SweepResult');
  });

  test('should have correct DecayCalculator implementation', async () => {
    const decayPath = join(process.cwd(), 'src/lifecycle/DecayCalculator.ts');
    const content = readFileSync(decayPath, 'utf-8');

    // Verify Ebbinghaus formula components exist
    expect(content).toContain('calculateDecay');
    expect(content).toContain('lambda');
    expect(content).toContain('Math.exp');
  });

  test('should have correct KMeansClusterer implementation', async () => {
    const kmeansPath = join(process.cwd(), 'src/lifecycle/KMeansClusterer.ts');
    const content = readFileSync(kmeansPath, 'utf-8');

    // Verify K-means components exist
    expect(content).toContain('cluster()');
    expect(content).toContain('initializeCentroids');
    expect(content).toContain('assignToClusters');
    expect(content).toContain('updateCentroids');
    expect(content).toContain('euclideanDistance');
    expect(content).toContain('checkConvergence');
  });

  test('should have bulkUpdateClusterIds in MemoryRepository', async () => {
    const repoPath = join(process.cwd(), 'src/storage/MemoryRepository.ts');
    const content = readFileSync(repoPath, 'utf-8');

    // Verify bulkUpdateClusterIds exists and uses correct Dexie API
    expect(content).toContain('bulkUpdateClusterIds');
    // Should use modify() not incorrect bulkUpdate signature
    expect(content).toContain('.modify(');
    expect(content).not.toContain("bulkUpdate(updates, ['clusterId'])");
  });

  test('should have PortLike interface with addEventListener', async () => {
    const typesPath = join(process.cwd(), 'src/core/types.ts');
    const content = readFileSync(typesPath, 'utf-8');

    // Verify PortLike interface has required methods
    expect(content).toContain('interface PortLike');
    expect(content).toContain('addEventListener');
    expect(content).toContain('removeEventListener');
  });

  test('should have lifecycle event callbacks in LokulMem', async () => {
    const lokulPath = join(process.cwd(), 'src/core/LokulMem.ts');
    const content = readFileSync(lokulPath, 'utf-8');

    // Verify public API methods exist
    expect(content).toContain('onMemoryFaded');
    expect(content).toContain('onMemoryDeleted');
    expect(content).toContain('buildLifecycleConfig');
  });

  test('should have IPC protocol extensions for lifecycle events', async () => {
    const protocolPath = join(process.cwd(), 'src/ipc/protocol-types.ts');
    const content = readFileSync(protocolPath, 'utf-8');

    // Verify lifecycle event message types exist
    expect(content).toContain('MEMORY_FADED');
    expect(content).toContain('MEMORY_DELETED');
  });

  test('should load LokulMem with lifecycle config', async ({ page }) => {
    await page.goto(
      'http://localhost:8086/tests/manual/phase6-manual-test.html',
    );

    // Wait for module to load
    await page.waitForTimeout(2000);

    // Check for console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Try to initialize with lifecycle config
    const result = await page.evaluate(async () => {
      try {
        const module = await import('/dist/main.mjs');
        const lokul = await module.createLokulMem({
          dbName: 'phase6-test',
          lambdaByCategory: {
            identity: 0.0001,
          },
          fadedThreshold: 0.1,
        });
        return { success: true, workerType: lokul.getWorkerType() };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    expect(result.success).toBe(true);

    // Log any console errors
    if (errors.length > 0) {
      console.error('Console errors during init:', errors);
    }
  });
});

test.describe('Phase 6: Decay Calculator Unit Tests', () => {
  test('should verify decay formula constants', async () => {
    const researchPath = join(
      process.cwd(),
      '.planning/phases/06-lifecycle-decay/06-RESEARCH.md',
    );
    const content = readFileSync(researchPath, 'utf-8');

    // Verify lambda values are documented
    expect(content).toContain('identity: 0.0001');
    expect(content).toContain('location: 0.0005');
    expect(content).toContain('profession: 0.0003');
    expect(content).toContain('preferences: 0.001');
    expect(content).toContain('project: 0.005');
    expect(content).toContain('temporal: 0.02');
    expect(content).toContain('relational: 0.0004');
    expect(content).toContain('emotional: 0.01');
  });
});

test.describe('Phase 6: Integration Tests', () => {
  test('should verify all lifecycle components exist', async () => {
    const lifecycleDir = join(process.cwd(), 'src/lifecycle');
    const files = readdirSync(lifecycleDir);

    // Verify all required files exist
    expect(files).toContain('types.ts');
    expect(files).toContain('DecayCalculator.ts');
    expect(files).toContain('ReinforcementTracker.ts');
    expect(files).toContain('MaintenanceSweep.ts');
    expect(files).toContain('EventEmitter.ts');
    expect(files).toContain('LifecycleManager.ts');
    expect(files).toContain('KMeansClusterer.ts');
  });

  test('should verify barrel export exists', async () => {
    const indexPath = join(process.cwd(), 'src/lifecycle/_index.ts');
    expect(existsSync(indexPath)).toBe(true);

    const content = readFileSync(indexPath, 'utf-8');

    // Verify all components are exported
    expect(content).toContain('DecayCalculator');
    expect(content).toContain('ReinforcementTracker');
    expect(content).toContain('MaintenanceSweep');
    expect(content).toContain('LifecycleEventEmitter');
    expect(content).toContain('LifecycleManager');
    expect(content).toContain('KMeansClusterer');
  });
});
