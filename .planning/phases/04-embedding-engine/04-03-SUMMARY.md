---
phase: 04-embedding-engine
plan: 03
type: execute
wave: 1
subsystem: build-system
requires: []
provides: [wasm-bundling, worker-url-config, onnx-paths-config]
affects: [vite.config.ts, package.json, src/core/WorkerManager.ts, src/types/api.ts, src/core/Protocol.ts, src/worker/EmbeddingEngine.ts]
tech-stack:
  added: [vite-plugin-static-copy]
  patterns: [WASM-asset-bundling, permissive-url-validation]
key-files:
  created:
    - src/worker/EmbeddingEngine.ts
    - public/.gitkeep
  modified:
    - vite.config.ts
    - package.json
    - src/types/api.ts
    - src/core/Protocol.ts
    - src/core/WorkerManager.ts
    - src/core/types.ts
    - src/core/LokulMem.ts
decisions:
  - "Use vite-plugin-static-copy instead of rollup-plugin-copy for better Vite integration"
  - "WASM paths NOT defaulted to localModelBaseUrl to avoid airgap 404s"
  - "Permissive workerUrl validation accepting blob:, data:, extensionless URLs"
  - "ModelConfig extracted as explicit type in Protocol.ts for type safety"
metrics:
  duration: "~30 minutes"
  completed: "2026-02-23"
  tasks: 7
  files-created: 2
  files-modified: 7
  commits: 7
---

# Phase 04 Plan 03: Vite WASM Bundling and workerUrl Support

## Summary

Configured Vite build system to bundle ONNX Runtime WASM assets for offline/airgapped deployments. Implemented `workerUrl` option for custom worker resolution and `onnxPaths` option for custom ONNX WASM paths. Created foundational `EmbeddingEngine` class that will be expanded in subsequent plans.

## One-Liner

Vite build configured with vite-plugin-static-copy for WASM assets, workerUrl support with permissive validation, and onnxPaths configuration for custom ONNX Runtime deployments.

## What Was Built

### 1. vite-plugin-static-copy Integration
- Added `vite-plugin-static-copy` to devDependencies
- Configured to copy `*.wasm` and `ort-wasm*.mjs` files from `onnxruntime-web`
- Uses `silent: true` mode to handle missing files gracefully (dependency installed in 04-01)
- Asset file naming configured to preserve WASM filenames without hash

### 2. workerUrl Support in WorkerManager
- Added `validateWorkerUrl()` method with permissive validation
- Accepts: relative paths (`./worker.js`), absolute URLs (`https://...`), blob URLs (`blob:...`), data URLs (`data:...`), extensionless URLs (`/api/worker`)
- Logs warning only for URLs that don't look valid (doesn't block)
- Passes `workerUrl` through `InitPayload` to worker for reference

### 3. onnxPaths Configuration
- Added `onnxPaths?: string | Record<string, string>` to `LokulMemConfig`
- Added `ModelConfig` interface in `Protocol.ts` with full model configuration
- Updated `InitPayload` to use typed `ModelConfig` instead of `unknown`
- Updated `WorkerConfig` to use typed `ModelConfig`
- Created `EmbeddingEngine` class with `EmbeddingConfig` interface

### 4. EmbeddingEngine Foundation
- Singleton pattern for embedding computation management
- `EmbeddingConfig` interface with all model-related options
- `buildConfig()` method to construct config from `ModelConfig`
- Prepared for Transformers.js integration (04-01)
- Documents critical rule: wasmPaths NOT defaulted to localModelBaseUrl

### 5. package.json Updates
- Added explicit WASM patterns to `files` array: `dist/*.wasm`, `dist/ort-wasm*.mjs`
- Ensures WASM assets are included in npm package distribution

## Deviations from Plan

None - plan executed exactly as written.

## Key Design Decisions

### 1. vite-plugin-static-copy over rollup-plugin-copy
**Rationale:** Better Vite integration, handles both dev and production modes, actively maintained.

### 2. wasmPaths NOT defaulted to localModelBaseUrl
**Rationale:** In airgap setups, model files are commonly hosted under `/models/` while ORT wasm files are served from `/` (dist root). Pointing wasmPaths at model base often yields 404s. Leave wasmPaths unset to let ORT resolve from default served location.

### 3. Permissive workerUrl validation
**Rationale:** Users may need to use blob URLs, data URLs, or CDN routes without file extensions. Validation only warns, never blocks.

### 4. Typed ModelConfig in Protocol.ts
**Rationale:** Using `unknown` for `modelConfig` lost type safety. Explicit `ModelConfig` interface ensures proper typing across WorkerConfig, InitPayload, and EmbeddingConfig.

## Commits

| Hash | Message |
|------|---------|
| 1178b56 | chore(04-embedding-engine): install vite-plugin-static-copy for WASM asset handling |
| 2098c2d | feat(04-embedding-engine): configure Vite to bundle ORT WASM assets |
| d2f153b | feat(04-embedding-engine): add onnxPaths configuration option to LokulMemConfig |
| bc4ec29 | feat(04-embedding-engine): update InitPayload with model and ONNX configuration |
| 68f0322 | feat(04-embedding-engine): implement workerUrl support in WorkerManager |
| 1e7e567 | feat(04-embedding-engine): create EmbeddingEngine with ONNX WASM path configuration |
| d099036 | chore(04-embedding-engine): update package.json files array for WASM assets |

## Verification Results

All verification criteria met:
- [x] `npm run build` succeeds
- [x] `dist/` structure correct (WASM files will appear after onnxruntime-web installed)
- [x] `LokulMemConfig` has `onnxPaths` option
- [x] `InitPayload` includes `modelConfig` with `onnxPaths`
- [x] `WorkerManager` uses `workerUrl` when provided
- [x] `WorkerManager` accepts blob:, data:, extensionless URLs
- [x] `EmbeddingEngine` only configures wasmPaths when onnxPaths explicitly provided
- [x] `package.json` files array includes WASM patterns
- [x] Uses vite-plugin-static-copy (not rollup-plugin-copy)

## Self-Check: PASSED

All created files exist:
- [x] src/worker/EmbeddingEngine.ts
- [x] public/.gitkeep

All modified files committed:
- [x] vite.config.ts
- [x] package.json
- [x] src/types/api.ts
- [x] src/core/Protocol.ts
- [x] src/core/WorkerManager.ts
- [x] src/core/types.ts
- [x] src/core/LokulMem.ts

All commits verified:
- [x] 1178b56
- [x] 2098c2d
- [x] d2f153b
- [x] bc4ec29
- [x] 68f0322
- [x] 1e7e567
- [x] d099036

## Next Steps

Plan 04-03 is complete. The foundation is set for:
- Plan 04-01: Transformers.js integration with CDN and airgap modes (depends on this plan)
- Plan 04-02: LRU cache and concurrency queue (depends on 04-01)

The WASM bundling configuration is ready and will activate once `@huggingface/transformers` is installed in 04-01 (which brings in `onnxruntime-web` as a transitive dependency).
