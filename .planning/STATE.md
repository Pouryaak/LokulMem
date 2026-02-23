# State: LokulMem

**Project:** LokulMem - Browser-Native LLM Memory Management Library
**Current Phase:** None (roadmap created, awaiting planning)
**Current Plan:** None
**Status:** Ready for Phase 1 planning
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
[░░░░░░░░░░] 0% - Phase 1: Foundation (Not started)
[░░░░░░░░░░] 0% - Phase 2: Worker Infrastructure (Not started)
[░░░░░░░░░░] 0% - Phase 3: Storage Layer (Not started)
[░░░░░░░░░░] 0% - Phase 4: Embedding Engine (Not started)
[░░░░░░░░░░] 0% - Phase 5: Memory Store & Retrieval (Not started)
[░░░░░░░░░░] 0% - Phase 6: Lifecycle & Decay (Not started)
[░░░░░░░░░░] 0% - Phase 7: Extraction & Contradiction (Not started)
[░░░░░░░░░░] 0% - Phase 8: Public API & Demo (Not started)
```

### Active Work

None. Project initialized, roadmap created, awaiting first planning session.

---

## Performance Metrics

### Targets (from PROJECT.md)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Retrieval latency | < 30ms (N ≤ 3,000) | — | Not measured |
| Embedding latency (warm) | < 10ms | — | Not measured |
| Bundle size (gzipped) | < 2MB | — | Not measured |
| Model load time | — | — | Not measured |

### Benchmarks

No benchmarks recorded yet. Phase 5 planning should include retrieval benchmarking at 1K, 2K, 3K memory thresholds.

---

## Accumulated Context

### Decisions Made

| Date | Decision | Rationale | Status |
|------|----------|-----------|--------|
| 2026-02-23 | Brute-force search for v0.1 | O(N) acceptable until 3,000 memories; HNSW adds complexity | Pending validation |
| 2026-02-23 | DTO pattern for IPC | Float32Arrays don't serialize well; embeddings internal-only | Pending validation |
| 2026-02-23 | SharedWorker primary | Multi-tab sync, model sharing across tabs | Pending validation |
| 2026-02-23 | Transformers.js over custom ONNX | Battle-tested, caching, progressive loading | Pending validation |
| 2026-02-23 | Dexie.js over raw IndexedDB | Active maintenance, good TypeScript support, compound indexes | Pending validation |

### Open Questions

1. **Decay Constants:** Per-category lambda values are starting points. Need validation with real usage data.
2. **Contradiction Thresholds:** Temporal marker confidence needs real conversation data.
3. **Safari SharedWorker:** Historical limitations in private browsing mode. Test fallback chain early in Phase 2.

### Known Risks

| Risk | Mitigation | Status |
|------|------------|--------|
| Float32Array serialization in Workers | DTO pattern excludes embeddings from IPC | Documented |
| SharedWorker port lifecycle | Always use `onmessage` or call `port.start()` | Documented |
| IndexedDB transaction timing | Use Dexie's transaction helper for async | Documented |
| Model loading memory exhaustion | Singleton pattern, quantized models (q8) | Documented |
| Brute-force performance cliff | Document 3,000 limit; plan HNSW for v0.2 | Documented |
| Ebbinghaus decay errors | Use explicit Date objects; convert to days | Documented |
| Contradiction false positives | Typed attribute extraction; normalize values | Documented |

---

## Session Continuity

### Last Action
Created roadmap with 8 phases covering all 76 v1 requirements.

### Next Action
Plan Phase 1 (Foundation) with `/gsd:plan-phase 1`

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

### v1 Requirements (76 total)

| Category | Total | Pending | In Progress | Complete |
|----------|-------|---------|-------------|----------|
| TS | 5 | 5 | 0 | 0 |
| WORKER | 5 | 5 | 0 | 0 |
| STORAGE | 4 | 4 | 0 | 0 |
| EMBED | 6 | 6 | 0 | 0 |
| SEARCH | 6 | 6 | 0 | 0 |
| DECAY | 7 | 7 | 0 | 0 |
| EXTRACT | 7 | 7 | 0 | 0 |
| CONTRA | 6 | 6 | 0 | 0 |
| AUG | 7 | 7 | 0 | 0 |
| LEARN | 5 | 5 | 0 | 0 |
| MGMT | 16 | 16 | 0 | 0 |
| EVENT | 7 | 7 | 0 | 0 |
| DEMO | 4 | 4 | 0 | 0 |
| **Total** | **76** | **76** | **0** | **0** |

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
