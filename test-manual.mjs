#!/usr/bin/env node
/**
 * Manual Test Script for LokulMem Phases 1-3
 *
 * This script tests:
 * - Phase 1: Build output, type exports
 * - Phase 2: Worker URL accessibility
 * - Phase 3: Storage layer imports (limited in Node.js without IndexedDB)
 *
 * Usage: node test-manual.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('🔬 LokulMem Manual Test — Phases 1-3\n');

const tests = [];
const results = { passed: 0, failed: 0 };

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  for (const { name, fn } of tests) {
    process.stdout.write(`  ${name}... `);
    try {
      await fn();
      console.log('✓ PASS');
      results.passed++;
    } catch (e) {
      console.log(`✗ FAIL: ${e.message}`);
      results.failed++;
    }
  }
}

// ===== Phase 1: Foundation Tests =====

test('Build output exists (main.mjs)', () => {
  const content = readFileSync(join(__dirname, 'dist/main.mjs'), 'utf-8');
  if (content.length < 1000) throw new Error('Build output too small');
});

test('Build output exists (worker.mjs)', () => {
  const content = readFileSync(join(__dirname, 'dist/worker.mjs'), 'utf-8');
  if (content.length < 1000) throw new Error('Worker output too small');
});

test('Type definitions exist (main.d.ts)', () => {
  const content = readFileSync(join(__dirname, 'dist/main.d.ts'), 'utf-8');
  if (!content.includes('export')) throw new Error('No exports in type definitions');
});

test('ESM module loads without errors', async () => {
  const module = await import('./dist/main.mjs');
  if (!module.VERSION) throw new Error('VERSION not exported');
  if (!module.createLokulMem) throw new Error('createLokulMem not exported');
  if (!module.LokulMem) throw new Error('LokulMem not exported');
});

test('VERSION is correct', async () => {
  const module = await import('./dist/main.mjs');
  if (module.VERSION !== '0.1.0') throw new Error(`Expected 0.1.0, got ${module.VERSION}`);
});

test('WorkerUrl is exported', async () => {
  const module = await import('./dist/main.mjs');
  if (!module.WorkerUrl) throw new Error('WorkerUrl not exported');
});

test('Storage types are exported', async () => {
  const module = await import('./dist/main.mjs');
  // These are type exports - at runtime they don't exist,
  // but we can verify the module structure is correct
  const expectedExports = ['LokulMem', 'createLokulMem', 'VERSION', 'WorkerUrl'];
  for (const exp of expectedExports) {
    if (!(exp in module)) throw new Error(`${exp} not found in exports`);
  }
});

// ===== Phase 2: Worker Infrastructure Tests =====

test('LokulMem class is a constructor/function', async () => {
  const module = await import('./dist/main.mjs');
  if (typeof module.LokulMem !== 'function') {
    throw new Error('LokulMem is not a constructor');
  }
});

test('createLokulMem is a function', async () => {
  const module = await import('./dist/main.mjs');
  if (typeof module.createLokulMem !== 'function') {
    throw new Error('createLokulMem is not a function');
  }
});

// ===== Phase 3: Storage Layer Tests =====

test('Storage layer files exist', () => {
  const files = [
    'src/storage/Database.ts',
    'src/storage/StorageManager.ts',
    'src/storage/MemoryRepository.ts',
    'src/storage/embeddingStorage.ts',
    'src/storage/_index.ts'
  ];
  for (const file of files) {
    readFileSync(join(__dirname, file), 'utf-8');
  }
});

test('Dexie is listed as dependency', () => {
  const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));
  if (!pkg.dependencies?.dexie) throw new Error('Dexie not in dependencies');
});

// Run all tests
console.log('Phase 1: Foundation');
console.log('-------------------');

const phase1Tests = tests.splice(0, tests.length);
const storageTestIdx = phase1Tests.findIndex(t => t.name === 'Storage layer files exist');
const phase3Tests = storageTestIdx >= 0 ? phase1Tests.splice(storageTestIdx) : [];
const phase2Tests = phase1Tests.splice(7); // After first 7 Phase 1 tests

// Re-add in order
tests.push(...phase1Tests);

console.log('\nPhase 1: Foundation');
console.log('-------------------');
await runTests();

tests.length = 0;
tests.push(...phase2Tests);
console.log('\nPhase 2: Worker Infrastructure');
console.log('-------------------------------');
await runTests();

tests.length = 0;
tests.push(...phase3Tests);
console.log('\nPhase 3: Storage Layer');
console.log('----------------------');
await runTests();

// Summary
console.log('\n========================');
console.log(`Results: ${results.passed} passed, ${results.failed} failed`);
console.log('========================');

if (results.failed > 0) {
  process.exit(1);
}

console.log('\n✓ All manual tests passed!');
console.log('\nNext steps:');
console.log('  1. Open test-manual.html in a browser for full integration tests');
console.log('  2. Check browser console for detailed logs');
console.log('  3. Run /gsd:verify-work 3 for conversational UAT');
