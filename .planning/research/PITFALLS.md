# Domain Pitfalls: Browser-Native ML Memory Systems

**Domain:** Browser-native ML memory management (LokulMem)
**Researched:** 2026-02-23
**Confidence:** MEDIUM (based on official docs, GitHub issues, and ecosystem patterns)

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Float32Array Serialization in Worker Communication

**What goes wrong:**
Attempting to pass Float32Array embeddings directly through postMessage to/from workers causes silent failures or performance degradation. The underlying ArrayBuffer becomes detached after transfer, or structured cloning duplicates large memory blocks unnecessarily.

**Why it happens:**
- Developers assume TypedArrays serialize like regular objects
- Confusion between `transfer` (moves memory) vs `clone` (copies memory)
- Passing the TypedArray view instead of `.buffer` to transfer list

**Consequences:**
- Embeddings become zero-length arrays in receiving context
- Memory usage doubles during IPC
- Silent data loss in memory storage

**Prevention:**
```typescript
// WRONG: Attempting to use transferred buffer
worker.postMessage({ embedding: floatArray }, [floatArray]);
// floatArray is now detached, unusable

// WRONG: Structured clone duplicates 384-dim * 4 bytes * N memories
worker.postMessage({ embedding: floatArray }); // Copies everything

// CORRECT: Transfer only when sender no longer needs data
worker.postMessage(
  { embedding: floatArray },
  [floatArray.buffer] // Transfer underlying buffer
);

// CORRECT: For DTO pattern (no embeddings in API), compute in worker
// Only send scalar scores and memory metadata to main thread
```

**Detection:**
- Unit tests showing embeddings with `byteLength: 0`
- Memory profiling showing unexpected duplication
- Memories retrieved with zero similarity scores

**Phase to address:** Phase 1 (Worker Infrastructure)

---

### Pitfall 2: SharedWorker Port Lifecycle Management

**What goes wrong:**
SharedWorker connections fail silently in multi-tab scenarios. Messages sent before `port.start()` or to disconnected ports disappear without error.

**Why it happens:**
- `addEventListener` requires explicit `port.start()` but `onmessage` does not
- Port connections don't auto-reconnect on worker restart
- Safari private browsing blocks SharedWorker entirely

**Consequences:**
- Second tab appears to "lose" memory system
- No error thrown, just silent message loss
- Inconsistent state across tabs

**Prevention:**
```typescript
// WRONG: Using addEventListener without start()
worker.port.addEventListener('message', handler);
worker.port.postMessage('init'); // Never arrives!

// CORRECT: Always use onmessage or explicit start
worker.port.onmessage = handler; // Auto-starts
// OR
worker.port.addEventListener('message', handler);
worker.port.start(); // Required!

// CORRECT: Feature detection with fallback
function createWorker() {
  if (typeof SharedWorker !== 'undefined') {
    try {
      return new SharedWorker('memory-worker.js');
    } catch (e) {
      console.warn('SharedWorker failed, falling back to Worker');
    }
  }
  return new Worker('memory-worker.js');
}
```

**Detection:**
- Tab synchronization tests failing
- Message timeouts in multi-tab scenarios
- Safari-specific bug reports

**Phase to address:** Phase 1 (Worker Infrastructure)

---

### Pitfall 3: IndexedDB Transaction Auto-Commit Timing

**What goes wrong:**
Transactions commit unexpectedly between async operations, causing "Transaction inactive" errors on subsequent operations.

**Why it happens:**
- IndexedDB transactions auto-commit when the event loop clears
- `await` within transaction scope allows auto-commit
- Dexie.js bulk operations have their own transaction scope

**Consequences:**
- Partial writes (data corruption)
- Silent failures in memory storage
- Inconsistent memory state

**Prevention:**
```typescript
// WRONG: Async gap allows auto-commit
await db.transaction('rw', db.memories, async () => {
  await someAsyncValidation(); // Transaction commits here!
  await db.memories.put(memory); // Fails - transaction closed
});

// CORRECT: Keep all operations synchronous within transaction
db.transaction('rw', db.memories, () => {
  db.memories.put(memory1);
  db.memories.put(memory2);
  // Commits automatically when complete
});

// CORRECT: For Dexie bulk operations, let it manage transaction
await db.memories.bulkPut(memories); // Own transaction

// CORRECT: If async needed, use Dexie's transaction() helper
await db.transaction('rw', db.memories, async (tx) => {
  // Dexie keeps transaction alive across awaits
  const existing = await db.memories.get(id);
  if (!existing) {
    await db.memories.add(memory);
  }
});
```

**Detection:**
- "TransactionInactiveError" in console
- Missing records after batch operations
- Intermittent test failures

