#!/usr/bin/env node
/**
 * Phase 5 Verification Script
 * Tests LokulMem build output and basic functionality
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = join(__dirname, '../..');

console.log('🧪 Phase 5 Verification\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Test 1: Build artifacts exist
console.log('\n📦 Build Artifacts');
test('dist/main.mjs exists', () => {
  const path = join(ROOT, 'dist/main.mjs');
  assert(existsSync(path), 'File does not exist');
});

test('dist/worker.mjs exists', () => {
  const path = join(ROOT, 'dist/worker.mjs');
  assert(existsSync(path), 'File does not exist');
});

test('dist/main.cjs exists', () => {
  const path = join(ROOT, 'dist/main.cjs');
  assert(existsSync(path), 'File does not exist');
});

test('dist/worker.cjs exists', () => {
  const path = join(ROOT, 'dist/worker.cjs');
  assert(existsSync(path), 'File does not exist');
});

test('TypeScript declarations exist', () => {
  const path = join(ROOT, 'dist/main.d.ts');
  assert(existsSync(path), 'Declaration file does not exist');
});

// Test 2: Build output is valid
console.log('\n📄 Build Output Content');
test('main.mjs exports LokulMem', () => {
  const content = readFileSync(join(ROOT, 'dist/main.mjs'), 'utf-8');
  assert(content.includes('LokulMem'), 'LokulMem export not found');
  assert(content.includes('VectorSearch'), 'VectorSearch not exported');
});

test('worker.mjs contains worker code', () => {
  const content = readFileSync(join(ROOT, 'dist/worker.mjs'), 'utf-8');
  assert(
    content.includes('EmbeddingEngine'),
    'EmbeddingEngine not found in worker',
  );
  assert(content.includes('QueryEngine'), 'QueryEngine not found in worker');
});

test('main.d.ts has correct types', () => {
  const content = readFileSync(join(ROOT, 'dist/main.d.ts'), 'utf-8');
  assert(content.includes('class LokulMem'), 'LokulMem class type not found');
  assert(content.includes('interface'), 'Interface definitions not found');
});

// Test 3: Phase 5 specific exports
console.log('\n🔍 Phase 5 Features');
test('VectorSearch is exported', () => {
  const content = readFileSync(join(ROOT, 'dist/main.mjs'), 'utf-8');
  assert(content.includes('VectorSearch'), 'VectorSearch not exported');
});

test('Scoring is exported', () => {
  const content = readFileSync(join(ROOT, 'dist/main.mjs'), 'utf-8');
  assert(content.includes('Scoring'), 'Scoring not exported');
});

test('QueryEngine types exist', () => {
  const content = readFileSync(join(ROOT, 'dist/main.d.ts'), 'utf-8');
  assert(content.includes('QueryEngine'), 'QueryEngine type not found');
  assert(content.includes('PaginatedResult'), 'PaginatedResult not found');
});

// Test 4: Token budget functionality
console.log('\n💰 Token Budget Features');
test('TokenBudget helper exists', () => {
  const content = readFileSync(join(ROOT, 'dist/main.mjs'), 'utf-8');
  assert(
    content.includes('computeTokenBudget'),
    'computeTokenBudget not found',
  );
});

test('ChatMessage type exists', () => {
  const content = readFileSync(join(ROOT, 'dist/main.d.ts'), 'utf-8');
  assert(content.includes('ChatMessage'), 'ChatMessage type not found');
});

// Test 5: Source files are well-structured
console.log('\n📂 Source Structure');
test('VectorSearch.ts exists', () => {
  const path = join(ROOT, 'src/search/VectorSearch.ts');
  assert(existsSync(path), 'VectorSearch.ts does not exist');
});

test('Scoring.ts exists', () => {
  const path = join(ROOT, 'src/search/Scoring.ts');
  assert(existsSync(path), 'Scoring.ts does not exist');
});

test('QueryEngine.ts exists', () => {
  const path = join(ROOT, 'src/search/QueryEngine.ts');
  assert(existsSync(path), 'QueryEngine.ts does not exist');
});

test('TokenBudget.ts exists', () => {
  const path = join(ROOT, 'src/core/TokenBudget.ts');
  assert(existsSync(path), 'TokenBudget.ts does not exist');
});

test('Search types exist', () => {
  const path = join(ROOT, 'src/search/types.ts');
  assert(existsSync(path), 'src/search/types.ts does not exist');
});

// Test 6: Worker integration
console.log('\n🔧 Worker Integration');
test('Worker index.ts exists', () => {
  const path = join(ROOT, 'src/worker/index.ts');
  assert(existsSync(path), 'Worker index does not exist');
});

test('Protocol types exist', () => {
  const path = join(ROOT, 'src/ipc/protocol-types.ts');
  assert(existsSync(path), 'Protocol types do not exist');
});

// Summary
console.log(`\n${'='.repeat(50)}`);
console.log(`📊 Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n✨ All checks passed!');
}
