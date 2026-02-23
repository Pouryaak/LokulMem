# Phase 4: Embedding Engine - Research

**Researched:** 2026-02-23
**Domain:** Transformers.js, ONNX Runtime Web, embedding computation in Web Workers
**Confidence:** HIGH

## Summary

Phase 4 implements the embedding computation infrastructure using Transformers.js with MiniLM-L6-v2 in the Web Worker context. The research confirms Transformers.js v3+ (now @huggingface/transformers) is the appropriate library, with built-in support for Web Workers, CDN loading with Cache API integration, airgapped deployment via local model paths, and WebGPU/WASM backend auto-detection.

Key findings:
1. **Transformers.js v3+** uses `@huggingface/transformers` package with a unified API for browser and Node.js
2. **Feature Extraction pipeline** (`feature-extraction` task) generates 384-dimensional embeddings with MiniLM-L6-v2
3. **Environment configuration** via `env` object controls CDN vs local loading (`allowRemoteModels`, `allowLocalModels`, `localModelPath`)
4. **Cache API integration** is built-in via `useBrowserCache` and `useWasmCache` options
5. **WebGPU support** is opt-in via `device: 'webgpu'` with automatic WASM fallback
6. **Quantization** via `dtype: 'q8'` (default for WASM) reduces model size to ~22MB

**Primary recommendation:** Use `@huggingface/transformers` with `pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8', device: 'auto' })`, implement LRU cache for 1000 embeddings in the worker, configure environment based on `localModelBaseUrl` option presence, and bundle ONNX WASM files locally for airgap support.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**CDN vs Airgap Defaults:**
- Default behavior: CDN-first — load from CDN by default (cache forever after first load)
- Airgap mode: Triggered by `localModelBaseUrl` option presence — no separate boolean flag
- CDN failure: Fail with clear error, instruct user to use `localModelBaseUrl` for offline/airgap
- CDN provider: HuggingFace Hub for model files (WASM already bundled locally)
- Preload strategy: Preload during init — model ready immediately, slower startup
- Progress reporting: Detailed stages — "Downloading tokenizer", "Compiling WASM", etc.
- Model structure: Mirror HuggingFace structure for airgap — `Xenova/all-MiniLM-L6-v2` folder layout
- Documentation/tools: Both docs + CLI tool (@lokulmem/cli separate package)
- Download behavior: Smart — tokenizer first (fast), then model weights in parallel
- CLI tool: Separate package (@lokulmem/cli) — keeps main library lean
- Model variant: Default `Xenova/all-MiniLM-L6-v2`, configurable to `Xenova/gte-small` or custom
- Model metadata: Store `modelName` + `embeddingDims` in DB for export/import consistency
- Dimension guard: Throw if stored embeddingDims ≠ current embedder dims
- Airgap strictness: Full airgap — block ALL network calls (models + telemetry)

**Cache Persistence:**
- Mechanism: Cache API (designed for assets, Service Worker integration)
- Cache TTL: Version-based — invalidate on library version change
- WASM binaries: Bundle locally — explicit choice for offline/airgap support
- Browser support: Claude's discretion — implement feature detection and graceful degradation

**LRU Cache Configuration:**
- Cache size basis: Both — entry count (primary) + memory warning
- Default size: 1,000 entries (~1.5MB memory)
- Memory pressure: Default warn only, optional auto-shrink via config
- Persistence: Memory-only by default, optional `persistEmbeddingCache?: boolean` (default false)
- Warming strategy: On-demand — populate as needed, no pre-warming
- Configuration timing: Init only — set at `createLokulMem()`, not runtime configurable
- Cache stats: Expose via debug API — hit/miss ratio, current size, oldest entry age
- Eviction strategy: Pure LRU — evict least recently used
- Memory thresholds: Warn at 10MB, critical at 50MB

**Error Handling & Recovery:**
- Model load failure: Throw immediately — init() fails with clear error
- Retry logic: Limited smart retry — max 2 retries with exponential backoff + jitter
  - Retry on: network timeout, TypeError: Failed to fetch, 5xx
  - No retry on: 404, CSP blocked, `allowRemoteModels=false`, missing airgap assets
