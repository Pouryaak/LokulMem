# State: LokulMem

**Project:** LokulMem - Browser-Native LLM Memory Management Library
**Current Phase:** 06
**Current Plan:** 06-03b (Complete)
**Status:** Phase 6 complete
**Updated:** 2026-02-25

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
[██████████] 100% - Phase 5: Memory Store & Retrieval (Complete - 3 of 3 plans)
[██████████] 100% - Phase 6: Lifecycle & Decay (Complete - 4 of 4 plans)
[░░░░░░░░░░] 0% - Phase 7: Extraction & Contradiction (Not started)
[░░░░░░░░░░] 0% - Phase 8: Public API & Demo (Not started)
```

### Active Work

**Plan 06-03b Complete!** Integrated lifecycle system with worker and public API:

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

**Phase 6 Complete!** All 4 plans executed successfully.

**Next Phase:** Phase 7 - Extraction & Contradiction
- Plan 07-01: Structured Attribute Extraction
- Plan 07-02: Temporal Marker Tracking
- Plan 07-03: Contradiction Detection Engine

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
Plan 05-03 complete! Implemented token-aware dynamic K selection:

**Completed Tasks:**
- Task 1: Added token budget configuration to LokulMemConfig (NO defaults)
- Task 2: Added ChatMessage and token budget types to search/types.ts
- Task 3: Implemented computeTokenBudget() helper in core/TokenBudget.ts
- Task 4: Updated QueryEngine.getInjectionPreview() with messages-based accounting
- Task 5: Updated LokulMem to store token budget config in main thread only
- Task 6: Updated STATE.md to document token estimation strategy

**Key Features:**
- Messages-based token accounting (system + history + user)
- NO default context window (prevents under-injection for modern LLMs)
- Shared helper for consistent behavior across augment() and getInjectionPreview()
- Worker remains stateless (token budgeting computed in main thread)
- Backward compatible (works without messages parameter)
- Custom tokenCounter support for tiktoken integration in v2

### Next Action
Execute Phase 6 plans in wave order:
- Wave 1 (autonomous): Plan 06-01 - Decay Calculator & Reinforcement Tracker
- Wave 2 (autonomous): Plans 06-02, 06-03 - Maintenance, K-means, Integration (parallel)

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
