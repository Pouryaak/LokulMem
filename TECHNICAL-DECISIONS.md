# Technical Decisions & Critical Patterns

**Last Updated:** 2026-02-23

This file documents critical technical decisions that future agents should understand before making changes.

---

## 1. Worker URL Resolution ⚠️ CRITICAL

### Status: RESOLVED (Phase 4)

**Problem:** Worker initialization timing out

**Solution:** Use direct URL to built worker file

```typescript
// ✅ CORRECT - src/core/LokulMem.ts
workerUrl: this.config.workerUrl ??
  new URL('./worker.mjs', import.meta.url).href,

// ❌ WRONG - Do NOT use
import WorkerUrl from '../worker/index.ts?worker&url';
```

**Why:** `?worker&url` is for Vite applications, not library builds with `build.lib.worker`.

**See:**
- `.planning/phases/04-embedding-engine/WORKER-URL-FIX.md` (detailed explanation)
- `.planning/phases/04-embedding-engine/04-FINAL-SUMMARY.md` (Phase 4 summary)

---

## 2. Transformers.js Integration

### Package
```json
"@huggingface/transformers": "^3.0.0"
```

**NOT:** `@xenova/transformers` (outdated, 2 years old)

### Model Loading
```typescript
// ✅ CORRECT - New API
pipeline('feature-extraction', modelName, {
  dtype: 'q8',
  progress_callback: onProgress,
})

// ❌ WRONG - Old API
pipeline('feature-extraction', modelName, {
  quantized: true,
})
```

### Environment Configuration
```typescript
// CDN mode (default)
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = true; // ALWAYS set explicitly

// Airgap mode (via localModelBaseUrl)
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = baseUrl;
```

### WASM Paths
**Important:** Do NOT default `wasmPaths` to `localModelBaseUrl`. Only set when user provides `onnxPaths` explicitly.

---

## 3. Vite Build Configuration

### Pattern: Library with Multiple Entry Points

```typescript
// vite.config.ts
build: {
  lib: {
    entry: {
      main: resolve(__dirname, 'src/index.ts'),
      worker: resolve(__dirname, 'src/worker/index.ts'),
    },
    formats: ['es', 'cjs'],
    fileName: (format, entryName) =>
      `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`,
  },
}
```

**Output:**
- `dist/main.mjs` - Library entry point
- `dist/worker.mjs` - Worker entry point (59MB, includes Transformers.js)

### WASM Asset Bundling

Uses `vite-plugin-static-copy` for ORT WASM files:

```typescript
viteStaticCopy({
  targets: [
    { src: 'node_modules/onnxruntime-web/dist/*.wasm', dest: '.' },
    { src: 'node_modules/onnxruntime-web/dist/ort-wasm*.mjs', dest: '.' },
  ],
})
```

---

## 4. LRU Cache Configuration

### Default Settings
- **Size:** 1000 entries (~1.5MB memory)
- **Dimensions:** Parameterized (not hardcoded to 384)
- **Persistence:** Memory-only (can be persisted via config)
- **Memory Warnings:** 10MB (warn), 50MB (critical)

### Implementation
```typescript
// Constructor accepts dims parameter
new LRUCache(maxSize: number, dims: number)

// Memory calculation uses parameterized dims
estimatedMemoryBytes = size * this.dims * BYTES_PER_FLOAT
```

---

## 5. Message Protocol

### Worker Messages
```typescript
// Phase 4 additions
MessageType.EMBED = 'embed'
MessageType.EMBED_BATCH = 'embed_batch'

// Payloads
interface EmbedPayload { text: string }
interface EmbedBatchPayload { texts: string[] }
interface EmbedResponsePayload { embedding: number[]; dimensions: number }
interface EmbedBatchResponsePayload { embeddings: number[][]; dimensions: number }
```

**Pattern:** Use `number[]` instead of `Float32Array` for Worker IPC serialization.

---

## 6. Testing

### Manual Test Files
- `test-manual.html` - Phases 1-3 testing
- `test-phase4.html` - Phase 4 embedding engine testing

### Running Tests
```bash
# Start server
python3 -m http.server 8080

# Open in browser
open http://localhost:8080/test-phase4.html
```

---

## 7. Phase Completion Status

| Phase | Name | Status | Key Files |
|-------|------|--------|-----------|
| 1 | Project Structure | ✅ Complete | vite.config.ts, tsconfig.json |
| 2 | Worker Infrastructure | ✅ Complete | WorkerManager, MessagePort |
| 3 | Storage Layer | ✅ Complete | Dexie, StorageManager, Database |
| 4 | Embedding Engine | ✅ Complete | EmbeddingEngine, LRUCache |
| 5 | Memory Store & Retrieval | ⏳ Next | HNSW, vector search, learn/augment |

---

## 8. Common Pitfalls

### ❌ Don't Use `?worker&url` for Library Builds
Creates inline worker chunks that don't work with library entry points.

### ❌ Don't Default `wasmPaths` to `localModelBaseUrl`
Causes 404s in airgap mode (WASM files at root, models at /models/).

### ❌ Don't Use `@xenova/transformers`
Outdated package. Use `@huggingface/transformers`.

### ❌ Don't Use `quantized: true`
Old API. Use `dtype: 'q8'`.

### ❌ Don't Hardcode 384 for Embedding Dimensions
Use parameterized dims for different models.

---

## 9. File Organization

```
src/
├── core/           # Core library logic
│   ├── LokulMem.ts         # Main API
│   ├── WorkerManager.ts    # Worker lifecycle
│   ├── MessagePort.ts      # Worker communication
│   └── Protocol.ts         # Message types
├── worker/         # Worker-side code
│   ├── index.ts            # Worker entry, message handlers
│   ├── EmbeddingEngine.ts  # Transformers.js integration
│   └── LRUCache.ts         # LRU cache + PromiseQueue
├── storage/        # Storage layer
│   ├── StorageManager.ts   # Lifecycle management
│   ├── Database.ts         # Dexie schema
│   └── migrations/         # DB migrations
└── types/          # TypeScript types
    ├── api.ts              # Public API types
    ├── internal.ts         # Internal types
    └── index.ts            # Type exports
```

---

## 10. Documentation Files

### Planning & Research
- `.planning/ROADMAP.md` - Project roadmap
- `.planning/phases/04-embedding-engine/04-FINAL-SUMMARY.md` - Phase 4 summary
- `.planning/phases/04-embedding-engine/WORKER-URL-FIX.md` - Worker URL fix details

### Memory (for Claude)
- `/Users/poak/.claude/projects/-Users-poak-Documents-personal-project-lokul-mind/memory/MEMORY.md`

---

*For detailed decision history, see individual phase planning directories.*
