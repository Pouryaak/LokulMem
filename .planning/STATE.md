# State: LokulMem

**Project:** LokulMem - Browser-Native LLM Memory Management Library
**Current Phase:** 08
**Current Plan:** 08-04
**Status:** In progress
**Updated:** 2026-02-26

---

## Project Reference

### Core Value
Developers can add persistent, privacy-preserving memory to any LLM application in under 10 minutes with three API calls: `augment()`, `learn()`, and `manage()`.

### Target Users
- WebLLM developers building local-first AI apps
- Developers adding memory to existing LLM integrations (OpenAI, Anthropic, Ollama)
- Privacy-conscious builders who don't want user data leaving the device

### Key Constraints
- **Tech Stack:** TypeScript, Vite, Transformers.js, Dexie.js — no switching
- **Bundle Size:** Library < 2MB gzipped (excluding ~22MB model weights)
- **Performance:** Retrieval < 30ms for N ≤ 3,000; embedding < 10ms warm cache
- **Privacy:** Zero network calls after initial model download (unless user opts into remote models)

---

## Current Position

### Phase Progress

```
[██████████] 100% - Phase 1: Foundation (Complete)
[██████████] 100% - Phase 2: Worker Infrastructure (Complete - 3 of 3 plans)
[██████████] 100% - Phase 3: Storage Layer (Complete - 3 of 3 plans)
[██████████] 100% - Phase 4: Embedding Engine (Complete - 3 of 3 plans)
[██████████] 100% - Phase 5: Memory Store & Retrieval (Complete - 3 of 3 plans)
[██████████] 100% - Phase 6: Lifecycle & Decay (Complete - 4 of 4 plans)
[██████████] 100% - Phase 7: Extraction & Contradiction (Complete - 4 of 4 plans)
[████████░░] 66% - Phase 8: Public API & Demo (4 of 6 plans complete)
```

### Active Work

**Plan 08-04 Complete!** Event system implemented in 4 minutes:

**Implemented:**
- EventManager class with Map-based handler registry (120 lines)
- Event types: EventConfig, MemoryEventPayload, StatsChangedPayload, EventType
- IDs-only payloads by default (verbose mode optional via verboseEvents config)
- 7 public API callback methods: onMemoryAdded, onMemoryUpdated, onMemoryDeleted, onMemoryFaded, onStatsChanged, onContradictionDetected, onMemorySuperseded
- All callbacks return unsubscribe functions
- Event emissions in Learner: MEMORY_ADDED after extraction, CONTRADICTION_DETECTED, MEMORY_SUPERSEDED, MEMORY_FADED
- Event emissions in Manager: MEMORY_UPDATED for mutations, MEMORY_DELETED for deletions, STATS_CHANGED for stats changes
- Event emissions at mutation points (not during queries)
- Error isolation in handler execution
- Embeddings never included in event payloads (per CONTEXT decision)

**Committed:**
- fb53a60: feat(08-04): add event system types to api/types.ts
- fc2d63c: feat(08-04): create EventManager class
- f978e1e: feat(08-04): integrate EventManager with LokulMem
- fbe656e: feat(08-04): add EventManager to Augmenter
- 4e467b3: feat(08-04): wire up event emissions in Learner
- 440c27d: feat(08-04): wire up event emissions in Manager
- 57baa8a: feat(08-04): update LokulMemConfig and API barrel
- d397ea6: fix(08-04): resolve TypeScript compilation errors

**Deviations:** 1 TypeScript compilation error (type safety fixes)

**Next Action:** Execute Plan 08-05: Augmenter Implementation

---

**Plan 07-03b Complete!** Contradiction detection engine implemented in 3 minutes:

**Implemented:**
- ContradictionDetector with similarity > 0.80 threshold filtering
- Typed-attribute matching for resolution decisions (supersede/parallel/pending)
- Temporal marker integration for factual change detection
- Resolution mode branching (manual vs auto)
- SupersessionManager with chain management and 30-day tombstone cleanup
- IPC protocol extensions (CONTRADICTION_DETECTED, MEMORY_SUPERSEDED)
- WorkerManager event handlers (onContradictionDetected, onMemorySuperseded)
- Public API callbacks in LokulMem for contradiction and supersession events
- ContradictionEvent contains IDs and metadata only per CONTEXT decision