**Phase to address:** Phase 2 (Dexie.js Schema)

---

### Pitfall 4: Model Loading Memory Exhaustion

**What goes wrong:**
Loading multiple models or reloading models on every session causes browser to hit memory limits, especially on mobile.

**Why it happens:**
- MiniLM-L6-v2 is ~22MB quantized
- Transformers.js keeps models in memory by default
- No explicit model disposal between sessions

**Consequences:**
- Browser crashes on mobile (Safari especially)
- Out-of-memory errors
- Slow subsequent page loads

**Prevention:**
```typescript
// WRONG: Loading model every session without disposal
const extractor = await pipeline('feature-extraction', modelId);

// CORRECT: Use singleton pattern with proper disposal
class EmbeddingEngine {
  private extractor: any = null;

  async getExtractor() {
    if (!this.extractor) {
      this.extractor = await pipeline('feature-extraction', modelId, {
        dtype: 'q8', // Quantized to reduce memory
        device: 'wasm' // Fallback from WebGPU
      });
    }
    return this.extractor;
  }

  dispose() {
    if (this.extractor) {
      this.extractor.dispose();
      this.extractor = null;
    }
  }
}

// CORRECT: Configure caching to prevent reloads
import { env } from '@huggingface/transformers';
env.useBrowserCache = true;
env.cacheDir = './.cache';
```

**Detection:**
- Performance profiling showing increasing memory
- Safari mobile crashes
- "Aw snap" errors in Chrome

**Phase to address:** Phase 3 (Embedding Engine)

---

### Pitfall 5: Brute-Force Search Performance Cliff

**What goes wrong:**
O(N) brute-force vector search becomes unusable as memory count grows, causing UI freezing during retrieval.

**Why it happens:**
- 3,000 memories * 384 dims * 4 bytes = ~4.6MB per similarity computation
- Cosine similarity in JavaScript is CPU-intensive
- No early termination or indexing

**Consequences:**
- Retrieval takes >30ms target at ~2,000 memories
- Main thread blocking causes UI jank
- User perceives app as slow

**Prevention:**
```typescript
// WRONG: Loading all memories into memory for search
const allMemories = await db.memories.toArray(); // Loads everything!
const results = allMemories.map(m => ({
  ...m,
  score: cosineSimilarity(query, m.embedding)
})).sort((a, b) => b.score - a.score).slice(0, k);

// CORRECT: Use cursor-based iteration with early termination
async function* memoryStream() {
  yield* db.memories.iterate();
}

// CORRECT: Implement progressive threshold filtering
const results: Memory[] = [];
let minScore = 0;

await db.memories.each(memory => {
  const score = cosineSimilarity(query, memory.embedding);
  if (score > minScore) {
    insertSorted(results, { memory, score }, k);
    minScore = results[results.length - 1]?.score ?? 0;
  }
});

// CORRECT: Plan for HNSW in v0.2 (deferred per PROJECT.md)
// Document the 3,000 memory limit clearly
```

**Detection:**
- Retrieval latency >30ms in benchmarks
- Frame drops in React demo app
- Memory usage spikes during search

**Phase to address:** Phase 4 (Retrieval System) - with v0.2 HNSW upgrade

---

### Pitfall 6: Ebbinghaus Decay Implementation Errors

**What goes wrong:**
Memory decay calculations produce incorrect retention values, causing memories to decay too fast or never decay.

**Why it happens:**
- Confusion between elapsed time units (ms vs days)
- Integer division instead of float
- Missing boundary condition at t=0

**Consequences:**
- Important memories disappear too quickly
- Or: Memory store grows unbounded
- User loses trust in system

**Prevention:**
```typescript
// WRONG: Integer division, wrong time units
const retention = Math.exp(-lambda * (Date.now() - lastAccess) / 86400);

// WRONG: Missing initial strength factor
function calculateR(memory: Memory) {
  return Math.exp(-lambda * getAge(memory));
}

// CORRECT: Proper Ebbinghaus with configurable lambda
interface DecayConfig {
  lambda: number; // Decay constant (e.g., 0.1 for facts)
  baseStrength: number; // Initial memory strength
}

function calculateRetention(
  memory: Memory,
  config: DecayConfig
): number {
  const ageInDays = (Date.now() - memory.lastAccessed) / (1000 * 60 * 60 * 24);
  // R = e^(-λt/S) where S is memory strength
  const strength = config.baseStrength * (1 + memory.repetitions * 0.1);
  return Math.exp(-config.lambda * ageInDays / strength);
}

// CORRECT: Per-category lambda values per PROJECT.md
const CATEGORY_LAMBDA = {
  fact: 0.1,
  preference: 0.05,
  goal: 0.02
};
```