- Worker fallback: Yes, but only for Worker-related failures (404, blocked, unsupported)
  - Do NOT fallback if embedding model fails — fail init() with recovery steps
- Error structure: Rich + category — code, message, recovery hint, original error, category (retryable/fatal/warning)

**Performance Tradeoffs:**
- Backend: Auto-detect — try WebGPU first (Chrome 113+), fallback to WASM
- Batch embedding: Yes — better for bulk operations
- Batch size cap: 32 — balanced throughput/latency
- Parallel processing: No — single worker queue (simpler, no data race risks)
- Quantization: q8 — balanced, standard for web (~22MB)
- Warm cache latency target: < 100ms — acceptable, noticeable
- Benchmarks: Yes, repo-only tooling in `/bench/` folder with Playwright
  - Not shipped in runtime bundle
  - Measures: embed latency (cold/warm), batch throughput, vector search, memory, cache hit/miss

### Claude's Discretion

- Browser support minimums — implement feature detection and graceful degradation
- WASM/ORT asset bundling patterns
- WebGPU feature detection strategy
- Cache API integration details
- Benchmark implementation approach

### Deferred Ideas (OUT OF SCOPE)

- Alternative model variants beyond L6-v2 and gte-small — can be added later via string config
- HNSW vector search — belongs in Phase 5 (Memory Store & Retrieval)
- Episodic memory features — deferred to v0.2
- At-rest encryption — deferred to v0.3
- Scheduled/automated model updates — out of scope, version-based invalidation handles this
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EMBED-01 | Transformers.js MiniLM-L6-v2 loads in worker context | `pipeline()` works in Web Workers; env.IS_WEBWORKER_ENV auto-detected |
| EMBED-02 | LRU cache (1000 entries) for embeddings | Implement custom LRU with Map + memory tracking |
| EMBED-03 | Promise-based concurrency queue prevents concurrent embedding calls | Single embedder instance with request queue pattern |
| EMBED-04 | Model loads from CDN with local cache (Cache API) | `env.useBrowserCache = true` (default) uses Cache API |
| EMBED-05 | `localModelBaseUrl` option enables airgapped/offline usage | `env.localModelPath` + `env.allowRemoteModels = false` |
| EMBED-06 | ONNX WASM paths configurable via options | `env.backends.onnx.wasm.wasmPaths` for custom WASM location |
| EMBED-07 | ORT assets bundled into dist (glob copy ort-wasm*.wasm and ort-wasm*.mjs) | Vite `publicDir` or `rollup-plugin-copy` for WASM files |
| EMBED-08 | `workerUrl` option supported for custom worker resolution | Already implemented in WorkerManager (Phase 2) |
| EMBED-09 | Airgap mode explicitly sets `env.allowLocalModels=true`, `env.allowRemoteModels=false`, `env.localModelPath=<localModelBaseUrl>` | Confirmed env properties from official docs |
| EMBED-10 | Airgap mode requires consumers to host model assets mirroring `Xenova/all-MiniLM-L6-v2` repository structure under `localModelBaseUrl` | Model files in `onnx/` subfolder per HuggingFace structure |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @huggingface/transformers | ^3.0.0 | Embedding pipeline with MiniLM-L6-v2 | Official successor to @xenova/transformers, battle-tested, WebGPU support, CDN integration |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| onnxruntime-web | (bundled) | ONNX Runtime Web for model inference | Required by Transformers.js, WASM backend |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @huggingface/transformers | Custom ONNX Runtime + tokenizer | 1000+ lines of complex code, no CDN caching, no WebGPU abstraction |
| @huggingface/transformers | TensorFlow.js | Larger bundle, no pre-converted MiniLM models, complex model conversion |
| @huggingface/transformers | WebLLM | Overkill for embeddings only, designed for LLM inference |

**Installation:**
```bash
npm install @huggingface/transformers
```