**Committed:**
- 1048377: feat(07-03b): implement ContradictionDetector class
- 2f50815: feat(07-03b): implement SupersessionManager class
- c10885f: feat(07-03b): extend IPC protocol for contradiction events
- 11f4a2d: feat(07-03b): add contradiction handlers to WorkerManager
- ab7b9d6: feat(07-03b): add public API callbacks to LokulMem
- 4fbdebd: feat(07-03b): update extraction barrel file

**Deviations:** None - plan executed exactly as written.

**Next Action:** Execute Plan 07-04: Worker Integration

---

**Plan 07-03a Complete!** Database schema for supersession implemented in 3 minutes:

**Implemented:**
- Database schema v2 with deletedAt field and supersededAt index
- Migration from v1 to v2 with backward compatibility
- Supersession methods: supersede(), findExpiredSuperseded(), stripToTombstone(), getSupersessionChain()
- Conflict domain search: searchByConflictDomain() in VectorSearch
- conflictDomain inference in memoryFromDb conversion
- Tombstone semantics with metadata preservation (30-day retention)

**Committed:**
- 5d3ca35: feat(07-03a): extend database schema for supersession
- f0b9d1b: feat(07-03a): add supersession methods to MemoryRepository
- 26a4f58: feat(07-03a): add conflict domain search to VectorSearch

**Deviations:** 1 issue (conflictDomain inference missing in memoryFromDb - fixed with Rule 2)

**Next Action:** Execute Plan 07-03b: Contradiction Detection Engine

---

**Plan 07-02 Complete!** Temporal marker tracking implemented in 2 minutes:

**Implemented:**
- TemporalMarkerDetector class with 16 temporal patterns (used to, previously, no longer, etc.)
- TemporalMarker and TemporalUpdate types (no position tracking per Phase 7 decision)
- ConflictDomain type with 8 domain values (identity, location, profession, preference, temporal, relational, emotional, project)
- Extended MemoryInternal interface with conflictDomain field
- Updated fromMemoryDTO and createMemoryInternal to infer conflictDomain from types
- Change type inference from content keywords (location, profession, preference, identity, general)
- Static mapToConflictDomain() helper for type-to-domain mapping
- getTimestampRange() for temporal update handling
- Exported TemporalMarkerDetector from extraction barrel file

**Committed:**
- e9d90fd: feat(07-02): implement TemporalMarkerDetector and ConflictDomain type
- 3710b2f: feat(07-02): export TemporalMarkerDetector from extraction barrel

**Deviations:** None - plan executed exactly as written.

**Next Action:** Execute Plan 07-03a: Contradiction Detection Engine

---

**Plan 07-01 Complete!** Extraction quality pipeline implemented in 6 minutes:

**Implemented:**
- SpecificityNER class with regex-based entity extraction (7 entity types)
- NoveltyCalculator using VectorSearch with k=1 for efficient novelty computation
- RecurrenceTracker for session-based recurrence detection with content hashing
- QualityScorer computing E(s) = 0.35×novelty + 0.45×specificity + 0.20×recurrence
- Extraction threshold default 0.55 (configurable with type-specific overrides)
- Entity, ExtractionScore, ExtractionConfig types added to memory.ts

**Committed:**
- d249585: feat(07-01): add extraction types to type definitions
- 5ad448b: feat(07-01): implement SpecificityNER class
- 6282d12: feat(07-01): implement NoveltyCalculator class
- e7cc572: feat(07-01): implement RecurrenceTracker class
- 0b70890: feat(07-01): implement QualityScorer class
- 88de710: feat(07-01): create extraction barrel file

**Deviations:** 3 issues (unused variables and possibly undefined array access - all resolved)

**Next Action:** Execute Plan 07-02: Temporal Marker Tracking

---

**Phase 7 Planning:** 4 plans created for Extraction & Contradiction phase

**Plan 07-02: Temporal Marker Tracking** (Wave 2 - Integration)
- TemporalMarkerDetector class with 16 temporal patterns
- Temporal classification: past, former, change, correction
- Change type inference from content keywords
- Conflict domain mapping (8 domains)
- Requirements: CONTRA-02, CONTRA-03

**Plan 07-03: Contradiction Detection Engine** (Wave 3 - Integration)
- Database schema v2 with deletedAt field and supersededAt index
- MemoryRepository supersession methods (supersede, findExpiredSuperseded, stripToTombstone, getSupersessionChain)
- VectorSearch.searchByConflictDomain() for candidate retrieval
- ContradictionDetector with similarity > 0.80 threshold, 7 candidates
- SupersessionManager with 30-day tombstone retention
- IPC protocol extensions (CONTRADICTION_DETECTED, MEMORY_SUPERSEDED)
- Public API callbacks (onContradictionDetected, onMemorySuperseded)
- Requirements: CONTRA-01, CONTRA-04, CONTRA-05, CONTRA-06