**Detection:**
- Unit tests with known decay curves failing
- Memory count not decreasing over time
- User complaints about "forgetting" important facts

**Phase to address:** Phase 5 (Decay System)

---

### Pitfall 7: Contradiction Detection False Positives

**What goes wrong:**
Legitimate memory updates are rejected as "contradictions," or actual contradictions are missed due to weak detection.

**Why it happens:**
- String matching too strict ("lives in NYC" vs "lives in New York")
- Missing temporal marker parsing
- No confidence threshold tuning

**Consequences:**
- Stale information retained
- New correct information rejected
- User frustration at outdated responses

**Prevention:**
```typescript
// WRONG: Exact string matching
function isContradiction(old: string, new_: string) {
  return old !== new_; // Too strict!
}

// CORRECT: Typed attribute extraction with temporal markers
interface ExtractedFact {
  entity: string;
  attribute: string;
  value: string;
  temporalMarker?: 'past' | 'present' | 'future' | Date;
  confidence: number;
}

function detectContradiction(
  existing: ExtractedFact,
  candidate: ExtractedFact
): boolean {
  // Same entity and attribute
  if (existing.entity !== candidate.entity) return false;
  if (existing.attribute !== candidate.attribute) return false;

  // Check temporal context
  if (existing.temporalMarker === 'past' &&
      candidate.temporalMarker === 'present') {
    return false; // Not a contradiction - life stages
  }

  // Value similarity below threshold
  const similarity = jaccardSimilarity(existing.value, candidate.value);
  return similarity < 0.3; // Configurable threshold
}

// CORRECT: Normalize values before comparison
function normalizeValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bnyc\b/g, 'new york city')
    .replace(/\bny\b/g, 'new york')
    .replace(/[^a-z0-9\s]/g, '');
}
```

**Detection:**
- Integration tests showing rejected valid updates
- User reports of outdated information
- Contradiction logs showing high false positive rate

**Phase to address:** Phase 6 (Contradiction Resolution)

---

## Moderate Pitfalls

### Pitfall: WebGPU Fallback Handling

**What goes wrong:**
App fails entirely when WebGPU is unavailable instead of gracefully falling back to WASM.

**Prevention:**
```typescript
// CORRECT: Always provide device fallback
const extractor = await pipeline('feature-extraction', modelId, {
  device: 'webgpu', // Tries WebGPU first
  // Falls back to WASM automatically per Transformers.js behavior
});

// CORRECT: Explicit feature detection
async function getOptimalDevice(): Promise<'webgpu' | 'wasm'> {
  if (typeof navigator.gpu !== 'undefined') {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) return 'webgpu';
    } catch { /* fallthrough */ }
  }
  return 'wasm';
}
```

**Phase to address:** Phase 3 (Embedding Engine)

---

### Pitfall: IndexedDB Storage Quota Exceeded

**What goes wrong:**
Browser evicts IndexedDB data when storage limits reached, losing all memories.

**Prevention:**
```typescript
// CORRECT: Monitor storage usage
async function checkStorage() {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || Infinity;
    const percentUsed = (usage / quota) * 100;

    if (percentUsed > 80) {
      // Trigger aggressive decay or warn user
      await runGarbageCollection();
    }
  }
}

// CORRECT: Export functionality for user backup
// (Already in PROJECT.md requirements)
```

**Phase to address:** Phase 2 (Dexie.js Schema)

---

### Pitfall: DTO Pattern Violations

**What goes wrong:**
Embeddings accidentally leak into public API responses, causing serialization errors or huge payloads.

**Prevention:**
```typescript
// CORRECT: Explicit DTO type excludes embedding
interface MemoryDTO {
  id: string;
  content: string;
  category: string;
  confidence: number;
  createdAt: Date;
  lastAccessed: Date;
  // NO embedding field!
}

interface InternalMemory extends MemoryDTO {
  embedding: Float32Array; // Internal only
}

// CORRECT: Explicit conversion function
function toDTO(internal: InternalMemory): MemoryDTO {
  const { embedding, ...dto } = internal;
  return dto;
}
```

**Phase to address:** Phase 1 (Worker Infrastructure)

---

## Minor Pitfalls

### Pitfall: Base64 Float32Array Export/Import

**What goes wrong:**
JSON export of Float32Arrays to Base64 introduces precision loss or endianness issues.

**Prevention:**
```typescript
// CORRECT: Explicit little-endian conversion
function float32ToBase64(arr: Float32Array): string {
  const littleEndian = new Uint8Array(arr.buffer);
  // Always use little-endian for consistency
  return btoa(String.fromCharCode(...littleEndian));
}

function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Float32Array(bytes.buffer);
}
```

