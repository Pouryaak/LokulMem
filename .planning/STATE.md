# State: LokulMem

**Project:** LokulMem - Browser-Native LLM Memory Management Library
**Current Phase:** 03
**Current Plan:** Not started
**Status:** Milestone complete
**Updated:** 2026-02-23

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
[░░░░░░░░░░] 0% - Phase 4: Embedding Engine (Not started)
[░░░░░░░░░░] 0% - Phase 5: Memory Store & Retrieval (Not started)
[░░░░░░░░░░] 0% - Phase 6: Lifecycle & Decay (Not started)
[░░░░░░░░░░] 0% - Phase 7: Extraction & Contradiction (Not started)
[░░░░░░░░░░] 0% - Phase 8: Public API & Demo (Not started)
```

### Active Work

Plan 03-03 (MemoryRepository with CRUD operations) completed. Implemented MemoryRepository class with full CRUD operations, query methods using all compound indexes, bulk operations, and utility methods. Created internal barrel file for storage layer exports. Added storage types (StorageStatus, StorageError, StorageErrorType) to public API exports. Phase 03-storage-layer is now complete.

---

## Performance Metrics

### Targets (from PROJECT.md)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Retrieval latency | < 30ms (N ≤ 3,000) | — | Not measured |
| Embedding latency (warm) | < 10ms | — | Not measured |
| Bundle size (gzipped) | < 2MB | — | Not measured |
| Model load time | — | — | Not measured |
| Phase 03-storage-layer P03-01 | 15 | 3 tasks | 4 files |

### Benchmarks

No benchmarks recorded yet. Phase 5 planning should include retrieval benchmarking at 1K, 2K, 3K memory thresholds.

---

## Accumulated Context

### Decisions Made

| Date | Decision | Rationale | Status |
|------|----------|-----------|--------|
| 2026-02-23 | Brute-force search for v0.1 | O(N) acceptable until 3,000 memories; HNSW adds complexity | Pending validation |
| 2026-02-23 | DTO pattern for IPC | Float32Arrays don't serialize well; embeddings internal-only | Implemented in 01-03 |
| 2026-02-23 | SharedWorker primary | Multi-tab sync, model sharing across tabs | Pending validation |
| 2026-02-23 | Transformers.js over custom ONNX | Battle-tested, caching, progressive loading | Pending validation |
| 2026-02-23 | Dexie.js over raw IndexedDB | Active maintenance, good TypeScript support, compound indexes | Pending validation |
| 2026-02-23 | Named exports only | Cleaner tree-shaking, explicit API surface | Implemented in 01-02 |
| 2026-02-23 | Number timestamps for serialization | Date objects don't serialize over Worker IPC | Implemented in 01-03 |
| 2026-02-23 | Multiple types per memory | Memories can have multiple classifications | Implemented in 01-03 |
| 2026-02-23 | Worker import via ?worker&url | Bundler compatibility for worker instantiation | Implemented in 01-02 |
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

### Open Questions

1. **Decay Constants:** Per-category lambda values are starting points. Need validation with real usage data.
2. **Contradiction Thresholds:** Temporal marker confidence needs real conversation data.
3. **Safari SharedWorker:** Historical limitations in private browsing mode. Test fallback chain early in Phase 2.

### Known Risks

| Risk | Mitigation | Status |
|------|------------|--------|
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
Completed Plan 03-03 (MemoryRepository with CRUD operations) — created MemoryRepository with full CRUD, query methods using all compound indexes, bulk operations, internal barrel file, and storage type exports

### Next Action
Begin Phase 04: Embedding Engine

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
| EMBED | 10 | 10 | 0 | 0 |
| SEARCH | 7 | 7 | 0 | 0 |
| DECAY | 9 | 9 | 0 | 0 |
| EXTRACT | 7 | 7 | 0 | 0 |
| CONTRA | 6 | 6 | 0 | 0 |
| AUG | 7 | 7 | 0 | 0 |
| LEARN | 5 | 5 | 0 | 0 |
| MGMT | 16 | 16 | 0 | 0 |
| EVENT | 7 | 7 | 0 | 0 |
| DEMO | 4 | 4 | 0 | 0 |
| **Total** | **82** | **73** | **0** | **9** |

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