**Implementation Decisions:**

**Extraction Quality Scoring:**
- Default threshold: E(s) ≥ 0.55 (moderate - balanced for general use)
- Configurable: expose `extractionThreshold` in LokulMem constructor
- Type-specific thresholds: stricter for identity facts, more lenient for preferences/emotional states
- Minimum novelty gate: require novelty ≥ 0.15 (configurable) to prevent near-duplicates
- Novelty computation: MUST use vectorSearch.search(embed(s), k=1) to avoid O(N) loops

**Contradiction Detection:**
- Similarity threshold: Cosine ≥ 0.80 (moderate - catches conflicts without over-flagging)
- Candidate retrieval: 7 candidates (balanced performance vs thoroughness)
- Resolution mode: Configurable - support both manual resolution and auto-resolution (typed-attribute matching)
- Type restriction: Conflict-domain based - check contradictions within same conflict domain, not exact memory type
- Detection timing: Run synchronously during every `learn()` call (not batched)

**Supersession Chains:**
- Retention period: 30-day tombstone retention
- Day 0-30: Superseded memory kept with full content (searchable with flag)
- After 30 days: Strip embedding and content, keep tombstone record only
- Status representation: 'superseded' status (separate from 'faded' or 'archived')
- Event emission: Emit onMemorySuperseded callback when memory is superseded
- Reversibility: No - supersession is one-way only (users can re-learn if needed)

---

**Previous Phase 6 Complete!** All 4 plans executed successfully.

**Worker Integration:**
- LifecycleManager initialized in worker after VectorSearch is ready
- recordAccess() called after get() operations
- recordAccess() called for semanticSearch results when using composite scoring
- Maintenance progress reported via onProgress callback
- Lifecycle config passed through InitPayload

**IPC Protocol Extensions:**
- MEMORY_FADED and MEMORY_DELETED message types added
- MemoryFadedEvent interface with MemoryDTO payload
- MemoryDeletedEvent interface with memoryId payload

**Public API:**
- All lifecycle configuration fields added to LokulMemConfig
- onMemoryFaded(handler) method with unsubscribe support
- onMemoryDeleted(handler) method with unsubscribe support
- WorkerManager.on(messageType, handler) for event registration
- Events forwarded from worker through WorkerManager to user handlers

**Committed:**
- e3ac35f: feat(06-03b): integrate lifecycle with worker
- 4565e80: feat(06-03b): extend IPC protocol for lifecycle events
- 3addbcd: feat(06-03b): extend LokulMemConfig with lifecycle options
- f39caa7: feat(06-03b): integrate lifecycle events in LokulMem
- 827825e: feat(06-03b): update lifecycle barrel export

**Duration:** 21 min
**Deviations:** 3 issues (TypeScript config handling, unused variables, semantic search score approximation - all resolved)

### Next Action

Execute Phase 7 plans in wave order:
- Wave 1: Plan 07-01 - Structured Attribute Extraction (autonomous)
- Wave 2: Plan 07-02 - Temporal Marker Tracking (autonomous)
- Wave 3: Plan 07-03 - Contradiction Detection Engine (autonomous)

**Implementation Decisions:**

**KMeansClusterer:**
- K-means++ initialization for better centroid starting positions
- Lloyd's algorithm with convergence detection (threshold 0.001, max 100 iterations)
- Euclidean distance for nearest centroid assignment
- Mean-based centroid updates
- Empty clusters get zero vector centroids
- Bulk cluster ID updates via repository.bulkUpdateClusterIds()
- extractEmbeddings() filters memories without cached embeddings
- Null-safe code throughout (no non-null assertions)

**LifecycleManager Integration:**
- KMeansClusterer initialized in constructor with K-means config
- Clustering runs after maintenance sweep in initialize()
- runClustering() method for manual re-clustering
- getClusterStats() method returns k value and last cluster time
- lastClusterTime property tracks clustering runs

**Types:**
- KMeansConfig: k (optional), maxIterations, convergenceThreshold
- ClusterResult: clusters Map, centroids Map, iterations, converged
- LifecycleConfig extended with kMeansK, kMeansMaxIterations, kMeansConvergenceThreshold

**Committed:**
- db88804: feat(06-03a): add K-means types to lifecycle/types.ts
- 61406f0: feat(06-03a): implement KMeansClusterer class
- d573b3d: feat(06-03a): integrate K-means clustering into LifecycleManager

