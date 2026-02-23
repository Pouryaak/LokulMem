# Technology Stack: Browser-Native ML Memory Systems

**Project:** Lokul Mind - Browser-Native ML Memory System
**Researched:** 2026-02-23
**Confidence:** HIGH

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @huggingface/transformers | 3.8.1 (stable) / 4.0.0-next.4 (next) | Browser ML inference | Standard for running ONNX models in browser. Functionally equivalent to Python transformers. Uses ONNX Runtime Web under the hood. |
| onnxruntime-web | 1.24.2 | ONNX model execution | Required by Transformers.js. Provides WASM and WebGPU backends. |
| dexie | 4.3.0 | IndexedDB wrapper | Minimalistic, stable, handles browser bugs. Bulk operations for performance. React hooks available. |
| vite | 6.2.0+ (stable) / 8.x (next) | Build tool and dev server | Native ESM, fast HMR, excellent library mode, built-in web worker support. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dexie-react-hooks | 4.2.2-beta.2 | React integration | When building React UI components that need live query updates |
| onnxruntime-common | 1.24.2 | Shared ONNX types | Required alongside onnxruntime-web |

### Model Assets

| Model | Source | Dimensions | Purpose |
|-------|--------|------------|---------|
| all-MiniLM-L6-v2 | Xenova/all-MiniLM-L6-v2 | 384-dim embeddings | Sentence embeddings for semantic search and similarity |

## Detailed Configuration

### Transformers.js Configuration

```javascript
import { env, pipeline } from '@huggingface/transformers';

// Configure WASM file paths (critical for self-hosting)
env.backends.onnx.wasm.wasmPaths = '/path/to/onnx-wasm-files/';

// Disable remote model loading for offline/air-gapped use
env.allowRemoteModels = false;
env.localModelPath = '/models/';

// Create feature extraction pipeline
const extractor = await pipeline(
  'feature-extraction',
  'Xenova/all-MiniLM-L6-v2',
  {
    device: 'wasm',        // 'wasm' (CPU), 'webgpu' (GPU), or 'cpu' (alias for wasm)
    dtype: 'q8',           // 'fp32', 'fp16', 'q8' (default for WASM), 'q4'
    pooling: 'mean',       // Pooling strategy for embeddings
    normalize: true,       // L2 normalize embeddings
  }
);
```

### ONNX Runtime Web WASM Configuration

```javascript
import * as ort from 'onnxruntime-web';

// Thread configuration
ort.env.wasm.numThreads = 0;  // 0 = auto, 1 = disable multi-threading

// Proxy worker for UI responsiveness
ort.env.wasm.proxy = true;    // Offloads computation to worker thread

// WASM path configuration (two patterns)
// Pattern 1: String prefix
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.2/dist/';

// Pattern 2: Object mapping
ort.env.wasm.wasmPaths = {
  'ort-wasm-simd.wasm': '/custom/path/ort-wasm-simd.wasm',
  'ort-wasm-simd-threaded.wasm': '/custom/path/ort-wasm-simd-threaded.wasm'
};
```

**CRITICAL:** JavaScript bundle and WebAssembly binary files must be from the same ONNX Runtime build.

### Dexie.js Configuration

```javascript
import Dexie from 'dexie';

const db = new Dexie('LokulMindDB');

db.version(1).stores({
  memories: '++id, timestamp, *tags, [type+timestamp]',
  embeddings: '++id, memoryId, model',
  vectors: '&id, vector'  // & = unique index for vector lookup
});

// Bulk operations for performance
await db.memories.bulkAdd([
  { text: '...', timestamp: Date.now() },
  { text: '...', timestamp: Date.now() }
]);

// Live queries with React hooks
import { useLiveQuery } from 'dexie-react-hooks';
const memories = useLiveQuery(() => db.memories.toArray());
```

### Vite Library Mode Configuration

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'LokulMind',
      fileName: 'lokul-mind',
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      // Mark dependencies as external for library builds
      external: ['@huggingface/transformers', 'dexie'],
      output: {
        globals: {
          '@huggingface/transformers': 'transformers',
          'dexie': 'Dexie'
        }
      }
    }
  },
  worker: {
    format: 'es',  // Use ES modules for workers
  }
});
```

### Web Worker Pattern in Vite

```javascript
// Pattern 1: Constructor with URL (recommended)
const worker = new Worker(
  new URL('./ml-worker.js', import.meta.url),
  { type: 'module' }
);

// Pattern 2: Query suffixes
import Worker from './worker.js?worker';
const worker = new Worker();

// Pattern 3: Inline as base64 (no separate file)
import InlineWorker from './worker.js?worker&inline';
```

**Important:** Worker detection only works if `new URL()` constructor is used directly inside `new Worker()` declaration.

## MiniLM-L6-v2 Specifications

| Attribute | Value |
|-----------|-------|
| **Model ID** | Xenova/all-MiniLM-L6-v2 |
| **Base Model** | sentence-transformers/all-MiniLM-L6-v2 |
| **Architecture** | MiniLM (BERT-based) |
| **Embedding Dimensions** | 384 |
| **Output Shape** | `[batch_size, 384]` |
| **License** | Apache 2.0 |
| **Format** | ONNX (quantized available) |

### Recommended Configuration for Browser

```javascript
const extractor = await pipeline(
  'feature-extraction',
  'Xenova/all-MiniLM-L6-v2',
  {
    dtype: 'q8',      // 8-bit quantization for WASM (default)
    pooling: 'mean',  // Mean pooling for sentence embeddings
    normalize: true,  // L2 normalize for cosine similarity
  }
);

