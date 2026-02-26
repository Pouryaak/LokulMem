import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();

const requiredFiles = [
  'dist/main.mjs',
  'dist/main.cjs',
  'dist/main.d.ts',
  'dist/worker.mjs',
  'dist/worker.cjs',
];

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing required build artifact: ${relativePath}`);
  }
}

const esmEntry = pathToFileURL(path.join(rootDir, 'dist/main.mjs')).href;
const esmModule = await import(esmEntry);

if (typeof esmModule.LokulMem !== 'function') {
  throw new Error('ESM export LokulMem is missing or invalid');
}
if (typeof esmModule.createLokulMem !== 'function') {
  throw new Error('ESM export createLokulMem is missing or invalid');
}
if (typeof esmModule.VERSION !== 'string') {
  throw new Error('ESM export VERSION is missing or invalid');
}

const require = createRequire(import.meta.url);
const cjsModule = require(path.join(rootDir, 'dist/main.cjs'));

if (typeof cjsModule.LokulMem !== 'function') {
  throw new Error('CJS export LokulMem is missing or invalid');
}
if (typeof cjsModule.createLokulMem !== 'function') {
  throw new Error('CJS export createLokulMem is missing or invalid');
}

console.log('dist verification passed');
