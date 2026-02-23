---
phase: 03-storage-layer
plan: 01
type: summary
subsystem: storage
tags: [dexie, indexeddb, schema, embeddings]
dependencies:
  requires: []
  provides: [03-02, 03-03]
  affects: [04-embedding, 05-retrieval]
tech-stack:
  added: [dexie@^4.0.11]
  patterns: [ArrayBuffer embedding storage, multi-entry indexes, compound indexes]
key-files:
  created:
    - src/storage/Database.ts
    - src/storage/embeddingStorage.ts
  modified:
    - src/internal/types.ts
    - package.json
decisions:
  - Use pinnedInt (number 0|1) instead of boolean for IndexedDB indexing
  - Use explicit ArrayBuffer.slice() to avoid TypedArray view footgun
  - Store embeddings as ArrayBuffer in DB, Float32Array in runtime
  - No [types+status] compound index (incompatible with multiEntry)
metrics:
  duration: 15
  tasks: 3
  files-created: 2
  files-modified: 2
  lines-added: 354
---

# Phase 03 Plan 01: Database Foundation Summary

## One-Liner

Dexie.js database foundation with 4 stores (memories, episodes, edges, clusters) and Float32Array embedding storage with proper ArrayBuffer conversion utilities.

## What Was Built

### Database.ts (192 lines)
- **LokulDatabase class** extending Dexie with v1 schema
- **4 typed tables**: memories, episodes, edges, clusters
- **DbMemoryRow interface**: Memory storage format with ArrayBuffer embeddings
- **DbClusterRow interface**: Cluster storage format with centroid embeddings
- **Comprehensive indexes**:
  - Multi-entry: `*types` for array membership queries
  - Compound: `[status+lastAccessedAt]`, `[clusterId+status]`, `[status+baseStrength]`
  - Single: status, clusterId, baseStrength, validFrom, pinnedInt, mentionCount
- **getVersion()** method for database version inspection

### embeddingStorage.ts (162 lines)
- **toDbFormat()**: Float32Array -> ArrayBuffer with explicit slice
- **fromDbFormat()**: ArrayBuffer -> Float32Array with dimension validation
- **memoryToDb() / memoryFromDb()**: Memory conversion with pinnedInt handling
- **clusterToDb() / clusterFromDb()**: Cluster conversion utilities
- **ClusterInternal interface**: Runtime cluster representation
- **EXPECTED_EMBEDDING_DIM = 384**: MiniLM-L6-v2 dimension constant

### internal/types.ts (modified)
- **ClusterInternal interface**: Added with id, embedding, memoryIds, createdAt

## Technical Decisions

### ArrayBuffer Storage Pattern
Float32Array is a view onto an underlying ArrayBuffer. When storing to IndexedDB, using `embedding.buffer` directly can include extra bytes if the view was created via `.slice()` or `.subarray()`. The explicit `.slice(byteOffset, byteOffset + byteLength)` creates a standalone buffer with exactly the embedding data.

### pinnedInt vs pinned Boolean
IndexedDB cannot reliably index boolean values. Using `pinnedInt` (1 for true, 0 for false) enables efficient queries for pinned memories.

### Multi-Entry Index Limitation
The `*types` multi-entry index (for array membership) cannot be combined in compound indexes. This is an IndexedDB limitation we accept - queries filtering by both type and status will use the status index then filter.

## Verification Results

- [x] `npm run typecheck` passes with zero errors
- [x] `npm run build` produces valid output
- [x] All 4 stores defined with correct TypeScript types
- [x] All required indexes present on memories table
- [x] Embedding conversion validates dimension (384)

## Commits

| Hash | Message | Files |
|------|---------|-------|
| a92da52 | chore(03-01): add dexie dependency | package.json, package-lock.json |
| db09b5b | fix(03-01): remove unused imports | src/storage/Database.ts |
| 957d7ec | feat(03-01): add ClusterInternal interface | src/internal/types.ts |
| dd33373 | feat(03-01): add embedding storage conversion utilities | src/storage/embeddingStorage.ts |
| 87d9881 | feat(03-01): create Dexie database with v1 schema | src/storage/Database.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript SharedArrayBuffer type error**
- **Found during:** Task 2
- **Issue:** `ArrayBuffer.slice()` returns `ArrayBuffer | SharedArrayBuffer`, causing type mismatch
- **Fix:** Added `as ArrayBuffer` type assertion in `toDbFormat()`
- **Commit:** dd33373 (amended during pre-commit)

**2. [Rule 1 - Bug] Unused imports added by linter**
- **Found during:** Final verification
- **Issue:** Pre-commit hook auto-added imports (LokulMemExport, memoryFromDb, etc.) that weren't used
- **Fix:** Removed unused imports from Database.ts
- **Commit:** db09b5b

### Task 3 Pre-completed
The ClusterInternal interface was added to `internal/types.ts` by the pre-commit hook during Task 2. Task 3 was verified as complete rather than re-implementing.

## Next Steps

Plan 03-02 (Storage CRUD Operations) can now proceed with:
- Database.ts and embeddingStorage.ts as foundation
- ClusterInternal available from internal/types
- Dexie dependency installed and ready