**WASM Files to Bundle (for airgap):**
```
ort-wasm-simd-threaded.wasm
ort-wasm-simd.wasm
ort-wasm-threaded.wasm
ort-wasm.wasm
ort-wasm-simd-threaded.mjs
ort-wasm-simd.mjs
ort-wasm-threaded.mjs
ort-wasm.mjs
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── embedding/
│   ├── EmbeddingEngine.ts       # Main embedder with LRU cache
│   ├── EmbeddingCache.ts        # LRU cache implementation
│   ├── modelConfig.ts           # Environment configuration helpers
│   └── types.ts                 # Embedding-specific types
├── worker/
│   └── index.ts                 # Worker entry (existing, adds embedder init)
```

### Pattern 1: Transformers.js Pipeline in Worker
**What:** Initialize feature-extraction pipeline in Web Worker with environment configuration
**When to use:** All embedding computation (keeps main thread responsive)
**Example:**
```typescript
// Source: https://huggingface.co/docs/transformers.js/api/pipelines
import { pipeline, env } from '@huggingface/transformers';

// Configure environment before pipeline creation
env.allowRemoteModels = !localModelBaseUrl;
env.allowLocalModels = !!localModelBaseUrl;
env.localModelPath = localModelBaseUrl || '/models/';
env.useBrowserCache = true;
env.useWasmCache = true;

// Create pipeline with quantization and auto device detection
const embedder = await pipeline(
  'feature-extraction',
  modelName, // 'Xenova/all-MiniLM-L6-v2'
  {
    dtype: 'q8',        // 8-bit quantization (~22MB)
    device: 'auto',     // WebGPU if available, else WASM
  }
);

// Generate embeddings
const output = await embedder(texts, {
  pooling: 'mean',
  normalize: true,
});
// Returns: Tensor { dims: [batchSize, 384], type: 'float32' }
```

### Pattern 2: LRU Cache for Embeddings
**What:** In-memory cache with LRU eviction and memory monitoring
**When to use:** All embedding lookups to avoid recomputation
**Example:**
```typescript
// Source: Phase 4 user constraints
interface CacheEntry {
  embedding: Float32Array;
  lastAccessed: number;
}

class EmbeddingCache {
  private cache = new Map<string, CacheEntry>();
  private maxEntries = 1000;
  private currentMemoryBytes = 0;

  get(key: string): Float32Array | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastAccessed = Date.now();
      this.cache.delete(key);
      this.cache.set(key, entry); // Move to end (most recent)
      return entry.embedding;
    }
    return undefined;
  }

  set(key: string, embedding: Float32Array): void {
    // Check memory thresholds
    const entrySize = embedding.byteLength;
    if (this.currentMemoryBytes + entrySize > 10 * 1024 * 1024) {
      console.warn('Embedding cache approaching 10MB warning threshold');
    }

    // Evict if at capacity
    while (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      const firstEntry = this.cache.get(firstKey)!;
      this.currentMemoryBytes -= firstEntry.embedding.byteLength;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      embedding,
      lastAccessed: Date.now(),
    });
    this.currentMemoryBytes += entrySize;
  }

  getStats() {
    return {
      size: this.cache.size,
      memoryBytes: this.currentMemoryBytes,
      hitRate: this.hits / (this.hits + this.misses),
    };
  }
}
```

### Pattern 3: Concurrency Queue
**What:** Single-promise queue to prevent concurrent embedding calls
**When to use:** When embedder is shared across multiple requests
**Example:**
```typescript
// Source: Common pattern for singleton async resources
class EmbeddingEngine {
  private embedder: FeatureExtractionPipeline | null = null;
  private pendingPromise: Promise<unknown> | null = null;

  async embed(text: string): Promise<Float32Array> {
    // Wait for any pending operation
    while (this.pendingPromise) {
      await this.pendingPromise;
    }

    // Create new pending promise
    const promise = this.doEmbed(text);
    this.pendingPromise = promise;

    try {
      return await promise;
    } finally {
      this.pendingPromise = null;
    }
  }

  private async doEmbed(text: string): Promise<Float32Array> {
    if (!this.embedder) {
      throw new Error('Embedder not initialized');
    }
    const output = await this.embedder(text, { pooling: 'mean', normalize: true });
    return new Float32Array(output.data);
  }
}
```

