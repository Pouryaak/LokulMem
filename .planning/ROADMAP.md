# Roadmap: LokulMem

**Project:** LokulMem - Browser-Native LLM Memory Management Library
**Created:** 2026-02-23
**Depth:** Standard
**Phases:** 8
**Requirements Mapped:** 82/82 v1 requirements

---

## Phases

- [x] **Phase 1: Foundation** - Project scaffolding, TypeScript build system, and core types (completed 2026-02-23)
- [x] **Phase 2: Worker Infrastructure** - SharedWorker coordination with graceful fallback chain (completed 2026-02-23)
- [x] **Phase 3: Storage Layer** - Dexie.js schema with memories, episodes, edges, clusters stores (completed 2026-02-23)
- [x] **Phase 4: Embedding Engine** - Transformers.js MiniLM with LRU cache and airgap support (completed 2026-02-24)
- [x] **Phase 5: Memory Store & Retrieval** - Brute-force vector search with composite relevance scoring (completed 2026-02-24)
- [x] **Phase 6: Lifecycle & Decay** - Ebbinghaus decay model with per-category lambda values (completed 2026-02-25)
- [x] **Phase 7: Extraction & Contradiction** - Fact extraction scoring and contradiction detection pipeline (completed 2026-02-25)
- [ ] **Phase 8: Public API & Demo** - Complete augment/learn/manage APIs with React demo app

---

## Phase Details

### Phase 1: Foundation
**Goal:** Project builds successfully with TypeScript, Vite library mode, and core type definitions ready for downstream phases.
**Depends on:** Nothing (first phase)
**Requirements:** TS-01, TS-02, TS-03, TS-04, TS-05
**Success Criteria** (what must be TRUE):
  1. `npm run build` produces tree-shakeable ESM bundle with type declarations
  2. Worker compiles as separate chunk without errors
  3. All public API types are defined and exported
  4. DTO pattern documented: embeddings excluded from public interfaces
  5. Project passes TypeScript strict mode with zero errors
**Plans:** 3/3 plans complete

Plans:
- [x] 01-01-PLAN.md — Project configuration (package.json, tsconfig.json, biome.json)
- [x] 01-02-PLAN.md — Vite build system (vite.config.ts, vitest.config.ts, entry points)
- [x] 01-03-PLAN.md — Core type definitions (public types, internal types, DTO pattern)

### Phase 2: Worker Infrastructure
**Goal:** Library initializes with optimal worker strategy (SharedWorker → DedicatedWorker → main thread) and reports progress through all stages.
**Depends on:** Phase 1
**Requirements:** WORKER-01, WORKER-02, WORKER-03, WORKER-04, WORKER-05
**Success Criteria** (what must be TRUE):
  1. Library detects SharedWorker availability and uses it when present
  2. Graceful fallback to DedicatedWorker when SharedWorker unavailable
  3. Final fallback to main thread when Workers unavailable
  4. `navigator.storage.persist()` called before worker spawn
  5. `onProgress` callback reports all 5 init stages: worker, model, storage, maintenance, ready
**Plans:** 3/3 plans complete

Plans:
- [x] 02-01-PLAN.md — WorkerManager with fallback chain (SharedWorker → DedicatedWorker → main thread)
- [x] 02-02-PLAN.md — Message protocol and WorkerClient for request/response correlation
- [x] 02-03-PLAN.md — LokulMem class integration with progress reporting

### Phase 3: Storage Layer
**Goal:** IndexedDB schema is established with all required stores, indexes, and migration support for memory persistence.
**Depends on:** Phase 2
**Requirements:** STORAGE-01, STORAGE-02, STORAGE-03, STORAGE-04
**Success Criteria** (what must be TRUE):
  1. Dexie.js schema v1 creates memories, episodes, edges, clusters stores on first run
  2. Memories table has all required indexes: id, types, status, clusterId, lastAccessedAt, baseStrength, validFrom, pinned, mentionCount, compound indexes
  3. Embedding field stores Float32Array without data corruption
  4. Schema migration chain established with version tracking for future upgrades