// Compute embeddings
const output = await extractor('Text to embed', {
  pooling: 'mean',
  normalize: true
});
// Result: Tensor { dims: [1, 384], type: 'float32' }
```

## Installation

```bash
# Core dependencies
npm install @huggingface/transformers@3.8.1
npm install dexie@4.3.0

# Dev dependencies
npm install -D vite@6.2.0

# Optional React integration
npm install dexie-react-hooks@4.2.2-beta.2
```

## Alternatives Considered

| Category | Recommended | Alternative | When to Use Alternative |
|----------|-------------|-------------|-------------------------|
| ML Framework | Transformers.js | TensorFlow.js | Use TF.js if you need custom model training in browser or have existing TF models |
| ML Framework | Transformers.js | ONNX Runtime Web (direct) | Use direct ONNX Runtime if you have custom ONNX models not available via Hugging Face |
| Database | Dexie.js | idb (npm package) | Use idb if you need lower-level IndexedDB access with smaller bundle size |
| Database | Dexie.js | localForage | Use localForage only if you need simple key-value storage without indexing |
| Build Tool | Vite | Rollup | Use Rollup directly if you need more granular control over bundling |
| Build Tool | Vite | Webpack 5 | Use Webpack if you have complex existing configuration or need Module Federation |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Transformers.js v2.x | Deprecated API, significant breaking changes from v3 | Transformers.js 3.8.1+ |
| @xenova/transformers | Old package name, migrated to @huggingface/transformers | @huggingface/transformers |
| TensorFlow.js for embeddings | Larger bundle size, slower inference for transformer models | Transformers.js with MiniLM |
| LocalStorage for embeddings | 5MB limit, no indexing, blocking operations | IndexedDB via Dexie.js |
| Webpack 4 for web workers | Complex worker-loader configuration, outdated | Vite with native worker support |
| Unquantized models (fp32) | 4x memory usage, slower inference on WASM | Quantized models (q8 or q4) |
| WebGL backend | Deprecated in ONNX Runtime, use WebGPU or WASM | WASM (default) or WebGPU |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| @huggingface/transformers@3.8.1 | onnxruntime-web@1.24.x | Uses bundled ONNX Runtime, but external version can be configured |
| @huggingface/transformers@4.0.0-next.4 | onnxruntime-web@1.24.x | Next version with experimental features |
| dexie@4.3.0 | dexie-react-hooks@4.2.x | React 18+ recommended |
| vite@6.x | Node.js 18+ | Requires Node 18 or higher |

## WASM Pathing Strategies

### Strategy 1: CDN (Default)

```javascript
// Uses jsdelivr CDN by default
// No configuration needed
```

### Strategy 2: Self-Hosted (Recommended for Production)

```javascript
// Copy WASM files from node_modules/onnxruntime-web/dist to public folder
// Configure paths:
env.backends.onnx.wasm.wasmPaths = '/onnx-wasm/';
```

### Strategy 3: Custom CDN

```javascript
env.backends.onnx.wasm.wasmPaths = 'https://your-cdn.com/onnxruntime-web@1.24.2/dist/';
```

### Strategy 4: Per-File Mapping

```javascript
env.backends.onnx.wasm.wasmPaths = {
  'ort-wasm-simd.wasm': '/wasm/ort-wasm-simd.wasm',
  'ort-wasm-simd-threaded.wasm': '/wasm/ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.jsep.wasm': '/wasm/ort-wasm-simd-threaded.jsep.wasm'
};
```

## Cross-Origin Isolation Requirements

For multi-threaded WASM (numThreads > 1), serve with these headers:

```http
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

Vite dev server configuration:

```javascript
// vite.config.js
export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  }
});
```

## Sources

- [Transformers.js GitHub](https://github.com/huggingface/transformers.js) - Version 3.8.1/4.0.0-next.4, installation and configuration
- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js) - Pipeline API, model support, device configuration
- [ONNX Runtime Web Documentation](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html) - WASM configuration options
- [ONNX Runtime GitHub Releases](https://github.com/microsoft/onnxruntime/releases) - Version 1.24.2 release notes
- [Dexie.js GitHub Releases](https://github.com/dexie/Dexie.js/releases) - Version 4.3.0 features
- [Dexie.js Documentation](https://dexie.org/docs/) - IndexedDB API and bulk operations
- [Vite Build Documentation](https://vite.dev/guide/build.html) - Library mode configuration
- [Vite Features Documentation](https://vite.dev/guide/features.html) - Web worker patterns
- [MiniLM-L6-v2 on Hugging Face](https://huggingface.co/Xenova/all-MiniLM-L6-v2) - Model specifications and usage

---
*Stack research for: Browser-Native ML Memory Systems*
*Researched: 2026-02-23*