**Duration:** 6 min
**Deviations:** 1 issue (linting errors with non-null assertions - resolved with null-safe code)

### Next Action

Execute Plan 06-03b: Public API Event Callbacks
- onMemoryFaded, onMemoryDeleted public API methods
- Event callback registration through LokulMem
- Requirements: EVENT-05, EVENT-06, EVENT-07

**Implementation Decisions:**
- Decay calculation: Hybrid (session batch + incremental for frequent access)
- Timestamp: lastAccessedAt with createdAt fallback, millisecond timestamps
- Reinforcement: get() + semanticSearch() triggers, category-based amounts, debounced writes (5s window)
- Maintenance: Session + periodic triggers, sync during init, cache-then-batch writes
- Fading: Configurable threshold (default 0.1), soft delete with events
- Deletion: Batch in sweep, immediate after 30 days, events emitted
- K-means: Runs after sweep, k-means++ initialization, max 100 iterations

Implemented messages-based token accounting for accurate context window awareness:
- computeTokenBudget() helper in core/TokenBudget.ts
- ChatMessage, TokenBudgetConfig, TokenBudgetResult types
- getInjectionPreview() accepts messages array for accurate budget calculation
- LokulMemConfig with contextWindowTokens (NO default), reservedForResponseTokens (1024), tokenOverheadPerMessage (4)
- Worker remains stateless (token budgeting computed in main thread)
- Backward compatible (works without messages parameter)
- NO provider-specific defaults in code (LLM-agnostic design)

**Token Estimation Strategy:**
- Current: ~4 characters per token (rough estimate)
- Reasoning: Fast, no dependencies, works in browser
- Limitations: Inaccurate for code, numbers, non-English text
- Future (v2): Integrate tiktoken for accurate tokenization

**Configuration Precedence:**
- maxTokens parameter > computed budget
- tokenCounter function > default ~4 chars/token
- messages array > systemPromptTokens (deprecated)

**Next:** Phase 6: Lifecycle & Decay (Time-based memory decay, access refresh, archival)

**Phase 5 Complete:**
All 3 plans executed successfully:
- 05-01: Vector search with composite scoring
- 05-02: Query Engine with 10+ methods
- 05-03: Token-aware dynamic K selection

**Phase 4 Complete:**
All 3 plans executed successfully:
- 04-03: Vite WASM bundling + workerUrl support
- 04-01: Transformers.js integration with CDN/airgap modes
- 04-02: LRU cache + concurrency queue

**Worker URL Fix:** Changed from `?worker&url` import to `new URL('./worker.mjs', import.meta.url).href` for library-mode compatibility. This is the industry-standard approach for Vite library builds with multiple entry points.

**Test Results:** 10/10 tests passing. Worker initializes in ~3 seconds (first load with model download), ~100ms on subsequent loads (Cache API hit).

---

## Performance Metrics

### Targets (from PROJECT.md)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Retrieval latency | < 30ms (N ≤ 3,000) | — | Phase 5 |
| Embedding latency (warm) | < 10ms | ~100ms (first load) | ✅ Measured |
| Bundle size (gzipped) | < 2MB | 3.78 kB (main) | ✅ Measured |
| Model load time | — | ~3s first, <100ms cached | ✅ Measured |
| Phase 04 | All plans | 3 plans, 15 tasks | ✅ Complete |
| Phase 05 P03 | 167 | 6 tasks | 6 files |
| Phase 06 P06-01 | 3min | 5 tasks | 5 files |
| Phase 07 P01 | 342 | 6 tasks | 6 files |
| Phase 07 P02 | 147 | 4 tasks | 4 files |
| Phase 07 P03b | 3 minutes | 6 tasks | 7 files |
| Phase 08 P03 | 178 | 9 tasks | 4 files |
| Phase 08-public-api-demo P02 | 516 | 7 tasks | 5 files |
| Phase 08-public-api-demo P04 | 257 | 7 tasks | 8 files |

### Benchmarks

No benchmarks recorded yet. Phase 5 planning should include retrieval benchmarking at 1K, 2K, 3K memory thresholds.

---

## Accumulated Context

### Decisions Made