**Plans:** 3/3 plans complete

Plans:
- [x] 03-01-PLAN.md — Dexie database schema with all 4 stores and Float32Array embedding storage
- [x] 03-02-PLAN.md — StorageManager with error handling, migrations, and status tracking
- [x] 03-03-PLAN.md — MemoryRepository with CRUD operations using all compound indexes

### Phase 4: Embedding Engine
**Goal:** Transformers.js MiniLM loads in worker context with LRU caching and supports both CDN and airgapped deployments.
**Depends on:** Phase 3
**Requirements:** EMBED-01..10
**Success Criteria** (what must be TRUE):
  1. MiniLM-L6-v2 loads and runs inference in worker context (not main thread)
  2. LRU cache (1000 entries) prevents redundant embedding computation
  3. Promise queue ensures only one embedding call runs at a time
  4. Model loads from CDN with Cache API persistence
  5. `localModelBaseUrl` option enables fully offline/airgapped usage
  6. ONNX WASM paths configurable for custom deployment scenarios
  7. ORT assets (ort-wasm*.wasm, ort-wasm*.mjs) bundled into dist via glob patterns
  8. `workerUrl` option supported for custom worker resolution
  9. Airgap mode explicitly sets env.allowLocalModels=true, env.allowRemoteModels=false, env.localModelPath=<localModelBaseUrl>
  10. Airgap mode requires consumers to host model assets mirroring `Xenova/all-MiniLM-L6-v2` repository structure
**Plans:** 3 plans created

Plans:
- [x] 04-03-PLAN.md — Vite WASM bundling and workerUrl support (Wave 1 - Foundation)
- [x] 04-01-PLAN.md — Transformers.js integration with CDN and airgap modes (Wave 2)
- [x] 04-02-PLAN.md — LRU cache and concurrency queue (Wave 2)

### Phase 5: Memory Store & Retrieval
**Goal:** Vector search retrieves relevant memories using composite scoring with token-aware dynamic K selection.
**Depends on:** Phase 4
**Requirements:** SEARCH-01..07, MGMT-01..09
**Success Criteria** (what must be TRUE):
  1. Brute-force cosine similarity search completes in <30ms for N ≤ 3000 memories
  2. Composite R(m,q) scoring combines semantic (0.40), recency (0.20), strength (0.25), continuity (0.15)
  3. Pinned memories receive maximum strength weight regardless of actual strength
  4. Token-aware dynamic K adjusts retrieval count based on available context window
  5. Only memories with R > 0.3 are considered for injection
  6. Management query methods work: list, get, getByConversation, getRecent, getTop, getPinned, search, semanticSearch, getTimeline, getGrouped, getInjectionPreview
  7. Active memory embeddings loaded into in-memory cache; cache stays in sync with mutations
**Plans:** 3/3 plans complete

### Phase 6: Lifecycle & Decay
**Goal:** Memories decay according to Ebbinghaus forgetting curve with per-category rates, pinned memories exempt from decay.
**Depends on:** Phase 5
**Requirements:** DECAY-01..09
**Success Criteria** (what must be TRUE):
  1. Ebbinghaus decay calculates strength(t) = base_strength × e^(-λ × Δt_hours) correctly
  2. Per-category lambda values apply: identity (0.0001), location (0.0005), profession (0.0003), preferences (0.001), project (0.005), temporal (0.02), relational (0.0004), emotional (0.01)
  3. Pinned memories have λ = 0 and never decay
  4. Memory retrieval reinforces strength by +0.3 (capped at 3.0)
  5. Maintenance sweep runs at session start and updates all memory strengths
  6. Faded memories (strength < 0.1) marked as faded, auto-deleted after 30 days
  7. K-means clustering runs synchronously in worker to organize memories
  8. `fadedAt` timestamp field records when memory transitioned to faded status
  9. Faded memory deletion runs during session-start maintenance sweep
**Plans:** 4/4 plans complete