### Pattern 4: Batch Embedding with Size Cap
**What:** Process multiple texts in batches, capped at 32
**When to use:** Bulk operations (import, maintenance)
**Example:**
```typescript
// Source: Phase 4 user constraints (batch cap at 32)
async function embedBatch(
  texts: string[],
  embedder: FeatureExtractionPipeline,
  maxBatchSize = 32
): Promise<Float32Array[]> {
  const results: Float32Array[] = [];

  for (let i = 0; i < texts.length; i += maxBatchSize) {
    const batch = texts.slice(i, i + maxBatchSize);
    const output = await embedder(batch, {
      pooling: 'mean',
      normalize: true,
    });

    // Extract individual embeddings from batch output
    const batchSize = batch.length;
    const dims = 384;
    for (let j = 0; j < batchSize; j++) {
      const start = j * dims;
      const embedding = new Float32Array(output.data.slice(start, start + dims));
      results.push(embedding);
    }
  }

  return results;
}
```

### Pattern 5: Airgap Environment Configuration
**What:** Configure Transformers.js for offline/airgapped deployment
**When to use:** When `localModelBaseUrl` is provided
**Example:**
```typescript
// Source: https://huggingface.co/docs/transformers.js/api/env
import { env } from '@huggingface/transformers';

function configureAirgapMode(localModelBaseUrl: string): void {
  // Disable all remote model loading
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = localModelBaseUrl;

  // Configure WASM paths (bundled locally)
  env.backends.onnx.wasm.wasmPaths = '/ort-wasm/';

  // Still use Cache API for performance
  env.useBrowserCache = true;
  env.useWasmCache = true;
}

function configureCdnMode(): void {
  // Default: CDN-first with local cache
  env.allowRemoteModels = true;
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  env.useWasmCache = true;
}
```

### Pattern 6: Progress Reporting During Model Load
**What:** Report detailed progress stages during model initialization
**When to use:** During worker initialization (model stage)
**Example:**
```typescript
// Source: Phase 4 user constraints + Transformers.js patterns
async function initializeModelWithProgress(
  modelName: string,
  onProgress: (stage: string, progress: number) => void
): Promise<FeatureExtractionPipeline> {
  // Stage 1: Tokenizer (fast, ~10% of total)
  onProgress('Downloading tokenizer', 0);
  // Tokenizer loads as part of pipeline creation

  // Stage 2: Model weights (parallel, ~80% of total)
  onProgress('Downloading model weights', 10);

  // Stage 3: WASM compilation (~10% of total)
  onProgress('Compiling WASM', 90);

  const embedder = await pipeline('feature-extraction', modelName, {
    dtype: 'q8',
    device: 'auto',
  });

  onProgress('Model ready', 100);
  return embedder;
}
```

### Anti-Patterns to Avoid

**Creating multiple pipeline instances:** Each pipeline loads model weights into memory. Use singleton pattern.

**Not pooling/normalizing embeddings:** Always use `pooling: 'mean', normalize: true` for sentence embeddings.

**Storing raw Tensor objects:** Convert to Float32Array immediately: `new Float32Array(tensor.data)`.

**Synchronous dimension validation:** Validate embedding dimensions (384) asynchronously to avoid blocking.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ONNX model loading | Custom fetch + ort.InferenceSession | Transformers.js `pipeline()` | Handles tokenizer, model config, quantization, device selection |
| Tokenization | Custom tokenizer implementation | Transformers.js AutoTokenizer | BPE/WordPiece tokenization is complex and model-specific |
| WebGPU detection | Custom navigator.gpu checks | Transformers.js `device: 'auto'` | Properly handles fallback chain and browser differences |
| Cache API wrapper | Custom cache implementation | Transformers.js built-in caching | Integrates with model loading lifecycle |
| Embedding normalization | Custom vector math | `normalize: true` option | Proper L2 normalization for cosine similarity |
| LRU cache | Custom data structure | Map with ordered keys | Map maintains insertion order, efficient O(1) operations |

**Key insight:** Transformers.js abstracts away the complexity of ONNX Runtime, tokenization, and model configuration. The pipeline API handles device selection, quantization, and caching automatically. Custom implementations would require 1000+ lines of error-prone code for model loading alone.

---

## Common Pitfalls

