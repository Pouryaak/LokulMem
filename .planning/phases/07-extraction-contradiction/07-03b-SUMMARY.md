---
phase: 07-extraction-contradiction
plan: 03b
subsystem: Contradiction Detection Engine
tags: [extraction, contradiction, supersession, ipc, events]
wave: 4

dependency_graph:
  provides:
    - "Contradiction detection with similarity > 0.80 threshold"
    - "Typed-attribute matching for resolution decisions"
    - "Supersession manager with 30-day tombstone retention"
    - "IPC protocol extensions for contradiction events"
    - "Public API callbacks for contradiction and supersession"
  requires:
    - "Phase 7 Plan 01: Extraction quality pipeline"
    - "Phase 7 Plan 02: Temporal marker tracking"
    - "Phase 7 Plan 03a: Database schema for supersession"
  affects:
    - "Phase 7 Plan 04: Worker integration (pending)"

tech_stack:
  added:
    - "ContradictionDetector with candidate retrieval and resolution"
    - "SupersessionManager with chain management and cleanup"
    - "CONTRADICTION_DETECTED and MEMORY_SUPERSEDED message types"
    - "onContradictionDetected and onMemorySuperseded callbacks"
  patterns:
    - "Typed-attribute matching for conflict resolution"
    - "Worker-side IPC event emission via callbacks"
    - "IDs-and-metadata-only event payloads per CONTEXT decision"

key_files:
  created:
    - path: "src/extraction/ContradictionDetector.ts"
      changes: "Contradiction detection with similarity filtering, temporal marker integration, resolution mode branching, typed-attribute matching"
      lines_added: 271
    - path: "src/extraction/SupersessionManager.ts"
      changes: "Supersession chain management, tombstone cleanup, validTo/validFrom timestamp setting, chain tracing"
      lines_added: 182
  modified:
    - path: "src/core/Protocol.ts"
      changes: "Added CONTRADICTION_DETECTED and MEMORY_SUPERSEDED message types and payload interfaces"
      lines_added: 46
    - path: "src/types/events.ts"
      changes: "Updated ContradictionEvent to IDs-and-metadata-only, added SupersessionEvent and SupersessionCallback"
      lines_added: 50
    - path: "src/core/WorkerManager.ts"
      changes: "Added onContradictionDetected and onMemorySuperseded methods with unsubscribe support"
      lines_added: 29
    - path: "src/core/LokulMem.ts"
      changes: "Added public API callbacks, handler arrays, lifecycle event listener setup for contradiction events"
      lines_added: 84
    - path: "src/extraction/_index.ts"
      changes: "Exported all contradiction detection classes and types"
      lines_added: 12

decisions:
  - "ContradictionEvent contains IDs and metadata only per CONTEXT decision (NOT full MemoryDTO)"
  - "Temporal marker decision based on NEW message, not existing message"
  - "ResolutionMode config branches detect() behavior (manual vs auto)"
  - "Worker-side IPC event emission via callbacks (onContradictionDetected, onMemorySuperseded)"
  - "Entities preserved as Entity[] structured, not stringified"
  - "Typed-attribute matching uses type overlap, entity overlap, and conflict domain"
  - "Auto-supersede identity/location with temporal marker, otherwise use match strength"

metrics:
  duration: "3 minutes"
  completed_date: "2026-02-25"
  tasks_completed: 6
  files_created: 2
  files_modified: 5
  lines_added: 674
  commits: 6
---

# Phase 7 Plan 03b: Contradiction Detection Engine - Summary

Implemented contradiction detection and resolution engine with typed-attribute matching, supersession chain management, worker-side IPC event emission, and public API callbacks for downstream consumers.

## One-Liner

Contradiction detection engine with similarity > 0.80 threshold filtering, temporal marker integration, typed-attribute matching for resolution (supersede/parallel/pending), supersession manager with 30-day tombstone retention, and public API callbacks (onContradictionDetected, onMemorySuperseded).

---

## Implementation Highlights

### Task 1: ContradictionDetector Class
- **File:** `src/extraction/ContradictionDetector.ts` (271 lines)
- **Features:**
  - `detect()` retrieves top 7 candidates from conflict domain via `searchByConflictDomain()`
  - Filters by similarity > 0.80 threshold
  - Integrates with TemporalMarkerDetector for factual change detection
  - Resolution mode branching: manual mode returns 'pending', auto mode applies typed-attribute matching
  - Auto-supersede identity/location with temporal marker, otherwise use match strength > 0.7
  - Worker-side IPC event emission via `onContradictionDetected` callback
- **Key Interfaces:**
  - `ContradictionEvent`: IDs and metadata only (newMemoryId, conflictingMemoryId, similarity, hasTemporalMarker, resolution, timestamps, types, conflictDomain)
  - `ContradictionConfig`: similarityThreshold (0.80), candidateK (7), resolutionMode ('auto'|'manual'), onContradictionDetected callback

**Typed-Attribute Matching Algorithm:**
- Type overlap: +0.3 if primary types match
- Entity overlap: +0.15 per shared entity (max 0.5)
- Conflict domain match: +0.2
- Returns supersede if > 0.7 with temporal marker, pending if > 0.7 without, parallel otherwise

