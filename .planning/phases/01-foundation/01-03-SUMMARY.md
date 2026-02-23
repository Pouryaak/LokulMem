---
phase: 01-foundation
plan: 03
subsystem: types
tags: [typescript, dto, public-api, internal-types]
dependency_graph:
  requires: [01-01, 01-02]
  provides: [types]
  affects: [01-04, 02-01]
tech_stack:
  added: []
  patterns: [dto-pattern, explicit-type-exports, verbatimModuleSyntax]
key_files:
  created:
    - src/types/memory.ts
    - src/types/api.ts
    - src/types/events.ts
    - src/types/index.ts
    - src/internal/types.ts
    - src/internal/dto.ts
  modified:
    - src/index.ts
decisions:
  - Use number timestamps instead of Date for serialization compatibility
  - Memory types support multiple values per memory (types: MemoryType[])
  - DTO pattern excludes Float32Array embedding from public API
  - Internal types in src/internal/ are never exported publicly
  - Explicit type imports/exports per verbatimModuleSyntax
metrics:
  duration_minutes: 2
  completed_date: 2026-02-23
---

# Phase 1 Plan 3: Core Type Definitions Summary

**One-liner:** Complete TypeScript type system with DTO pattern separating public API types from internal implementation types with Float32Array embeddings.

## What Was Built

### Public Types (src/types/)

**memory.ts** - Core memory DTO without embeddings:
- `MemoryType` union: identity, location, profession, preference, project, temporal, relational, emotional
- `MemoryStatus` union: active, faded, archived, superseded
- `MemoryDTO` interface with 22 fields including metadata, no embedding field

**api.ts** - Configuration and options:
- `LokulMemConfig` - Database name, model URL, worker URL, extraction threshold, progress callback
- `InitStage` union - worker, model, storage, maintenance, ready
- `AugmentOptions` - maxTokens, debug flag
- `LearnOptions` - extractionThreshold
- `LokulMemDebug` - Detailed retrieval diagnostics with scores, token usage, latency

**events.ts** - Event system types:
- `MemoryStats` - Total, active, faded, pinned counts plus average strength
- Callback types: `MemoryCallback`, `MemoryIdCallback`, `StatsCallback`, `ContradictionCallback`
- `Unsubscribe` function type for event cleanup

**index.ts** - Public type barrel exports

### Internal Types (src/internal/)

**types.ts** - Implementation types with embeddings:
- `MemoryInternal` extends MemoryDTO with `embedding: Float32Array`
- `EpisodeInternal` for future episodic memory support
- `EdgeInternal` for memory graph relationships

**dto.ts** - Conversion utilities:
- `toMemoryDTO()` - Strips embedding from internal to public
- `toMemoryDTOs()` - Batch conversion
- `fromMemoryDTO()` - Attaches embedding to create internal
- `createMemoryInternal()` - Factory with sensible defaults

### Updated Entry Point

**src/index.ts** - Re-exports all public types, no internal exports

## Commits

| Hash | Message |
|------|---------|
| 89abd4e | feat(01-03): create public memory types with DTO pattern |
| 37a1498 | feat(01-03): create API and event types |
| 4d34d28 | feat(01-03): create internal types with embeddings and DTO conversion |

## Verification Results

- TypeScript compilation: PASS (npm run typecheck)
- Build generation: PASS (npm run build)
- Generated dist/main.d.ts contains public types only: VERIFIED
- No Float32Array in public types: VERIFIED (DTO pattern correct)
- Internal types not exported: VERIFIED

## Deviations from Plan

None - plan executed exactly as written.

## Deferred Items

Lint error in src/worker/index.ts from previous plan (01-02) - formatting issues with semicolons. Out of scope for this plan.

## Self-Check: PASSED

- [x] src/types/memory.ts exists with MemoryDTO (no embedding field)
- [x] src/types/api.ts exists with LokulMemConfig, AugmentOptions, LokulMemDebug
- [x] src/types/events.ts exists with MemoryStats and callback types
- [x] src/internal/types.ts exists with MemoryInternal (includes Float32Array)
- [x] src/internal/dto.ts exists with toMemoryDTO/fromMemoryDTO conversion functions
- [x] src/index.ts re-exports all public types from src/types/
- [x] npm run typecheck passes with zero errors
- [x] npm run build generates dist/main.d.ts with public types only