### Pitfall 1: Pipeline Not Awaiting Properly
**What goes wrong:** Calling `pipeline()` without await returns a Promise, not the pipeline instance.
**Why it happens:** The API is async but looks like it could be synchronous.
**How to avoid:** Always await: `const embedder = await pipeline(...)`
**Warning signs:** `embedder is not a function` errors, undefined behavior.

### Pitfall 2: Missing WebGPU Fallback
**What goes wrong:** Specifying `device: 'webgpu'` without fallback crashes on unsupported browsers.
**Why it happens:** WebGPU is only available in Chrome 113+ and Edge.
**How to avoid:** Use `device: 'auto'` or implement explicit fallback detection.
**Warning signs:** Initialization hangs or throws on Safari/Firefox.

### Pitfall 3: Incorrect Model Path in Airgap Mode
**What goes wrong:** Model fails to load in airgap mode due to incorrect folder structure.
**Why it happens:** Transformers.js expects specific HuggingFace repository structure.
**How to avoid:** Mirror `Xenova/all-MiniLM-L6-v2` structure: `onnx/model.onnx`, `tokenizer.json`, `config.json`
**Warning signs:** 404 errors for model files, initialization timeout.

### Pitfall 4: Memory Leak in LRU Cache
**What goes wrong:** Cache grows unbounded when entries are added but not properly evicted.
**Why it happens:** Not tracking memory usage or implementing size limits.
**How to avoid:** Track `byteLength` of all embeddings, enforce max entries + memory thresholds.
**Warning signs:** Tab crashes with out-of-memory, performance degradation over time.

### Pitfall 5: Float32Array View Footgun (in cache)
**What goes wrong:** Storing Tensor data views that share underlying buffers causes data corruption.
**Why it happens:** `tensor.data` may be a view into a larger WASM memory buffer.
**How to avoid:** Always create new Float32Array: `new Float32Array(tensor.data)` copies the data.
**Warning signs:** Embeddings change unexpectedly, similarity scores are inconsistent.

### Pitfall 6: Not Handling Quantization Correctly
**What goes wrong:** Using `dtype: 'fp32'` in WASM causes poor performance and high memory usage.
**Why it happens:** Full precision is slower and uses 4x more memory than q8.
**How to avoid:** Always use `dtype: 'q8'` for embedding models in browser.
**Warning signs:** Slow embedding (~1s+ per text), high memory usage (>100MB).

### Pitfall 7: Concurrent Model Loading
**What goes wrong:** Multiple simultaneous pipeline creations cause race conditions and memory bloat.
**Why it happens:** Pipeline creation is async and not automatically deduplicated.
**How to avoid:** Use singleton pattern with promise queue for initialization.
**Warning signs:** Multiple model downloads, 2x+ memory usage, initialization errors.

---

## Code Examples

