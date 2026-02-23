# Requirements: LokulMem

**Defined:** 2026-02-23
**Core Value:** Developers can add persistent, privacy-preserving memory to any LLM application in under 10 minutes with three API calls

## v1 Requirements

### Worker Infrastructure

- [ ] **WORKER-01**: Library detects and uses SharedWorker when available
- [ ] **WORKER-02**: Falls back to Dedicated Worker when SharedWorker unavailable
- [ ] **WORKER-03**: Falls back to main thread when Workers unavailable
- [x] **WORKER-04**: Library provides `persistStorage()` API for explicit storage persistence (user decides when to call)
- [x] **WORKER-05**: `onProgress` callback reports init stages (worker, model, storage, maintenance, ready)

### Storage & Schema

- [x] **STORAGE-01**: Dexie.js schema v1 with memories, episodes, edges, clusters stores
- [x] **STORAGE-02**: Memories table has all required indexes (id, types, status, clusterId, lastAccessedAt, baseStrength, validFrom, pinned, mentionCount, compound indexes)
- [x] **STORAGE-03**: Embedding field stored as Float32Array
- [x] **STORAGE-04**: Schema migration chain established for future versions

### Embedding Engine

- [ ] **EMBED-01**: Transformers.js MiniLM-L6-v2 loads in worker context
- [ ] **EMBED-02**: LRU cache (1000 entries) for embeddings
- [ ] **EMBED-03**: Promise-based concurrency queue prevents concurrent embedding calls
- [ ] **EMBED-04**: Model loads from CDN with local cache (Cache API)
- [ ] **EMBED-05**: `localModelBaseUrl` option enables airgapped/offline usage
- [x] **EMBED-06**: ONNX WASM paths configurable via options
- [x] **EMBED-07**: ORT assets bundled into dist (glob copy ort-wasm*.wasm and ort-wasm*.mjs)
- [x] **EMBED-08**: `workerUrl` option supported for custom worker resolution
- [ ] **EMBED-09**: Airgap mode explicitly sets `env.allowLocalModels=true`, `env.allowRemoteModels=false`, `env.localModelPath=<localModelBaseUrl>`
- [ ] **EMBED-10**: Airgap mode requires consumers to host model assets mirroring `Xenova/all-MiniLM-L6-v2` repository structure under `localModelBaseUrl`

### Extraction Layer

- [ ] **EXTRACT-01**: Specificity NER detects: names (0.3), places (0.25), numbers (0.2), preferences (0.25), dates (0.2), negations (0.2), first-person possession (0.10); clamp sum to 1.0
- [ ] **EXTRACT-02**: Novelty computed via `1 - top1_similarity` using vector search
- [ ] **EXTRACT-03**: Recurrence tracked within session (cosine > 0.85)
- [ ] **EXTRACT-04**: E(s) = 0.35×novelty + 0.45×specificity + 0.20×recurrence
- [ ] **EXTRACT-05**: Extraction threshold default 0.55 (configurable)
- [ ] **EXTRACT-06**: Memory types classified (identity, location, profession, preference, project, temporal, relational, emotional)
- [ ] **EXTRACT-07**: Entities extracted and stored with memory

### Contradiction Detection

- [ ] **CONTRA-01**: Retrieve topK candidates (5-10) and evaluate any with similarity > 0.80; choose best typed-attribute match
- [ ] **CONTRA-02**: Temporal markers detected (16 patterns: "used to", "previously", "no longer", etc.)
- [ ] **CONTRA-03**: Temporal updates set validTo on existing, validFrom on new
- [ ] **CONTRA-04**: Typed attribute conflicts mark existing as superseded
- [ ] **CONTRA-05**: Contradiction events emitted via callback
- [ ] **CONTRA-06**: Supersession chains preserved (supersededBy, supersededAt)

### Decay & Lifecycle

