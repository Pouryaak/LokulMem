# Project Research Summary

**Project:** Lokul Mind — Browser-Native ML Memory System
**Domain:** Browser-native LLM memory management libraries
**Researched:** 2026-02-23
**Confidence:** HIGH

## Executive Summary

Lokul Mind is a browser-native memory management library for LLM applications that operates entirely client-side, providing semantic memory storage, retrieval, and lifecycle management without requiring any server infrastructure. Research confirms this is an unoccupied market niche — existing solutions like Mem0 and LangMem are server-first with cloud dependencies, while browser-native alternatives lack the sophisticated memory lifecycle features (mathematical decay, contradiction detection, episodic memory) that differentiate Lokul Mind.

The recommended approach is a SharedWorker-based architecture using Transformers.js for browser-native embeddings (MiniLM-L6-v2, 384-dim, ~22MB quantized) and Dexie.js for IndexedDB persistence. This stack enables true zero-server operation with privacy-by-architecture guarantees. The system should implement a three-layer architecture: main-thread API client, SharedWorker coordination hub, and dedicated workers for embedding computation and storage operations. Key differentiators include Ebbinghaus forgetting curve-based memory decay with per-category lambda values, three-stage contradiction detection preserving historical accuracy, and composite relevance scoring combining semantic similarity with recency, strength, and continuity factors.

Primary risks center on Worker communication pitfalls (Float32Array serialization, SharedWorker port lifecycle), IndexedDB transaction timing, and the performance cliff at ~3,000 memories where brute-force vector search becomes prohibitive. These are mitigated through strict DTO patterns excluding embeddings from IPC, explicit transaction scoping with Dexie.js, and documented scaling thresholds with HNSW indexing planned for v0.2. Cross-browser compatibility requires graceful fallback chains (SharedWorker → DedicatedWorker → main thread) and WebGPU-to-WASM device fallback.

## Key Findings

### Recommended Stack

The stack is built around battle-tested browser-native technologies. Transformers.js (v3.8.1) provides state-of-the-art ML inference in the browser, functionally equivalent to Python transformers but running via ONNX Runtime Web. Dexie.js (v4.3.0) offers a minimalistic, stable IndexedDB wrapper with bulk operations and React hooks. Vite (6.2.0+) provides excellent library mode support with native ESM and built-in web worker handling.

**Core technologies:**
- **@huggingface/transformers@3.8.1**: Browser ML inference — Standard for ONNX models in browser, uses ONNX Runtime Web under the hood
- **onnxruntime-web@1.24.2**: ONNX model execution — Required by Transformers.js, provides WASM and WebGPU backends
- **dexie@4.3.0**: IndexedDB abstraction — Minimalistic, stable, handles browser bugs, bulk operations for performance
- **vite@6.2.0+**: Build tool — Native ESM, fast HMR, excellent library mode, built-in web worker support
- **MiniLM-L6-v2 (Xenova/all-MiniLM-L6-v2)**: Embedding model — 384-dim sentence embeddings, Apache 2.0, quantized q8 for WASM

See [STACK.md](./STACK.md) for detailed configuration examples and version compatibility matrix.

### Expected Features

Feature research identified clear market expectations and competitive opportunities. Table stakes features are non-negotiable for credibility; differentiators create the unique value proposition; anti-features must be explicitly avoided to prevent scope creep.

**Must have (table stakes):**
- **Persistent Storage** — Users expect memories to survive page reloads (IndexedDB via Dexie.js)
- **Vector Embeddings** — Semantic search requires embeddings (Transformers.js + MiniLM-L6-v2)
- **CRUD Operations** — Basic memory management with bulk operations for UX
- **Semantic Search** — Find memories by meaning, not just keywords (brute-force acceptable for <3K memories)
- **Memory Types/Categories** — Organize by type (identity, preference, etc.) with regex + embedding classifier
- **Event Callbacks** — Reactive UI requires knowing when memories change
- **Export/Import** — Users own their data; JSON round-trip essential
- **Token-Aware Retrieval** — Don't exceed LLM context window
- **TypeScript Support** — Modern JS libraries require 100% type coverage