Plans:
- [x] 06-01-PLAN.md — Decay calculator and reinforcement tracker (Wave 1)
- [x] 06-02-PLAN.md — Maintenance sweep and event emitter (Wave 2)
- [x] 06-03a-PLAN.md — K-means clustering and worker integration (Wave 2)
- [x] 06-03b-PLAN.md — Public API event callbacks (Wave 2)

### Phase 7: Extraction & Contradiction
**Goal:** Facts are extracted from conversations with quality scoring, contradictions detected and resolved with supersession chains.
**Depends on:** Phase 6
**Requirements:** EXTRACT-01..07, CONTRA-01..06
**Success Criteria** (what must be TRUE):
  1. Specificity NER detects: names (0.3), places (0.25), numbers (0.2), preferences (0.25), dates (0.2), negations (0.2), first-person possession (0.10); clamp sum to 1.0
  2. Novelty computed via 1 - top1_similarity using vector search
  3. Recurrence tracked within session when cosine similarity > 0.85
  4. E(s) = 0.35×novelty + 0.45×specificity + 0.20×recurrence calculated for extraction decisions
  5. Extraction threshold default 0.55 filters low-quality facts
  6. Memory types classified: identity, location, profession, preference, project, temporal, relational, emotional
  7. Entities extracted and stored with each memory
  8. Contradiction: retrieve topK candidates (5-10), evaluate any with similarity > 0.80, choose best typed-attribute match
  9. Temporal markers detected (16 patterns: "used to", "previously", "no longer", etc.)
  10. Temporal updates set validTo on existing memory, validFrom on new memory
  11. Typed attribute conflicts mark existing memory as superseded
  12. Contradiction events emitted via callback with full details
  13. Supersession chains preserved with supersededBy and supersededAt fields
**Plans:** 4/4 plans complete

Plans:
- [x] 07-01-PLAN.md — Structured Attribute Extraction (Wave 1)
- [x] 07-02-PLAN.md — Temporal Marker Tracking (Wave 2)
- [x] 07-03a-PLAN.md — Database Schema for Supersession (Wave 3)
- [x] 07-03b-PLAN.md — Contradiction Detection Engine (Wave 4)

### Phase 8: Public API & Demo
**Goal:** Complete public API surface with augment/learn/manage methods, event system, and working React demo application.
**Depends on:** Phase 7
**Requirements:** AUG-01, AUG-02, AUG-03, AUG-04, AUG-05, AUG-06, AUG-07, LEARN-01, LEARN-02, LEARN-03, LEARN-04, LEARN-05, MGMT-10, MGMT-11, MGMT-12, MGMT-13, MGMT-14, MGMT-15, MGMT-16, EVENT-01, EVENT-02, EVENT-03, EVENT-04, EVENT-05, EVENT-06, EVENT-07, DEMO-01, DEMO-02, DEMO-03, DEMO-04
**Success Criteria** (what must be TRUE):
  1. `augment()` accepts userMessage, history[], options; returns augmented messages array ready for LLM
  2. `augment()` returns LokulMemDebug when options.debug = true with injected memories, scores, breakdowns, excluded candidates, token usage, latency metrics
  3. `augment()` uses prepend-system injection format
  4. `learn()` accepts userMessage, assistantResponse, options; returns extracted memories, contradictions detected, faded memories from maintenance
  5. `learn()` updates in-memory vector cache after extraction
  6. `manage()` supports full CRUD: update, pin, unpin, archive, unarchive, delete
  7. `manage()` supports bulk operations: deleteMany, archiveMany, pinMany, unpinMany
  8. `manage()` supports clear, stats, export, exportToMarkdown, import with merge options
  9. All event callbacks work: onMemoryAdded, onMemoryUpdated, onMemoryDeleted, onMemoryFaded, onStatsChanged, onContradictionDetected
  10. All event callbacks return unsubscribe functions
  11. React demo app exists in `examples/react-app/` with isolated package.json
  12. Demo visualizes debug object from augment() in real-time
  13. Demo shows reactive memory list using manage().list()
  14. Demo does not pollute root package.json with React dependencies