### Complete EmbeddingEngine Implementation
```typescript
// Source: Transformers.js docs + Phase 4 requirements
import { pipeline, env } from '@huggingface/transformers';
import type { FeatureExtractionPipeline } from '@huggingface/transformers';

interface EmbeddingConfig {
  modelName?: string;
  localModelBaseUrl?: string;
  maxCacheEntries?: number;
}

interface CacheStats {
  size: number;
  memoryBytes: number;
  hitRate: number;
}

export class EmbeddingEngine {
  private embedder: FeatureExtractionPipeline | null = null;
  private cache = new Map<string, { embedding: Float32Array; lastAccessed: number }>();
  private maxCacheEntries: number;
  private modelName: string;
  private hits = 0;
  private misses = 0;
  private currentMemoryBytes = 0;

  constructor(config: EmbeddingConfig = {}) {
    this.modelName = config.modelName || 'Xenova/all-MiniLM-L6-v2';
    this.maxCacheEntries = config.maxCacheEntries || 1000;

    // Configure environment
    if (config.localModelBaseUrl) {
      env.allowRemoteModels = false;
      env.allowLocalModels = true;
      env.localModelPath = config.localModelBaseUrl;
    }
  }

  async initialize(onProgress?: (stage: string, progress: number) => void): Promise<void> {
    onProgress?.('Loading tokenizer', 10);
    onProgress?.('Loading model weights', 50);

    this.embedder = await pipeline('feature-extraction', this.modelName, {
      dtype: 'q8',
      device: 'auto',
    });

    onProgress?.('Model ready', 100);
  }

  async embed(text: string): Promise<Float32Array> {
    // Check cache
    const cached = this.cache.get(text);
    if (cached) {
      cached.lastAccessed = Date.now();
      this.cache.delete(text);
      this.cache.set(text, cached);
      this.hits++;
      return cached.embedding;
    }
    this.misses++;

    if (!this.embedder) {
      throw new Error('Embedder not initialized');
    }

    // Generate embedding
    const output = await this.embedder(text, {
      pooling: 'mean',
      normalize: true,
    });

    // Convert to Float32Array (copy data out of WASM memory)
    const embedding = new Float32Array(output.data);

    // Validate dimensions
    if (embedding.length !== 384) {
      throw new Error(`Invalid embedding dimension: ${embedding.length}, expected 384`);
    }

    // Cache result
    this.setCache(text, embedding);

    return embedding;
  }

  async embedBatch(texts: string[], maxBatchSize = 32): Promise<Float32Array[]> {
    const results: Float32Array[] = [];

    for (let i = 0; i < texts.length; i += maxBatchSize) {
      const batch = texts.slice(i, i + maxBatchSize);

      // Check cache for each text
      const uncachedTexts: string[] = [];
      const uncachedIndices: number[] = [];

      for (let j = 0; j < batch.length; j++) {
        const cached = this.cache.get(batch[j]);
        if (cached) {
          results[i + j] = cached.embedding;
          this.hits++;
        } else {
          uncachedTexts.push(batch[j]);
          uncachedIndices.push(i + j);
          this.misses++;
        }
      }

      if (uncachedTexts.length === 0) continue;

      if (!this.embedder) {
        throw new Error('Embedder not initialized');
      }

      // Embed uncached texts
      const output = await this.embedder(uncachedTexts, {
        pooling: 'mean',
        normalize: true,
      });

      // Extract embeddings
      const dims = 384;
      for (let j = 0; j < uncachedTexts.length; j++) {
        const start = j * dims;
        const embedding = new Float32Array(output.data.slice(start, start + dims));
        results[uncachedIndices[j]] = embedding;
        this.setCache(uncachedTexts[j], embedding);
      }
    }

    return results;
  }

  private setCache(key: string, embedding: Float32Array): void {
    // Memory threshold warning
    if (this.currentMemoryBytes > 10 * 1024 * 1024) {
      console.warn('Embedding cache exceeds 10MB warning threshold');
    }

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxCacheEntries) {
      const firstKey = this.cache.keys().next().value;
      const firstEntry = this.cache.get(firstKey)!;
      this.currentMemoryBytes -= firstEntry.embedding.byteLength;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      embedding,
      lastAccessed: Date.now(),
    });
    this.currentMemoryBytes += embedding.byteLength;
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      memoryBytes: this.currentMemoryBytes,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  clearCache(): void {
    this.cache.clear();
    this.currentMemoryBytes = 0;
    this.hits = 0;
    this.misses = 0;
  }
}
```

### Worker Integration Pattern
```typescript
// Source: Phase 2 worker structure + Transformers.js
import { EmbeddingEngine } from '../embedding/EmbeddingEngine.js';

let embeddingEngine: EmbeddingEngine | null = null;

async function initializeModel(config: {
  modelName?: string;
  localModelBaseUrl?: string;
}): Promise<void> {
  embeddingEngine = new EmbeddingEngine({
    modelName: config.modelName,
    localModelBaseUrl: config.localModelBaseUrl,
  });

  await embeddingEngine.initialize((stage, progress) => {
    reportProgress(port, 'model', progress);
  });
}

async function handleEmbed(request: RequestMessage): Promise<void> {
  if (!embeddingEngine) {
    throw new Error('Embedding engine not initialized');
  }

  const { text } = request.payload as { text: string };
  const embedding = await embeddingEngine.embed(text);

  // Convert to ArrayBuffer for transfer
  const buffer = embedding.buffer.slice(
    embedding.byteOffset,
    embedding.byteOffset + embedding.byteLength
  );

  const response: ResponseMessage = {
    id: request.id,
    type: MessageTypeConst.EMBED,
    payload: { embeddingBytes: buffer },
  };

  port.postMessage(response, [buffer]);
}
```

