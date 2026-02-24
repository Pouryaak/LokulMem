# State: LokulMem

**Project:** LokulMem - Browser-Native LLM Memory Management Library
**Current Phase:** 05
**Current Plan:** 03 (Next: Memory Management API)
**Status:** Plan 02 complete, ready for Plan 03
**Updated:** 2026-02-24

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
[██████████] 100% - Phase 2: Worker Infrastructure (Complete - 5 of 5 plans)
[██████████] 100% - Phase 3: Storage Layer (Complete - 3 of 3 plans)
[██████████] 100% - Phase 4: Embedding Engine (Complete - 3 of 3 plans)
[██████████░] 67% - Phase 5: Memory Store & Retrieval (Plans 01-02 complete, Plan 03 next)
[░░░░░░░░░░] 0% - Phase 6: Lifecycle & Decay (Not started)
[░░░░░░░░░░] 0% - Phase 7: Extraction & Contradiction (Not started)
[░░░░░░░░░░] 0% - Phase 8: Public API & Demo (Not started)
```

### Active Work

**Plan 05-02 Complete:** Query Engine with 10+ Methods

Implemented high-level query API for all data access patterns:
- QueryEngine class with 10+ methods: list, get, getByConversation, getRecent, getTop, getPinned, search, semanticSearch, getTimeline, getGrouped, getInjectionPreview
- Query filtering by types, status, strength, pinned, clusterId
- Pagination with offset/limit returning { items, total, hasMore }
- Full-text search with exact/and/or modes (default: and, case-insensitive)
- Semantic search defaults to semantic-only (useCompositeScoring=false)
- Timeline grouping by date, type grouping for visualization
- Worker message handlers: LIST, GET, SEARCH, SEMANTIC_SEARCH
- RPC payload types separated into protocol-types.ts for cleaner protocol layering
- All handlers use PortLike type for SharedWorker compatibility

**Next: Plan 05-03** - Memory Management API

**Wave 3 (Memory Management):**
- 05-03: Memory Management API with CRUD operations
  - add(), update(), delete() worker handlers
  - Pin/unpin operations
  - Strength adjustment
  - Conversation management

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

### Benchmarks

No benchmarks recorded yet. Phase 5 planning should include retrieval benchmarking at 1K, 2K, 3K memory thresholds.

---

## Accumulated Context

### Decisions Made

| Date | Decision | Rationale | Status |
|------|----------|-----------|--------|
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
- [Phase 04]: Use @huggingface/transformers v3.x with dtype: 'q8' quantization
- [Phase 04]: Explicit env.useBrowserCache=true for Cache API persistence
- [Phase 04]: Airgap mode blocks all network via env.allowRemoteModels=false

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
Plan 05-01 complete! Implemented vector search with composite scoring:

**Completed Tasks:**
- Task 1: Created search types and interfaces (SearchResult, SearchOptions, ScoringConfig, etc.)
- Task 2: Implemented Scoring class with exponential recency decay
- Task 3: Implemented VectorSearch class with in-memory Float32Array cache
- Task 4: Created search module barrel file for clean exports

**Key Features:**
- Brute-force O(N) cosine similarity search for N ≤ 3000
- Composite R(m,q) scoring: semantic (0.40), recency (0.20), strength (0.25), continuity (0.15)
- Exponential recency decay with 72h half-life
- Pinned memories get strength = 1.0 (weight override)
- Dual cache: Float32Array embeddings + metadata (~4.5MB for 3000 memories)
- Write-through cache sync on mutations
- Cluster bonus: +0.05 to same-cluster candidates as top match
- Floor threshold R > 0.3 for relevance filtering

### Next Action
Execute Plan 05-02: Query Engine with 10+ methods

### Blockers
None.

### Working Branch
master (initial development)

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