| Date | Decision | Rationale | Status |
|------|----------|-----------|--------|
| 2026-02-26 | Manager uses WorkerClient for IPC communication | All storage operations happen in worker thread for consistency, Manager requests via IPC | **Implemented** ✅ (08-03 complete) |
| 2026-02-26 | 30-second default timeout for management operations | Prevents indefinite hangs while allowing enough time for bulk operations | **Implemented** ✅ (08-03 complete) |
| 2026-02-26 | Singleton Manager pattern | manage() returns cached instance, not new instance each time | **Implemented** ✅ (08-03 complete) |
| 2026-02-26 | Lightweight single operation responses | Single ops return { id, status } only to minimize response size | **Implemented** ✅ (08-03 complete) |
| 2026-02-26 | Detailed bulk operation feedback | Bulk ops return { succeeded, failed, total, counts } for error recovery | **Implemented** ✅ (08-03 complete) |
| 2026-02-26 | Export format flexibility | JSON with base64 embeddings for serialization, Markdown for human-readable | **Implemented** ✅ (08-03 complete) |
| 2026-02-26 | Import mode options | replace (clear all) vs merge (skip existing IDs) for user control | **Implemented** ✅ (08-03 complete) |
| 2026-02-25 | Possession NOT a separate entity type | Possessions tracked via memory flag, prevents Entity.type union pollution | **Implemented** ✅ (07-01 complete) |
| 2026-02-25 | Empty memoryTypes array fallback | When no types detected, QualityScorer uses base threshold - doesn't poison contradiction domains with 'preference' default | **Implemented** ✅ (07-01 complete) |
| 2026-02-25 | Content hashing for RecurrenceTracker keys | Avoids paraphrase false negatives and large string keys, efficient Map-based storage | **Implemented** ✅ (07-01 complete) |
| 2026-02-25 | Weighted E(s) quality scoring | 0.35×novelty + 0.45×specificity + 0.20×recurrence with configurable thresholds and type-specific overrides | **Implemented** ✅ (07-01 complete) |
| 2026-02-25 | Novelty via VectorSearch k=1 | Uses vectorSearch.search(content, { k: 1 }) for efficient O(N) novelty = 1 - top1_similarity | **Implemented** ✅ (07-01 complete) |
| 2026-02-23 | Brute-force search for v0.1 | O(N) acceptable until 3,000 memories; HNSW adds complexity | **Validated** ✅ (05-01 complete) |
| 2026-02-23 | DTO pattern for IPC | Float32Arrays don't serialize well; embeddings internal-only | Validated ✅ |
| 2026-02-23 | SharedWorker primary | Multi-tab sync, model sharing across tabs | Validated ✅ (worker loads correctly) |
| 2026-02-23 | Transformers.js over custom ONNX | Battle-tested, caching, progressive loading | Validated ✅ (model loads in 3s) |
| 2026-02-23 | Dexie.js over raw IndexedDB | Active maintenance, good TypeScript support, compound indexes | Validated ✅ (storage layer working) |
| 2026-02-23 | Named exports only | Cleaner tree-shaking, explicit API surface | Implemented in 01-02 |
| 2026-02-23 | Number timestamps for serialization | Date objects don't serialize over Worker IPC | Implemented in 01-03 |
| 2026-02-23 | Multiple types per memory | Memories can have multiple classifications | Implemented in 01-03 |
| 2026-02-23 | Worker import via ?worker&url | Bundler compatibility for worker instantiation | **CHANGED in 04-03** |
| 2026-02-24 | Direct URL for library worker | `new URL('./worker.mjs', import.meta.url).href` - Industry standard for Vite library mode | **Validated** ✅ |
| 2026-02-24 | Phase 4 production ready | All tests passing (10/10), 3.78 kB gzipped, worker resolves correctly | **Complete** ✅ |
| 2026-02-23 | Dual ESM/CJS output | Maximum compatibility across module systems | Implemented in 01-02 |
| 2026-02-23 | happy-dom for unit tests | DOM mocking in Node.js without browser overhead | Implemented in 01-02 |
| 2026-02-23 | MessageType as const object | Avoids const enum build tool issues; better compatibility | Implemented in 02-02 |
| 2026-02-23 | PortLike abstraction | Unified interface for SharedWorker, DedicatedWorker, main thread | Implemented in 02-02 |
| 2026-02-23 | DedicatedWorker PortLike wrapper | Avoids unsafe casting of self to MessagePort | Implemented in 02-02 |
| 2026-02-23 | Persistence is explicit API | User calls persistStorage() when ready, not auto-called during init | Implemented in 02-01 |
| 2026-02-23 | PortLike single signature | Avoids TypeScript overload conflicts with Worker.postMessage | Implemented in 02-01 |
| 2026-02-23 | pinnedInt (number) for IndexedDB | IndexedDB cannot reliably index boolean values | Implemented in 03-01 |
| 2026-02-23 | Explicit ArrayBuffer.slice() | Avoids TypedArray view footgun where underlying buffer may be larger | Implemented in 03-01 |
| 2026-02-23 | No [types+status] compound index | Multi-entry indexes incompatible with compound indexes in IndexedDB | Documented in 03-01 |
| 2026-02-23 | Handle AbortError-wrapped quota errors | Safari and Firefox wrap QuotaExceededError in AbortError | Implemented in 03-02 |
| 2026-02-23 | Best-effort backup before corruption recovery | Data preservation priority - attempt export before clearAll | Implemented in 03-02 |
| 2026-02-23 | Repository pattern for memory storage | Clean separation between storage layer and business logic | Implemented in 03-03 |
| 2026-02-23 | Internal barrel file (_index.ts) | Clear distinction between internal and public API | Implemented in 03-03 |
| 2026-02-23 | Only storage types exported publicly | Storage implementation remains internal, types for callbacks | Implemented in 03-03 |
| 2026-02-24 | vite-plugin-static-copy for WASM bundling | Better Vite integration, handles dev and production | Implemented in 04-03 |
| 2026-02-24 | wasmPaths NOT defaulted to localModelBaseUrl | Avoids 404s in airgap setups with separate model/WASM paths | Implemented in 04-03 |
| 2026-02-24 | Permissive workerUrl validation | Accepts blob:, data:, extensionless URLs for flexibility | Implemented in 04-03 |
| 2026-02-24 | Typed ModelConfig in Protocol.ts | Type safety across WorkerConfig, InitPayload, EmbeddingConfig | Implemented in 04-03 |
| 2026-02-24 | Map-based LRU cache | O(1) operations with insertion order for LRU eviction | Implemented in 04-02 |
| 2026-02-24 | PromiseQueue for concurrency | Only one embedding call at a time prevents race conditions | Implemented in 04-02 |
| 2026-02-24 | Text-based cache keys | Raw text content for exact match deduplication | Implemented in 04-02 |
| 2026-02-24 | Parameterized embedding dims | Support different models with different dimensions | Implemented in 04-02 |
| 2026-02-24 | @huggingface/transformers v3.x with dtype: 'q8' | Current maintained package, new quantization API | Implemented in 04-01 |
| 2026-02-24 | Composite scoring for retrieval | Combines semantic, recency, strength, continuity signals | **Implemented** ✅ (05-01) |
| 2026-02-24 | Exponential recency decay | True exponential decay with configurable half-life (72h default) | **Implemented** ✅ (05-01) |
| 2026-02-24 | Pinned memory weight override | Pinned memories get strength = 1.0 regardless of actual strength | **Implemented** ✅ (05-01) |
| 2026-02-24 | Eager embedding cache loading | Load all active memories at init (~4.5MB for 3000) | **Implemented** ✅ (05-01) |
| 2026-02-24 | Write-through cache sync | Update cache on add/update/delete mutations | **Implemented** ✅ (05-01) |
| 2026-02-24 | Floor threshold for relevance | R > 0.3 filters low-relevance memories from injection | **Implemented** ✅ (05-01) |
| 2026-02-24 | Cluster bonus for related memories | +0.05 to candidates with same clusterId as top match | **Implemented** ✅ (05-01) |
| 2026-02-24 | Dual cache design | Separate Float32Array and metadata caches for O(1) lookups | **Implemented** ✅ (05-01) |
| 2026-02-24 | QueryEngine with 10+ methods | Complete query API for all data access patterns | **Implemented** ✅ (05-02) |
| 2026-02-24 | Pagination with offset/limit | Returns { items, total, hasMore } for UI scrolling | **Implemented** ✅ (05-02) |
| 2026-02-24 | Full-text search modes | exact, and, or for multi-word queries | **Implemented** ✅ (05-02) |
| 2026-02-24 | Semantic search defaults to semantic-only | useCompositeScoring=false per CONTEXT.md decision | **Implemented** ✅ (05-02) |
| 2026-02-24 | RPC payload types separated | protocol-types.ts for cleaner protocol layering | **Implemented** ✅ (05-02) |
| 2026-02-24 | Worker handlers use PortLike | SharedWorker + DedicatedWorker compatibility | **Implemented** ✅ (05-02) |
| 2026-02-24 | Method overloads deferred | Phase 6+ or .d.ts for includeEmbedding overloads | Planned in 05-02 |
| 2026-02-24 | Messages-based token accounting for accurate budgeting | computeTokenBudget() accepts full message list (system + history + user), NO default context window, worker remains stateless | **Implemented** ✅ (05-03) |
| 2026-02-25 | Ebbinghaus decay with per-category lambda | strength(t) = base × e^(-λ × t), different rates per type | **Implemented** ✅ (06-01) |
| 2026-02-25 | Debounced reinforcement writes | Batch within 5s window to prevent excessive IndexedDB operations | **Implemented** ✅ (06-01) |
| 2026-02-25 | Hard cap at 3.0 for baseStrength | Prevents unlimited reinforcement, enforced at calculation time | **Implemented** ✅ (06-01) |
| 2026-02-25 | Category-based configuration | lambdaByCategory and reinforcementByCategory for flexible tuning | **Implemented** ✅ (06-01) |
| 2026-02-24 | QueryEngine with 10+ methods | Complete query API for all data access patterns | **Implemented** ✅ (05-02) |
| 2026-02-24 | Pagination with offset/limit | Returns { items, total, hasMore } for UI scrolling | **Implemented** ✅ (05-02) |
| 2026-02-24 | Full-text search modes | exact, and, or for multi-word queries | **Implemented** ✅ (05-02) |
| 2026-02-24 | Semantic search defaults to semantic-only | useCompositeScoring=false per CONTEXT.md decision | **Implemented** ✅ (05-02) |
| 2026-02-24 | RPC payload types separated | protocol-types.ts for cleaner protocol layering | **Implemented** ✅ (05-02) |
| 2026-02-24 | Worker handlers use PortLike | SharedWorker + DedicatedWorker compatibility | **Implemented** ✅ (05-02) |
| 2026-02-24 | Method overloads deferred | Phase 6+ or .d.ts for includeEmbedding overloads | Planned in 05-02 |
| 2026-02-24 | Messages-based token accounting for accurate budgeting | computeTokenBudget() accepts full message list (system + history + user), NO default context window, worker remains stateless | **Implemented** ✅ (05-03) |
- [Phase 04]: Use @huggingface/transformers v3.x with dtype: 'q8' quantization
- [Phase 04]: Explicit env.useBrowserCache=true for Cache API persistence
- [Phase 04]: Airgap mode blocks all network via env.allowRemoteModels=false
- [Phase 05]: Messages-based token accounting for accurate budgeting (computeTokenBudget accepts full message list, NO default context window, worker stateless)
- [Phase 06]: Ebbinghaus decay formula: strength(t) = base × e^(-λ × t) with per-category lambda values
- [Phase 06]: Debounced reinforcement writes batch within 5s window to prevent excessive IndexedDB operations
- [Phase 06]: Hard cap at 3.0 for baseStrength prevents unlimited reinforcement
- [Phase 07]: No position tracking for temporal markers - per Phase 7 CONTEXT decision, position is debug-only and never persisted to database
- [Phase 07]: Removed generic \\bold\\b pattern - temporal markers should be precise, not broad. Pattern matched 'old laptop', 'old code' causing false positives