- [ ] **DECAY-01**: Ebbinghaus decay: strength(t) = base_strength × e^(-λ × Δt_hours)
- [ ] **DECAY-02**: Per-category λ values: identity (0.0001), location (0.0005), profession (0.0003), preferences (0.001), project (0.005), temporal (0.02), relational (0.0004), emotional (0.01)
- [ ] **DECAY-03**: Pinned memories have λ = 0 (no decay)
- [ ] **DECAY-04**: Reinforcement on retrieval: base_strength + 0.3 (max 3.0)
- [ ] **DECAY-05**: Maintenance sweep runs at session start
- [ ] **DECAY-06**: Faded memories (strength < 0.1) marked as faded, deleted after 30 days
- [ ] **DECAY-07**: K-means clustering runs synchronously in worker
- [ ] **DECAY-08**: `fadedAt` timestamp field records when memory transitioned to faded status (enables 30-day deletion policy)
- [ ] **DECAY-09**: Faded memory deletion runs during session-start maintenance sweep

### Vector Search & Retrieval

- [ ] **SEARCH-01**: Brute-force cosine similarity for N ≤ 3000
- [ ] **SEARCH-02**: Composite R(m,q) = w1×semantic + w2×recency + w3×strength + w4×continuity
- [ ] **SEARCH-03**: Default weights: semantic 0.40, recency 0.20, strength 0.25, continuity 0.15
- [ ] **SEARCH-04**: Pinned memories get w3 = 1.0 regardless of actual strength
- [ ] **SEARCH-05**: Token-aware dynamic K based on available context window
- [ ] **SEARCH-06**: R > 0.3 floor for injection
- [ ] **SEARCH-07**: Active memory embeddings loaded into in-memory cache for retrieval; cache stays in sync with mutations

### Public API - augment()

- [ ] **AUG-01**: Accepts userMessage, history[], options
- [ ] **AUG-02**: Returns augmented messages array ready for LLM
- [ ] **AUG-03**: Returns LokulMemDebug when options.debug = true
- [ ] **AUG-04**: Debug includes injected memories with scores and breakdowns
- [ ] **AUG-05**: Debug includes candidates with excluded reasons
- [ ] **AUG-06**: Debug includes token usage and latency metrics
- [ ] **AUG-07**: Prepend-system injection format

### Public API - learn()

- [ ] **LEARN-01**: Accepts userMessage, assistantResponse, options
- [ ] **LEARN-02**: Returns extracted memories array
- [ ] **LEARN-03**: Returns contradictions detected
- [ ] **LEARN-04**: Returns faded memories from maintenance
- [ ] **LEARN-05**: Updates in-memory vector cache after extraction

### Public API - manage()

- [ ] **MGMT-01**: `list()` with filters (type, status, minStrength, pinned, etc.)
- [ ] **MGMT-02**: `get()` single memory by id
- [ ] **MGMT-03**: `getByConversation()` memories from specific conversation
- [ ] **MGMT-04**: `getRecent()`, `getTop()`, `getPinned()` convenience methods
- [ ] **MGMT-05**: `search()` full-text search on content
- [ ] **MGMT-06**: `semanticSearch()` embedding-based search
- [ ] **MGMT-07**: `getTimeline()` memories grouped by date
- [ ] **MGMT-08**: `getGrouped()` memories organized by type for UI
- [ ] **MGMT-09**: `getInjectionPreview()` preview what augment would inject
- [ ] **MGMT-10**: `update()`, `pin()`, `unpin()`, `archive()`, `unarchive()`, `delete()`
- [ ] **MGMT-11**: Bulk operations: `deleteMany()`, `archiveMany()`, `pinMany()`, `unpinMany()`
- [ ] **MGMT-12**: `clear()` reset all memories
- [ ] **MGMT-13**: `stats()` full MemoryStats interface
- [ ] **MGMT-14**: `export()` JSON with base64 embeddings
- [ ] **MGMT-15**: `exportToMarkdown()` human-readable export
- [ ] **MGMT-16**: `import()` JSON with merge options

### Event System

- [ ] **EVENT-01**: `onMemoryAdded()` callback with MemoryDTO
- [ ] **EVENT-02**: `onMemoryUpdated()` callback with MemoryDTO
- [ ] **EVENT-03**: `onMemoryDeleted()` callback with id
- [ ] **EVENT-04**: `onMemoryFaded()` callback with MemoryDTO
- [ ] **EVENT-05**: `onStatsChanged()` callback with MemoryStats
- [ ] **EVENT-06**: `onContradictionDetected()` callback with event details
- [ ] **EVENT-07**: All event callbacks return unsubscribe functions