**Phase to address:** Phase 7 (Manage API)

---

### Pitfall: Cache Poisoning with Model Updates

**What goes wrong:**
Updating Transformers.js version causes stale cached models to be used, leading to incompatibility errors.

**Prevention:**
```typescript
// CORRECT: Version-scoped cache key
import { env } from '@huggingface/transformers';
const VERSION = '0.1.0'; // LokulMem version
env.cacheKey = `lokulmem-${VERSION}`;

// CORRECT: Clear cache on major version updates
async function clearModelCache() {
  const cache = await caches.open(env.cacheKey);
  await cache.keys().then(keys => {
    return Promise.all(keys.map(key => cache.delete(key)));
  });
}
```

**Phase to address:** Phase 3 (Embedding Engine)

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| 1. Worker Infrastructure | SharedWorker port not started | Always use `onmessage` or call `port.start()` |
| 1. Worker Infrastructure | Float32Array transfer confusion | Transfer `.buffer`, not the TypedArray view |
| 2. Dexie.js Schema | Missing compound indexes for queries | Design indexes based on query patterns upfront |
| 2. Dexie.js Schema | Transaction auto-commit gaps | Avoid async gaps in explicit transactions |
| 3. Embedding Engine | Model loaded multiple times | Implement singleton with dispose pattern |
| 3. Embedding Engine | WebGPU assumed available | Always provide WASM fallback |
| 4. Retrieval System | Brute-force O(N) slowdown | Document 3,000 memory limit; plan HNSW v0.2 |
| 5. Decay System | Time unit confusion (ms vs days) | Use explicit Date objects and day conversion |
| 6. Contradiction | String matching too strict | Use typed attributes with normalization |
| 7. Manage API | Embeddings in DTO responses | Explicit DTO type excludes embedding field |
| 8. React Demo | Memory leaks in useEffect | Proper cleanup of workers and subscriptions |

---

## "Looks Done But Isn't" Checklist

- [ ] **Worker fallback:** SharedWorker tested in Safari private mode
- [ ] **Float32Array IPC:** Verified embeddings not detached after transfer
- [ ] **Transaction safety:** Bulk operations wrapped in proper transactions
- [ ] **Model disposal:** Cleanup function called on app unmount
- [ ] **Decay math:** Unit tests verify known retention curves
- [ ] **Contradiction:** False positive rate <10% in test corpus
- [ ] **Storage limits:** Warning shown at 80% quota
- [ ] **DTO boundary:** No Float32Array in any public API response
- [ ] **WebGPU fallback:** App works in Firefox without flags
- [ ] **Multi-tab sync:** Changes in tab A visible in tab B within 1 second

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Float32Array detachment | LOW | Reload from IndexedDB; re-embed if needed |
| Transaction failure | LOW | Retry with exponential backoff |
| Model OOM | MEDIUM | Dispose and reload with quantization |
| Search performance | MEDIUM | Implement pagination; defer to v0.2 HNSW |
| Decay calculation error | HIGH | Recalculate all retention values; may need user notification |
| Contradiction false positive | MEDIUM | Manual review queue; adjust thresholds |
| Storage eviction | HIGH | Restore from user export; no automatic recovery |

---

## Sources

- [MDN Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) - Worker lifecycle and port management
- [MDN IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) - Transaction behavior and storage limits
- [MDN structuredClone](https://developer.mozilla.org/en-US/docs/Web/API/structuredClone) - TypedArray serialization
- [Transformers.js WebGPU Guide](https://huggingface.co/docs/transformers.js/guides/webgpu) - Device configuration
- [Transformers.js dtypes Guide](https://huggingface.co/docs/transformers.js/guides/dtypes) - Quantization options
- [Transformers.js env API](https://huggingface.co/docs/transformers.js/api/env) - Cache configuration
- [ONNX Runtime Web Docs](https://onnxruntime.ai/docs/tutorials/web/) - Memory management guidance
- [Dexie.js Migration Guide](https://dexie.org/docs/Tutorial/Migrating-existing-DB-to-Dexie) - Schema design pitfalls
- [Mem0 GitHub Issues](https://github.com/mem0ai/mem0/issues) - Real-world memory system bugs
- [ONNX Runtime Web Memory](https://onnxruntime.ai/docs/tutorials/web/) - Large model handling

---

*Pitfalls research for: LokulMem browser-native ML memory system*
*Researched: 2026-02-23*
*Confidence: MEDIUM (official docs verified; some patterns from training data)*