## Technical Memory

### Token Estimation Strategy

**Current:** ~4 characters per token (rough estimate)
**Reasoning:** Fast, no dependencies, works in browser
**Limitations:** Inaccurate for code, numbers, and non-English text
**Future (v2):** Integrate tiktoken for accurate tokenization

### Token Budget Configuration

**NO default context window:** contextWindowTokens is optional with NO default.
This prevents silent under-injection for modern LLMs (8k/16k/128k context).

**Default behavior (no contextWindow):**
- Use maxTokens parameter override, OR
- Use safe default 512 tokens for injection

**Messages-based accounting:**
- computeTokenBudget() accepts ChatMessage[] (full message list)
- Accounts for: content tokens + per-message overhead (4 tokens)
- Returns: availableTokens, usedTokens, remainingTokens

**Worker stateless:**
- Token budgeting computed in main thread
- Worker receives computed maxTokens for retrieval
- No protocol churn for config changes

**Configuration precedence:**
- maxTokens parameter > computed budget
- tokenCounter function > default ~4 chars/token
- messages array > systemPromptTokens (deprecated)

### Open Questions

1. **Decay Constants:** Per-category lambda values are starting points. Need validation with real usage data.
2. **Contradiction Thresholds:** Temporal marker confidence needs real conversation data.
3. **Safari SharedWorker:** Historical limitations in private browsing mode. Test fallback chain early in Phase 2.