### Task 2: SupersessionManager Class
- **File:** `src/extraction/SupersessionManager.ts` (182 lines)
- **Features:**
  - `applySupersession()` sets status='superseded', supersededBy, supersededAt
  - Sets validTo/validFrom when temporal marker present
  - Worker-side IPC event emission via `onMemorySuperseded` callback
  - `cleanupOldSuperseded()` finds superseded memories older than 30 days and creates tombstones
  - `getChain()` traces A -> B -> C relationships via supersededBy pointers
- **Key Interfaces:**
  - `SupersessionEvent`: oldMemoryId, newMemoryId, timestamp
  - `SupersessionResult`: Same as SupersessionEvent
  - `SupersessionManagerConfig`: onMemorySuperseded callback

### Task 3: IPC Protocol Extensions
- **File:** `src/core/Protocol.ts`
- **Added Message Types:**
  - `CONTRADICTION_DETECTED`: ContradictionDetectedPayload
  - `MEMORY_SUPERSEDED`: MemorySupersededPayload
- **Payload Interfaces:**
  - `ContradictionDetectedPayload`: IDs and metadata only (matches ContradictionEvent structure)
  - `MemorySupersededPayload`: oldMemoryId, newMemoryId, timestamp

### Task 4: WorkerManager Event Handlers
- **File:** `src/core/WorkerManager.ts`
- **Added Methods:**
  - `onContradictionDetected(handler)`: Returns unsubscribe function, delegates to `on('CONTRADICTION_DETECTED')`
  - `onMemorySuperseded(handler)`: Returns unsubscribe function, delegates to `on('MEMORY_SUPERSEDED')`
- **Pattern:** Both methods support IDs-and-metadata payloads per CONTEXT decision

### Task 5: LokulMem Public API
- **File:** `src/core/LokulMem.ts`
- **Added Handler Arrays:** `contradictionHandlers`, `supersededHandlers`
- **Added Public Methods:**
  - `onContradictionDetected(handler)`: Returns unsubscribe function, delegates to WorkerManager
  - `onMemorySuperseded(handler)`: Returns unsubscribe function, delegates to WorkerManager
- **Updated Lifecycle:** `setupLifecycleEventListeners()` now listens for CONTRADICTION_DETECTED and MEMORY_SUPERSEDED events, `terminate()` clears new handler arrays

### Task 6: Extraction Barrel Exports
- **File:** `src/extraction/_index.ts`
- **Added Exports:**
  - `ContradictionDetector`, `ContradictionEvent`, `ContradictionCandidate`, `ContradictionConfig`
  - `SupersessionManager`, `SupersessionResult`, `SupersessionEvent`, `SupersessionManagerConfig`

---

## Deviations from Plan

### None

All tasks executed as specified with the following key decisions honored:

1. **DTO Violation Fixed:** ContradictionEvent contains IDs and metadata only, NOT full MemoryDTO with content field
2. **Temporal Marker Logic:** hasTemporalMarker based on NEW message only, not existing
3. **ResolutionMode Branching:** Config properly branches detect() behavior (manual vs auto)
4. **IPC Event Emission:** Worker-side callbacks added for explicit event sinks
5. **Entities Structure:** Preserved as Entity[] structured, NOT stringified

---

## Success Criteria

All success criteria met:

- [x] **Retrieve topK candidates (7)** with similarity > 0.80 threshold
- [x] **Typed-attribute matching** chooses best conflict resolution
- [x] **Temporal markers detected** via TemporalMarkerDetector from 07-02
- [x] **Temporal updates set validTo/validFrom** when contradiction resolved
- [x] **Typed attribute conflicts mark existing as superseded** with status change
- [x] **Contradiction events emitted** via onContradictionDetected callback
- [x] **Supersession chains preserved** with supersededBy, supersededAt, deletedAt fields
- [x] **30-day tombstone retention** with stripToTombstone() cleanup
- [x] **Full chain traceability** via getSupersessionChain()

---

## Performance Notes

- Build time: ~13 seconds (unchanged)
- Bundle size impact: ~3.5 kB (added contradiction detection classes and IPC extensions)
- Similarity search: O(N) iteration over cached embeddings (acceptable for N ≤ 3000)
- Temporal marker detection: O(M) where M = content length (16 regex patterns)
- Typed-attribute matching: O(E) where E = entity count (typically < 10)

---

## Next Steps

Plan 07-04 will integrate contradiction detection into the worker pipeline:
- Wire up ContradictionDetector in worker during learn() operations
- Apply supersession when resolution='supersede'
- Emit IPC events for main thread callbacks
- Handle manual resolution mode (emit pending events, await user decision)

---

## Commits

- `1048377`: feat(07-03b): implement ContradictionDetector class
- `2f50815`: feat(07-03b): implement SupersessionManager class
- `c10885f`: feat(07-03b): extend IPC protocol for contradiction events
- `11f4a2d`: feat(07-03b): add contradiction handlers to WorkerManager
- `ab7b9d6`: feat(07-03b): add public API callbacks to LokulMem
- `4fbdebd`: feat(07-03b): update extraction barrel file
