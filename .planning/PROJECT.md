# LokulMem

## What This Is

LokulMem is a browser-native, zero-server, LLM-agnostic memory management library for AI applications. It gives any LLM — running locally via WebGPU/WebLLM, or remotely via API — the ability to remember users across conversations, extract structured knowledge from dialogue, and retrieve contextually relevant memories at inference time. Everything happens client-side: embeddings computed by quantized MiniLM in a Worker (SharedWorker when available), with graceful fallback to Dedicated Worker or main thread; storage via IndexedDB/Dexie.js; and full lifecycle management with decay, contradiction resolution, and user inspectability.

## Core Value

Developers can add persistent, privacy-preserving memory to any LLM application in under 10 minutes with three API calls: `augment()`, `learn()`, and `manage()`.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Worker infrastructure with SharedWorker → Worker → main-thread fallback
- [ ] Dexie.js IndexedDB schema with memories, episodes, edges, clusters stores
- [ ] Transformers.js MiniLM embedding engine with LRU cache
- [ ] Extraction layer: novelty, specificity, recurrence scoring (E(s))
- [ ] Contradiction detection: temporal markers + typed attribute conflicts
- [ ] Ebbinghaus decay model with per-category λ values
- [ ] Brute-force vector search (N ≤ 3,000) with composite R(m,q) scoring
- [ ] Token-aware dynamic K retrieval with budget management
- [ ] `augment()` API returning messages + debug info
- [ ] `learn()` API extracting facts from conversation
- [ ] `manage()` API: query, mutate, export, import, events
- [ ] MemoryDTO pattern excluding embeddings from IPC
- [ ] React demo app visualizing debug output
- [ ] TypeScript types with 100% public API coverage

### Out of Scope

- Cross-device sync — Intentionally device-local; export/import manual
- Multi-user/shared memory — One user per store instance
- Server replication or cloud backup — User owns their data
- Mobile SDK (React Native, Swift, Kotlin) — Browser-only target
- Non-browser runtimes (Node.js, Deno, Bun) — Requires browser APIs
- LLM fine-tuning/training — Only context injection
- HNSW index — Brute-force sufficient for v0.1 (deferred to v0.2)
- Episodic memory, emotional valence, proactive injection — v0.2 features
- At-rest encryption — v0.3 feature
- Re-extraction from conversation history — Library stores facts, not raw messages

## Context

**Technical Environment:**
- TypeScript with Vite (library mode, ESM output)
- Transformers.js for MiniLM-L6-v2 embeddings (WASM/WebGL)
- Dexie.js for IndexedDB abstraction
- Web Workers / SharedWorkers for non-blocking embedding ops

**Target Users:**
- WebLLM developers building local-first AI apps
- Developers adding memory to existing LLM integrations (OpenAI, Anthropic, Ollama)
- Privacy-conscious builders who don't want user data leaving the device

**Competitive Landscape:**
Mem0, LangMem, railroad-memory exist but all require servers or lack full lifecycle management. LokulMem fills the gap: browser-native, zero-server, with extraction, decay, contradiction handling, and user inspectability.

**Key Technical Decisions (from TASKS.json):**
- DTO pattern excludes embeddings from public API responses (prevents IPC overhead)
- JSON export serializes Float32Arrays to Base64
- Default: "Fetch Once, Cache Forever" for model loading
- Strict airgap support via `localModelBaseUrl` configuration

## Constraints

- **Tech Stack**: TypeScript, Vite, Transformers.js, Dexie.js — no switching
- **Browser APIs**: Must work in modern browsers with IndexedDB, Worker, Web Crypto support
- **Bundle Size**: Library < 2MB gzipped (excluding ~22MB model weights)
- **Performance**: Retrieval < 30ms for N ≤ 3,000; embedding < 10ms warm cache
- **Privacy**: Zero network calls after initial model download (unless user opts into remote models)
- **Embedding Dimensions**: Fixed at 384 (MiniLM-L6-v2 output)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Brute-force search for v0.1 | O(N) acceptable until 3,000 memories; HNSW adds complexity | — Pending |
| DTO pattern for IPC | Float32Arrays don't serialize well; embeddings internal-only | — Pending |
| SharedWorker primary | Multi-tab sync, model sharing across tabs | — Pending |
| Transformers.js over custom ONNX | Battle-tested, caching, progressive loading | — Pending |
| Dexie.js over raw IndexedDB | Active maintenance, good TypeScript support, compound indexes | — Pending |

---
*Last updated: 2026-02-23 after initialization*