### Known Risks

| Risk | Mitigation | Status |
|------|------------|--------|
| WASM asset loading in airgap | vite-plugin-static-copy bundles ORT assets to dist/ | Mitigated in 04-03 |
| Float32Array serialization in Workers | DTO pattern excludes embeddings from IPC | Mitigated in 01-03 |
| Message timeout memory leaks | WorkerClient clears timeouts on resolve/reject/terminate | Mitigated in 02-02 |
| SharedWorker port lifecycle | Always use `onmessage` or call `port.start()` | Documented |
| IndexedDB transaction timing | Use Dexie's transaction helper for async | Documented |
| Model loading memory exhaustion | Singleton pattern, quantized models (q8) | Documented |
| Brute-force performance cliff | Document 3,000 limit; plan HNSW for v0.2 | Documented |
| Ebbinghaus decay errors | Use explicit Date objects; convert to days | Documented |
| Contradiction false positives | Typed attribute extraction; normalize values | Documented |

---

## Session Continuity

### Last Action
Plan 08-03 complete! Manager namespace with 16+ methods for memory inspection and manipulation:

**Completed Tasks:**
- Task 1: Added management types to api/types.ts (BulkOperationResult, ExportFormat, ImportMode, ImportResult, ClearResult, SingleOperationResult, LokulMemExport, MemoryUpdate)
- Task 2: Created Manager class skeleton with 16+ methods (single ops, bulk ops, clear, stats, export, import, query delegation)
- Tasks 3-7: Single/bulk/clear/stats/export/import/query methods implemented in Manager skeleton (all use IPC pattern)
- Task 8: Integrated Manager namespace with LokulMem (manage() method returns cached singleton)
- Task 9: Updated API barrel file with Manager exports