### Vite Configuration for WASM Bundling
```typescript
// Source: Vite docs + Transformers.js requirements
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import { copyFileSync, mkdirSync } from 'fs';

// Custom plugin to copy ONNX WASM files
function copyOnnxWasm(): Plugin {
  return {
    name: 'copy-onnx-wasm',
    writeBundle() {
      const wasmFiles = [
        'ort-wasm-simd-threaded.wasm',
        'ort-wasm-simd.wasm',
        'ort-wasm-threaded.wasm',
        'ort-wasm.wasm',
      ];

      const sourceDir = 'node_modules/onnxruntime-web/dist';
      const targetDir = 'dist/ort-wasm';

      mkdirSync(targetDir, { recursive: true });

      for (const file of wasmFiles) {
        copyFileSync(
          resolve(sourceDir, file),
          resolve(targetDir, file)
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [dts({ /* ... */ }), copyOnnxWasm()],
  build: {
    // ... existing config
  },
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @xenova/transformers | @huggingface/transformers | 2024 | Official HuggingFace ownership, better maintenance |
| Manual ONNX Runtime | Transformers.js pipeline | 2023 | 90% code reduction, automatic tokenization |
| WebGL backend | WebGPU backend | 2024 | 2-3x faster inference, proper compute shaders |
| fp32 quantization | q8 quantization | 2023 | 4x smaller models, minimal accuracy loss |
| Custom caching | Cache API integration | 2023 | Automatic browser caching, Service Worker compatible |

**Deprecated/outdated:**
- `@xenova/transformers` package name (still works but migrated to `@huggingface/transformers`)
- WebGL backend in ONNX Runtime (superseded by WebGPU)
- Custom model conversion workflows (Transformers.js provides pre-converted models)

---

## Open Questions

1. **WebGPU Feature Detection Strategy**
   - What we know: `device: 'auto'` handles fallback automatically
   - What's unclear: Whether to expose WebGPU vs WASM status to users
   - Recommendation: Log backend choice for debugging, expose in debug stats

2. **WASM File Size Optimization**
   - What we know: Multiple WASM variants exist (simd, threaded, etc.)
   - What's unclear: Which variants are actually needed for different browsers
   - Recommendation: Bundle all variants (~5MB total), let ONNX Runtime select at runtime

3. **Cache Invalidation on Library Update**
   - What we know: Transformers.js uses `cacheKey` for versioning
   - What's unclear: Whether to tie cache key to LokulMem version or Transformers.js version
   - Recommendation: Use composite key: `lokulmem-${version}-${transformers-version}`

4. **Batch Size Optimization**
   - What we know: Batch cap is 32 per user constraints
   - What's unclear: Optimal batch size for different hardware
   - Recommendation: Start with 32, benchmark in Phase 4 benchmarks

---

## Sources

### Primary (HIGH confidence)
- https://huggingface.co/docs/transformers.js/api/pipelines - Pipeline API, feature-extraction task
- https://huggingface.co/docs/transformers.js/api/env - Environment configuration (allowRemoteModels, allowLocalModels, localModelPath, useBrowserCache)
- https://huggingface.co/docs/transformers.js/guides/dtypes - Quantization options (q8, q4, fp32, fp16)
- https://huggingface.co/docs/transformers.js/guides/webgpu - WebGPU support and device selection
- https://huggingface.co/Xenova/all-MiniLM-L6-v2 - Model specifications (384 dimensions, file structure)

### Secondary (MEDIUM confidence)
- https://github.com/xenova/transformers.js - GitHub repository examples and patterns
- https://www.npmjs.com/package/@huggingface/transformers - Package documentation

### Tertiary (LOW confidence)
- None — all findings verified with official HuggingFace documentation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - @huggingface/transformers is the official standard, verified with docs
- Architecture: HIGH - Patterns from official documentation and Phase 2/3 established patterns
- Pitfalls: HIGH - Verified with Transformers.js error handling documentation and common issues

**Research date:** 2026-02-23
**Valid until:** 2026-04-23 (Transformers.js is actively developed, 60-day validity appropriate)