### TypeScript & Build

- [x] **TS-01**: 100% TypeScript coverage for public API
- [x] **TS-02**: Tree-shakeable ESM bundle output
- [x] **TS-03**: Type declarations (.d.ts) generated
- [x] **TS-04**: Worker compiled as separate chunk
- [x] **TS-05**: DTO pattern: embeddings excluded from public API responses

### Demo Application

- [ ] **DEMO-01**: React app in `examples/react-app/` with isolated package.json
- [ ] **DEMO-02**: Visualizes debug object from augment()
- [ ] **DEMO-03**: Reactive memory list using manage().list()
- [ ] **DEMO-04**: Does not pollute root package.json with React dependencies

## v2 Requirements (Deferred)

### HNSW Vector Search

- **HNSW-01**: HNSW index for N > 3000
- **HNSW-02**: Lazy loading of HNSW above threshold
- **HNSW-03**: M=16, ef_construction=200, ef_search=50 parameters

### Episodic Memory

- **EPISODE-01**: Session summaries stored in episodes table
- **EPISODE-02**: Episode retrieval when similarity > 0.75
- **EPISODE-03**: Episode context injection format

### Proactive Memory

- **PROAC-01**: Temporal urgency scoring: σ(days_to_event × -2.0)
- **PROAC-02**: Proactive injection at session start when score > 0.7

### Knowledge Graph

- **GRAPH-01**: Edges created when memories share entities or similarity > 0.70
- **GRAPH-02**: First-degree neighbors get +0.08 retrieval bonus
- **GRAPH-03**: `getRelated()` method for graph neighbors

### Additional Features

- **V2-01**: Emotional valence tagging (VADER-style lexicon)
- **V2-02**: `injectionMode` option (prepend-system, new-system-message, developer-message, user-turn-prefix)
- **V2-03**: `getLineage()` full memory provenance
- **V2-04**: React hook `useMem()`
- **V2-05**: Retention policy engine

## v3 Requirements (Deferred)

- **V3-01**: At-rest encryption (AES-GCM, PBKDF2)
- **V3-02**: `keyStorage` option (session/local/none)
- **V3-03**: Svelte store adapter
- **V3-04**: Full benchmark suite
- **V3-05**: Documentation site

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cross-device sync | Violates zero-server architecture |
| Multi-user/shared memory | Scope explosion; one user per store |
| Cloud backup | Privacy-by-architecture principle |
| React Native / mobile SDK | Different runtime, browser-only target |
| Node.js / server runtime | Depends on browser APIs |
| LLM fine-tuning | Scope creep; different problem domain |
| Markdown import | No reliable round-trip guarantee |
| AI-powered fact suggestions | Requires library to make AI calls |
| Re-extraction from history | Requires storing raw conversations |
| Bulk fact merging / deduplication | O(N²) complexity; decay handles compaction |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TS-01..05 | Phase 1 | Complete |
| WORKER-01..05 | Phase 2 | Complete |
| STORAGE-01..04 | Phase 3 | Pending |
| EMBED-01..10 | Phase 4 | Pending |
| SEARCH-01..07 | Phase 5 | Pending |
| MGMT-01..09 | Phase 5 | Pending |
| DECAY-01..09 | Phase 6 | Pending |
| EXTRACT-01..07 | Phase 7 | Pending |
| CONTRA-01..06 | Phase 7 | Pending |
| AUG-01..07 | Phase 8 | Pending |
| LEARN-01..05 | Phase 8 | Pending |
| MGMT-10..16 | Phase 8 | Pending |
| EVENT-01..07 | Phase 8 | Pending |
| DEMO-01..04 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 82 total
- Mapped to phases: 82
- Unmapped: 0 ✓

---

*Requirements defined: 2026-02-23*
*Last updated: 2026-02-23 after roadmap creation*
