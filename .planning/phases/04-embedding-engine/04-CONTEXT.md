# Phase 4: Embedding Engine - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Transformers.js MiniLM loads in worker context with LRU caching and supports both CDN and airgapped deployments. This phase focuses on embedding computation infrastructure, not the retrieval/storage logic (that's Phase 5).

</domain>

<decisions>
## Implementation Decisions

### CDN vs Airgap Defaults
- **Default behavior:** CDN-first — load from CDN by default (cache forever after first load)
- **Airgap mode:** Triggered by `localModelBaseUrl` option presence — no separate boolean flag
- **CDN failure:** Fail with clear error, instruct user to use `localModelBaseUrl` for offline/airgap
- **CDN provider:** HuggingFace Hub for model files (WASM already bundled locally)
- **Preload strategy:** Preload during init — model ready immediately, slower startup
- **Progress reporting:** Detailed stages — "Downloading tokenizer", "Compiling WASM", etc.
- **Model structure:** Mirror HuggingFace structure for airgap — `Xenova/all-MiniLM-L6-v2` folder layout
- **Documentation/tools:** Both docs + CLI tool (@lokulmem/cli separate package)
- **Download behavior:** Smart — tokenizer first (fast), then model weights in parallel
- **CLI tool:** Separate package (@lokulmem/cli) — keeps main library lean
- **Model variant:** Default `Xenova/all-MiniLM-L6-v2`, configurable to `Xenova/gte-small` or custom
- **Model metadata:** Store `modelName` + `embeddingDims` in DB for export/import consistency
- **Dimension guard:** Throw if stored embeddingDims ≠ current embedder dims
- **Airgap strictness:** Full airgap — block ALL network calls (models + telemetry)

### Cache Persistence
- **Mechanism:** Cache API (designed for assets, Service Worker integration)
- **Cache TTL:** Version-based — invalidate on library version change
- **WASM binaries:** Bundle locally — explicit choice for offline/airgap support
- **Browser support:** Claude's discretion — implement feature detection and graceful degradation

### LRU Cache Configuration
- **Cache size basis:** Both — entry count (primary) + memory warning
- **Default size:** 1,000 entries (~1.5MB memory)
- **Memory pressure:** Default warn only, optional auto-shrink via config
- **Persistence:** Memory-only by default, optional `persistEmbeddingCache?: boolean` (default false)
- **Warming strategy:** On-demand — populate as needed, no pre-warming
- **Configuration timing:** Init only — set at `createLokulMem()`, not runtime configurable
- **Cache stats:** Expose via debug API — hit/miss ratio, current size, oldest entry age
- **Eviction strategy:** Pure LRU — evict least recently used
- **Memory thresholds:** Warn at 10MB, critical at 50MB

### Error Handling & Recovery
- **Model load failure:** Throw immediately — init() fails with clear error
- **Retry logic:** Limited smart retry — max 2 retries with exponential backoff + jitter
  - Retry on: network timeout, TypeError: Failed to fetch, 5xx
  - No retry on: 404, CSP blocked, `allowRemoteModels=false`, missing airgap assets
- **Worker fallback:** Yes, but only for Worker-related failures (404, blocked, unsupported)
  - Do NOT fallback if embedding model fails — fail init() with recovery steps
- **Error structure:** Rich + category — code, message, recovery hint, original error, category (retryable/fatal/warning)

### Performance Tradeoffs
- **Backend:** Auto-detect — try WebGPU first (Chrome 113+), fallback to WASM
- **Batch embedding:** Yes — better for bulk operations
- **Batch size cap:** 32 — balanced throughput/latency
- **Parallel processing:** No — single worker queue (simpler, no data race risks)
- **Quantization:** q8 — balanced, standard for web (~22MB)
- **Warm cache latency target:** < 100ms — acceptable, noticeable
- **Benchmarks:** Yes, repo-only tooling in `/bench/` folder with Playwright
  - Not shipped in runtime bundle
  - Measures: embed latency (cold/warm), batch throughput, vector search, memory, cache hit/miss

### Claude's Discretion
- Browser support minimums — implement feature detection and graceful degradation
- WASM/ORT asset bundling patterns
- WebGPU feature detection strategy
- Cache API integration details
- Benchmark implementation approach

</decisions>

<specifics>
## Specific Ideas

- "Mirror HuggingFace structure for airgap setup" — clear folder convention
- "Fail fast with recovery hint" — better UX than silent degradation
- "Smart download: tokenizer first, then parallel model weights" — optimize perceived performance
- "Separate CLI package (@lokulmem/cli)" — keeps main bundle lean for browser
- "Dimension guard on import" — prevent model mismatch corruption
- "Version-based cache invalidation" — automatic compatibility on library updates
- "Batch cap at 32" — balanced for typical use cases

</specifics>

<deferred>
## Deferred Ideas

- Alternative model variants beyond L6-v2 and gte-small — can be added later via string config
- HNSW vector search — belongs in Phase 5 (Memory Store & Retrieval)
- Episodic memory features — deferred to v0.2
- At-rest encryption — deferred to v0.3
- Scheduled/automated model updates — out of scope, version-based invalidation handles this

</deferred>

---

*Phase: 04-embedding-engine*
*Context gathered: 2026-02-23*