**Plans:** 6/6 plans complete

Plans:
- [x] 08-01-PLAN.md — augment() API with prepend-system injection and token-aware dynamic K
- [x] 08-02-PLAN.md — learn() API with extraction pipeline and synchronous cache updates
- [x] 08-03-PLAN.md — manage() namespace with 16+ inspection and manipulation methods
- [x] 08-04-PLAN.md — Event system with IDs-only payloads and optional verbose mode
- [x] 08-05-PLAN.md — Worker RPC integration for augment/learn/manage APIs
- [x] 08-06-PLAN.md — React demo app with isolated workspace

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete    | 2026-02-23 |
| 2. Worker Infrastructure | 3/3 | Complete    | 2026-02-23 |
| 3. Storage Layer | 3/3 | Complete | 2026-02-23 |
| 4. Embedding Engine | 3/3 | Complete | 2026-02-24 |
| 5. Memory Store & Retrieval | 3/3 | Complete    | 2026-02-24 |
| 6. Lifecycle & Decay | 4/4 | Complete    | 2026-02-25 |
| 7. Extraction & Contradiction | 4/4 | Complete   | 2026-02-25 |
| 8. Public API & Demo | 0/3 | Not started | - |

---

## Requirement Coverage

| Category | Requirements | Phase | Count |
|----------|--------------|-------|-------|
| TS | TS-01..05 | Phase 1 | 5 |
| WORKER | WORKER-01..05 | Phase 2 | 5 |
| STORAGE | STORAGE-01..04 | Phase 3 | 4 |
| EMBED | EMBED-01..10 | Phase 4 | 10 |
| SEARCH | SEARCH-01..07 | Phase 5 | 7 |
| MGMT (query) | MGMT-01..09 | Phase 5 | 9 |
| DECAY | DECAY-01..09 | Phase 6 | 9 |
| EXTRACT | EXTRACT-01..07 | Phase 7 | 7 |
| CONTRA | CONTRA-01..06 | Phase 7 | 6 |
| AUG | AUG-01..07 | Phase 8 | 7 |
| LEARN | LEARN-01..05 | Phase 8 | 5 |
| MGMT (mutate) | MGMT-10..16 | Phase 8 | 7 |
| EVENT | EVENT-01..07 | Phase 8 | 7 |
| DEMO | DEMO-01..04 | Phase 8 | 4 |

**Total:** 82/82 requirements mapped ✓

---

## Dependencies

```
Phase 1 (Foundation)
    ↓
Phase 2 (Worker Infrastructure)
    ↓
Phase 3 (Storage Layer)
    ↓
Phase 4 (Embedding Engine)
    ↓
Phase 5 (Memory Store & Retrieval)
    ↓
Phase 6 (Lifecycle & Decay)
    ↓
Phase 7 (Extraction & Contradiction)
    ↓
Phase 8 (Public API & Demo)
```

---

## Research Flags

Per research/SUMMARY.md, the following phases may need deeper research during planning:

- **Phase 5 (Memory Store & Retrieval):** MEDIUM — Performance characteristics of brute-force search at scale need validation. Recommend benchmarking at 1K, 2K, 3K memory thresholds.
- **Phase 7 (Extraction & Contradiction):** HIGH — Complex NLP-adjacent logic with temporal marker parsing and typed attribute extraction. Recommend `/gsd:research-phase` before implementation.

---

## Notes

- Phase ordering follows the architecture's dependency chain: database schema → embedding capability → data access → business logic → API surface → demo application
- Worker infrastructure is split into Phase 2 (coordination) and Phase 4 (embedding) because embedding depends on storage being ready
- Phase 5 combines retrieval with query management methods because they share the same data access patterns
- Phase 8 combines all public API methods (augment, learn, manage) with events and demo because they represent the complete user-facing surface

---

*Roadmap created: 2026-02-23*
*Last updated: 2026-02-23 (Phase 4 plans created)*
