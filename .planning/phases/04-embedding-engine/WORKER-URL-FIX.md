# Worker URL Resolution - Critical Technical Decision

**Date:** 2026-02-23
**Phase:** 04-embedding-engine
**Status:** RESOLVED

## Problem

Worker initialization was timing out (120s) with no progress messages. The worker file was being requested but not responding to init messages.

## Root Cause

Using `?worker&url` import syntax which is designed for **inline workers in Vite applications**, not for **library builds with separate worker entry points**.

### What Didn't Work

```typescript
// ❌ WRONG - Creates inline worker chunk for Vite apps
import WorkerUrlImport from '../worker/index.ts?worker&url';

// In LokulMem.ts:
workerUrl: this.config.workerUrl ?? WorkerUrlImport,
```

This created a chunk at `/assets/index-XXXX.js` that had module loading issues in the worker context.

## Solution

Use direct URL to the built worker file:

```typescript
// ✅ CORRECT - Direct URL for library builds
// In LokulMem.ts:
workerUrl: this.config.workerUrl ??
  new URL('./worker.mjs', import.meta.url).href,
```

### Why This Works

1. **Vite build output:**
   - `src/index.ts` → `dist/main.mjs` (library entry)
   - `src/worker/index.ts` → `dist/worker.mjs` (worker entry)

2. **URL resolution:**
   - `import.meta.url` = URL of `dist/main.mjs`
   - `new URL('./worker.mjs', import.meta.url)` = `dist/worker.mjs` (relative to main.mjs)
   - At runtime: `http://localhost:8080/dist/worker.mjs`

3. **Module worker:**
   - `new Worker(workerUrl, { type: 'module' })` loads the worker as a module
   - Worker can import dependencies (Transformers.js, Dexie, etc.)

## Files Affected

- `src/core/LokulMem.ts` - Changed worker URL resolution
- `vite.config.ts` - Added documentation explaining the pattern
- `.planning/phases/04-embedding-engine/04-FINAL-SUMMARY.md` - Full summary

## When to Use Each Pattern

### Use `?worker&url` (Inline Worker)
- Vite **application** builds (not libraries)
- Worker code is part of the app bundle
- Worker is created at build time as a blob/inline string

### Use Direct URL (Library Build)
- **Library** builds with `build.lib.worker`
- Worker is a separate entry point
- Worker file is deployed alongside the library
- `new URL('./worker.mjs', import.meta.url).href`

## Key Takeaway

**For library builds:** Don't use `?worker&url`. Use direct URL with `new URL()` and `import.meta.url`.

**For application builds:** Use `?worker&url` for inline workers.

## Test Results

After fix:
- ✅ Worker loads correctly (SharedWorker in 2.9s)
- ✅ Transformers.js initializes
- ✅ Model downloads and caches
- ✅ All 10 Phase 4 tests passing

---

**Referenced by:**
- `src/core/LokulMem.ts` (header comment)
- `vite.config.ts` (header comment)
- `.planning/phases/04-embedding-engine/04-FINAL-SUMMARY.md`
