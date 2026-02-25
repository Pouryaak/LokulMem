---
phase: 07-extraction-contradiction
plan: 03a
subsystem: Supersession & Tombstone Management
tags: [database, repository, vector-search, supersession, migration]
wave: 3

dependency_graph:
  provides:
    - "Database schema v2 with supersession tracking"
    - "Supersession methods for contradiction detection"
    - "Conflict domain search for candidate retrieval"
  requires:
    - "Phase 7 Plan 01: Extraction quality pipeline"
    - "Phase 7 Plan 02: Temporal marker tracking"
  affects:
    - "Plan 07-03b: Contradiction detection engine implementation"

tech_stack:
  added:
    - "deletedAt field for tombstone tracking"
    - "Database version 2 with supersededAt index"
    - "Supersession methods: supersede(), findExpiredSuperseded(), stripToTombstone(), getSupersessionChain()"
    - "Conflict domain search: searchByConflictDomain()"
  patterns:
    - "Dexie version upgrade with backward compatibility"
    - "Supersession chain tracing via supersededBy pointers"
    - "Tombstone retention with metadata preservation"

key_files:
  created: []
  modified:
    - path: "src/storage/Database.ts"
      changes: "Added deletedAt field, version 2 schema with supersededAt index, migration logic"
      lines_added: 45
    - path: "src/storage/embeddingStorage.ts"
      changes: "Fixed memoryToDb to include deletedAt, fixed memoryFromDb to infer conflictDomain"
      lines_added: 40
    - path: "src/storage/MemoryRepository.ts"
      changes: "Added supersession methods (supersede, findExpiredSuperseded, stripToTombstone, getSupersessionChain)"
      lines_added: 119
    - path: "src/search/VectorSearch.ts"
      changes: "Added conflictDomain to metaCache, added searchByConflictDomain method"
      lines_added: 59

decisions:
  - "deletedAt is intentionally NOT in stores() string - uses .and() filter for queries"
  - "conflictDomain inferred from types during memoryFromDb conversion"
  - "Tombstone retention period: 30 days with metadata preservation"
  - "Supersession chains traced via supersededBy pointers (forward only)"

metrics:
  duration: "3 minutes"
  completed_date: "2026-02-25"
  tasks_completed: 3
  files_modified: 4
  lines_added: 263
  commits: 3
---

# Phase 7 Plan 03a: Database Schema for Supersession - Summary

Extended the database schema and repository layer to support supersession tracking, tombstone management, and conflict domain search for contradiction detection.

## One-Liner

Database schema v2 with supersession tracking (deletedAt, supersededAt index), supersession methods (supersede, tombstone creation, chain tracing), and conflict domain search for candidate retrieval.

---

## Implementation Highlights

### Task 1: Database Schema Extension
- Added `deletedAt` field to `DbMemoryRow` interface for tombstone tracking
- Created version 2 schema with `supersededAt` index for efficient cleanup queries
- Kept version 1 for backward compatibility during migration
- Migration logic initializes `supersededAt` and `deletedAt` to null for existing records
- Updated `exportData()` to include `deletedAt` field in exports

**File:** `src/storage/Database.ts`
- Line 82: Added `deletedAt: number | null` field
- Line 154-184: Added version 2 schema with migration

### Task 2: Supersession Methods
- `supersede(oldMemoryId, newMemoryId)`: Marks old memory as superseded with metadata
- `findExpiredSuperseded()`: Finds superseded memories older than 30 days for tombstone cleanup
- `stripToTombstone(memoryId)`: Removes content and embedding while preserving traceability metadata
- `hashContent(content)`: Simple hash for tombstone deduplication
- `getSupersessionChain(memoryId)`: Traces A -> B -> C relationships via supersededBy pointers

**File:** `src/storage/MemoryRepository.ts`
- Lines 563-670: Supersession methods implementation

**Key Design Decision:** Tombstone semantics preserve minimal metadata (types, conflictDomain, supersededAt/by, validFrom/validTo, sourceConversationIds, contentHash) instead of stripping all to empty arrays. This maintains chain traceability.

### Task 3: Conflict Domain Search
- Extended `metaCache` to include `conflictDomain` field
- Updated `initialize()`, `add()`, `update()` methods to cache conflictDomain
- Added `searchByConflictDomain(query, conflictDomain, k)` for candidate retrieval
- Filters results by conflict domain during iteration
- Sorts by similarity descending and slices to k limit

**File:** `src/search/VectorSearch.ts`
- Lines 43-60: Extended metaCache type with conflictDomain
- Lines 323-359: searchByConflictDomain implementation

### Deviation Fix: Conflict Domain Inference
During Task 1, discovered that `conflictDomain` was not in MemoryDTO but required in MemoryInternal. Fixed `memoryFromDb()` to infer conflictDomain from types using the same logic as `createMemoryInternal()`.

**File:** `src/storage/embeddingStorage.ts`
- Lines 109-147: Added `inferConflictDomain()` helper
- Lines 149-164: Updated `memoryFromDb()` to compute conflictDomain

---

## Deviations from Plan

### Rule 2 - Auto-add Missing Critical Functionality

**1. Fixed conflictDomain inference in memoryFromDb**
- **Found during:** Task 1 (database schema extension)
- **Issue:** `conflictDomain` is required in MemoryInternal but not stored in database
- **Fix:** Added `inferConflictDomain()` helper to compute conflictDomain from types during memoryFromDb conversion
- **Files modified:** `src/storage/embeddingStorage.ts`
- **Commit:** 5d3ca35

---

## Success Criteria

All success criteria met:

- [x] **Database schema v2** adds supersededAt and deletedAt fields
- [x] **Migration from v1 to v2** handles undefined fields safely with null initialization
- [x] **Supersession methods** handle status changes, tombstone creation, and chain tracing
- [x] **Conflict domain search** returns candidate memories for contradiction detection

---

## Performance Notes

- Build time: ~14 seconds (unchanged)
- Bundle size impact: ~2.7 kB (minimal - added supersession methods and conflict domain search)
- Migration overhead: One-time operation on database open, scales linearly with memory count
- Conflict domain search: O(N) iteration over cached embeddings (acceptable for N ≤ 3000)

---

## Next Steps

Plan 07-03b will build on this foundation to implement:
- ContradictionDetector with similarity > 0.80 threshold evaluation
- SupersessionManager with 30-day tombstone retention and cleanup
- IPC protocol extensions (CONTRADICTION_DETECTED, MEMORY_SUPERSEDED)
- Public API callbacks (onContradictionDetected, onMemorySuperseded)

---

## Commits

- `5d3ca35`: feat(07-03a): extend database schema for supersession
- `f0b9d1b`: feat(07-03a): add supersession methods to MemoryRepository
- `26a4f58`: feat(07-03a): add conflict domain search to VectorSearch