**Should have (competitive differentiators):**
- **Mathematical Decay Model** — Ebbinghaus forgetting curve with per-category λ values; core differentiator from dumb vector DBs
- **Contradiction Detection** — Three-stage pipeline handling "I used to live in Berlin, now London" correctly
- **Pinned Memories** — User can lock critical facts from decay (λ = 0, retrieval priority boost)
- **Debug Transparency** — `augment()` returns debug object with scores, breakdowns, reasons
- **Worker-Based Architecture** — Non-blocking embedding computation (SharedWorker → Worker → main-thread fallback)
- **Composite Relevance Scoring** — R(m,q) = w1×semantic + w2×recency + w3×strength + w4×continuity

**Defer (v0.2+):**
- HNSW Vector Search — Trigger: >3K memories or retrieval >30ms
- Episodic Memory — Trigger: Users want conversation recall
- Proactive Memory — Trigger: Users want anticipatory injection
- Knowledge Graph Edges — Trigger: Need related memory suggestions
- At-Rest Encryption — Trigger: Users on shared devices need privacy

See [FEATURES.md](./FEATURES.md) for complete feature matrix, dependency graph, and competitor analysis.

### Architecture Approach

The recommended architecture follows a three-tier pattern optimized for browser constraints: Main Thread (UI/API), SharedWorker Layer (coordination), and IndexedDB Layer (persistence). This enables multi-tab synchronization while keeping ML computation off the main thread.

**Major components:**
1. **MemoryClient** (main thread) — Public API adapter, DTO serialization, event handling; communicates with MemoryHub via SharedWorker port
2. **MemoryHub** (SharedWorker) — Connection coordinator, message routing, multi-tab sync; routes to worker modules
3. **EmbeddingEngine** (worker) — Model loading, text embedding, LRU caching; uses Transformers.js with CacheStorage
4. **MemoryStore** (worker) — Vector search, CRUD operations, index management; interfaces with Dexie.js
5. **LifecycleManager** (worker) — Decay calculation, contradiction detection, consolidation; runs scheduled maintenance

Key patterns include: DTO pattern excluding embeddings from IPC (prevents serialization issues), SharedWorker with port-based messaging (enables multi-tab model sharing), LRU cache for embeddings (reduces redundant computation), transaction-scoped IndexedDB operations (ensures data integrity), and brute-force vector search with early exit (sufficient for <3K memories).

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed data flow diagrams, build order implications, and scalability considerations.

### Critical Pitfalls

Research identified seven critical pitfalls that could cause rewrites or major issues if not addressed proactively.

1. **Float32Array Serialization in Worker Communication** — Attempting to pass Float32Array embeddings directly through postMessage causes silent failures or memory duplication. Prevention: Transfer `.buffer` (not the TypedArray view) when sender no longer needs data; better yet, keep embeddings internal to workers and only send scalar scores/metadata to main thread.

2. **SharedWorker Port Lifecycle Management** — Connections fail silently in multi-tab scenarios when `port.start()` is omitted or messages sent to disconnected ports. Prevention: Always use `onmessage` (auto-starts) or call `port.start()` explicitly; implement graceful fallback to DedicatedWorker.

3. **IndexedDB Transaction Auto-Commit Timing** — Transactions commit unexpectedly between async operations, causing "Transaction inactive" errors. Prevention: Keep operations synchronous within transactions; use Dexie's transaction helper for async operations.

4. **Model Loading Memory Exhaustion** — Loading multiple models or reloading on every session causes browser memory limits, especially on mobile (MiniLM is ~22MB). Prevention: Implement singleton pattern with proper disposal; configure browser caching; use quantized models (q8).

5. **Brute-Force Search Performance Cliff** — O(N) vector search becomes unusable as memory count grows (target: <30ms retrieval). Prevention: Use cursor-based iteration with early termination; document 3,000 memory limit; plan HNSW for v0.2.

6. **Ebbinghaus Decay Implementation Errors** — Incorrect time units or integer division causes memories to decay too fast or never decay. Prevention: Use explicit Date objects; convert to days for calculation; verify with unit tests against known retention curves.

7. **Contradiction Detection False Positives** — String matching too strict rejects legitimate updates. Prevention: Use typed attribute extraction with temporal markers; normalize values before comparison; tune confidence thresholds.