**Key Features:**
- Manager uses WorkerClient for IPC communication (all operations go through worker)
- Single operations return lightweight { id, status } responses
- Bulk operations return detailed { succeeded, failed, total, counts } for error tracking
- Export supports JSON (base64 embeddings) and Markdown (human-readable) formats
- Import supports replace (clear all) and merge (skip existing IDs) modes
- 26 total methods: 6 single ops, 5 bulk ops, 2 management ops, 2 export/import ops, 11 query delegation methods

### Next Action
Execute Phase 8 plans in sequence:
- Plan 08-04: Event System (onMemoryAdded, onMemoryUpdated, etc.)
- Plan 08-05: Augmenter Implementation
- Plan 08-06: Learner Implementation

### Blockers
- Worker handlers still needed for management operations (MEMORY_UPDATE, MEMORY_PIN, MEMORY_DELETE, etc.)
- Query method handlers exist from Phase 5, but new management handlers need to be added to src/worker/index.ts

### Working Branch
main (initial development)

---

## Phase History

| Phase | Started | Completed | Duration | Notes |
|-------|---------|-----------|----------|-------|
| — | — | — | — | Project initialized |

---

## Requirements Status

### v1 Requirements (82 total)

| Category | Total | Pending | In Progress | Complete |
|----------|-------|---------|-------------|----------|
| TS | 5 | 3 | 0 | 2 |
| WORKER | 5 | 0 | 0 | 5 |
| STORAGE | 4 | 0 | 0 | 4 |
| EMBED | 10 | 0 | 0 | 10 |
| SEARCH | 7 | 7 | 0 | 0 |
| DECAY | 9 | 9 | 0 | 0 |
| EXTRACT | 7 | 7 | 0 | 0 |
| CONTRA | 6 | 6 | 0 | 0 |
| AUG | 7 | 7 | 0 | 0 |
| LEARN | 5 | 5 | 0 | 0 |
| MGMT | 16 | 16 | 0 | 0 |
| EVENT | 7 | 7 | 0 | 0 |
| DEMO | 4 | 4 | 0 | 0 |
| **Total** | **82** | **58** | **0** | **24** |

### v2 Requirements (Deferred)

- HNSW Vector Search (3 requirements)
- Episodic Memory (3 requirements)
- Proactive Memory (2 requirements)
- Knowledge Graph (3 requirements)
- Additional Features (5 requirements)

### v3 Requirements (Deferred)

- At-rest encryption (2 requirements)
- Svelte store adapter (1 requirement)
- Full benchmark suite (1 requirement)
- Documentation site (1 requirement)

---

*State file created: 2026-02-23*
*Update this file after every planning session and phase completion*