See [PITFALLS.md](./PITFALLS.md) for complete prevention code examples, detection strategies, and recovery procedures.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation & Worker Infrastructure
**Rationale:** All subsequent phases depend on the worker communication layer and database schema. Getting the IPC patterns right upfront prevents costly rewrites.
**Delivers:** SharedWorker coordination hub, DTO types, Dexie.js schema, basic connection handling
**Addresses:** Persistent Storage (table stakes), Worker Architecture (differentiator), Event Callbacks
**Avoids:** Float32Array serialization pitfalls, SharedWorker port lifecycle issues, DTO pattern violations
**Research Flag:** LOW — patterns are well-documented in MDN and Dexie.js docs

### Phase 2: Embedding Engine
**Rationale:** Core capability that enables all semantic features. Must be established before retrieval or learning can function.
**Delivers:** Transformers.js integration, model loading/caching, LRU embedding cache, WebGPU/WASM fallback
**Uses:** @huggingface/transformers@3.8.1, onnxruntime-web@1.24.2, MiniLM-L6-v2 model
**Avoids:** Model loading memory exhaustion, WebGPU fallback failures, cache poisoning with model updates
**Research Flag:** LOW — Transformers.js documentation is comprehensive

### Phase 3: Memory Store & Retrieval
**Rationale:** Vector search and CRUD operations form the data access layer required by higher-level features.
**Delivers:** Brute-force vector search with cosine similarity, composite relevance scoring, token-aware retrieval, CRUD + bulk operations
**Addresses:** Semantic Search, Token-Aware Retrieval, CRUD Operations, Debug Transparency (scoring breakdown)
**Avoids:** Brute-force performance cliff (document 3K limit), IndexedDB transaction timing issues
**Research Flag:** MEDIUM — performance characteristics need benchmarking during implementation

### Phase 4: Lifecycle & Decay System
**Rationale:** Mathematical decay is a core differentiator; requires stable storage and retrieval layers first.
**Delivers:** Ebbinghaus decay calculation with per-category λ values, pinned memories (λ = 0), strength-based retrieval adjustment
**Addresses:** Mathematical Decay Model, Pinned Memories
**Avoids:** Decay calculation errors (time unit confusion), storage quota exceeded issues
**Research Flag:** MEDIUM — decay constants need tuning based on user feedback

### Phase 5: Contradiction Detection & Learning
**Rationale:** Most complex business logic; depends on all previous layers for storage, embeddings, and decay state.
**Delivers:** Three-stage contradiction pipeline (candidate match → temporal marker → typed conflict), extraction scoring E(s) = novelty × specificity × recurrence, supersession chains
**Addresses:** Contradiction Detection, Memory Types/Categories
**Avoids:** False positive contradictions, string matching too strict
**Research Flag:** HIGH — complex NLP-adjacent logic, needs validation with real conversation data

### Phase 6: Management API & Export/Import
**Rationale:** Final API surface; depends on all internal systems being stable.
**Delivers:** Complete manage() API, JSON export/import, Markdown export, TypeScript definitions
**Addresses:** Export/Import, TypeScript Support
**Avoids:** Base64 Float32Array precision issues, DTO boundary violations
**Research Flag:** LOW — standard API design patterns

### Phase 7: React Demo Application
**Rationale:** Validation and developer experience; proves the library works in real React applications.
**Delivers:** Demo app with memory panel, real-time updates, export/import UI, performance monitoring
**Avoids:** Memory leaks in useEffect, worker cleanup issues
**Research Flag:** LOW — standard React patterns

### Phase Ordering Rationale

The order follows the architecture's dependency chain: database schema → embedding capability → data access → business logic → API surface → demo application. This sequencing prevents blocking dependencies and enables incremental validation.

Worker infrastructure comes first because it enables the non-blocking architecture that is a key differentiator. Without proper SharedWorker coordination, the embedding engine would block the main thread, violating the "Worker-Based Architecture" differentiator.

Decay and contradiction detection are intentionally sequenced after core retrieval because they build on those foundations. Decay calculations need retrieval timestamps; contradiction detection needs embedding similarity search and storage for supersession chains.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Contradiction Detection):** Complex NLP-adjacent logic with temporal marker parsing and typed attribute extraction. Sparse documentation on browser-native contradiction detection. Recommend `/gsd:research-phase` before implementation.
- **Phase 3 (Retrieval System):** Performance characteristics of brute-force search at scale need validation. Recommend benchmarking at 1K, 2K, 3K memory thresholds.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Worker Infrastructure):** Well-documented in MDN Web Workers API and Dexie.js documentation.
- **Phase 2 (Embedding Engine):** Transformers.js has comprehensive guides and examples.
- **Phase 6 (Management API):** Standard API design with no novel patterns.
- **Phase 7 (React Demo):** Standard React application patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official documentation from Hugging Face, Microsoft (ONNX), Dexie.js, and Vite. Version compatibility verified. |
| Features | HIGH | Based on PRD v0.4, competitor analysis (Mem0, LangMem, railroad-memory, EntityDB), and ecosystem research. Clear market gaps identified. |
| Architecture | HIGH | MDN documentation for Web APIs (SharedWorker, IndexedDB, CacheStorage) is authoritative. Transformers.js examples validate patterns. |
| Pitfalls | MEDIUM | Official docs verified for core issues; some patterns inferred from GitHub issues and training data. Critical pitfalls have clear prevention strategies. |

**Overall confidence:** HIGH

The research is grounded in authoritative sources (MDN, official project documentation) and validated against existing implementations. The main uncertainty is in Phase 5 (Contradiction Detection) where the complexity of temporal marker parsing and typed attribute extraction may reveal edge cases not covered in research.

### Gaps to Address

- **Contradiction Detection Thresholds:** Jaccard similarity threshold (0.3) and temporal marker confidence levels need validation with real conversation data during Phase 5 implementation. Recommend building a test corpus early.

- **Decay Constant Tuning:** Per-category lambda values (fact: 0.1, preference: 0.05, goal: 0.02) are starting points. User feedback during beta may require adjustment. Build telemetry/logging to capture retention effectiveness.

- **Performance Benchmarks:** Brute-force search threshold at 3,000 memories is theoretical. Actual performance depends on device capabilities. Implement benchmarking in Phase 3 to validate assumptions.

- **Safari SharedWorker Support:** Historical limitations in Safari private browsing mode. Test fallback chain early in Phase 1.

- **WebGPU Availability:** Still behind flags in some browsers. Ensure WASM fallback is performant enough for production use.

## Sources

### Primary (HIGH confidence)
- [MDN: SharedWorker](https://developer.mozilla.org/en-US/docs/Web/API/SharedWorker) — Worker lifecycle and port management
- [MDN: IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) — Transaction behavior and storage limits
- [MDN: Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) — Worker patterns and structured clone
- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js) — Pipeline API, model support, device configuration
- [Transformers.js GitHub](https://github.com/huggingface/transformers.js) — Version 3.8.1/4.0.0-next.4, installation and configuration
- [ONNX Runtime Web Documentation](https://onnxruntime.ai/docs/tutorials/web/) — WASM configuration and memory management
- [Dexie.js Documentation](https://dexie.org/docs/) — IndexedDB API, bulk operations, transactions
- [Vite Build Documentation](https://vite.dev/guide/build.html) — Library mode and web worker patterns

### Secondary (MEDIUM confidence)
- [Mem0 Documentation](https://docs.mem0.ai) — Competitor feature analysis
- [LangMem GitHub](https://github.com/langchain-ai/langmem) — Competitor architecture patterns
- [Mem0 GitHub Issues](https://github.com/mem0ai/mem0/issues) — Real-world memory system bugs and pitfalls
- [Transformers.js Examples](https://github.com/huggingface/transformers.js-examples) — Use case validation and patterns
- [Dexie.js GitHub](https://github.com/dexie/Dexie.js) — Version 4.3.0 features and migration patterns

### Tertiary (LOW confidence)
- [MiniLM-L6-v2 on Hugging Face](https://huggingface.co/Xenova/all-MiniLM-L6-v2) — Model specifications (validated against multiple sources)
- [ONNX Runtime GitHub Releases](https://github.com/microsoft/onnxruntime/releases) — Version 1.24.2 release notes

---

*Research completed: 2026-02-23*
*Ready for roadmap: yes*
