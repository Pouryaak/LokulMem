# Architecture Patterns

**Domain:** Browser-native ML memory systems
**Researched:** 2026-02-23
**Confidence:** HIGH

## Recommended Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MAIN THREAD (UI)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   augment()  │  │   learn()    │  │   manage()   │  │  Event Bus   │    │
│  │    API       │  │    API       │  │    API       │  │  (pub/sub)   │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                 │            │
│         └─────────────────┴─────────────────┴─────────────────┘            │
│                                    │                                        │
│                           ┌────────▼────────┐                              │
│                           │   MemoryClient  │                              │
│                           │   (DTO Adapter) │                              │
│                           └────────┬────────┘                              │
├────────────────────────────────────┼────────────────────────────────────────┤
│                         SHARED WORKER LAYER                                  │
├────────────────────────────────────┼────────────────────────────────────────┤
│                           ┌────────▼────────┐                              │
│                           │   MemoryHub     │                              │
│                           │  (Coordinator)  │                              │
│                           └────────┬────────┘                              │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────┐            │
│         │                          │                          │            │
│  ┌──────▼──────┐          ┌────────▼────────┐        ┌────────▼────────┐  │
│  │  Embedding  │          │   MemoryStore   │        │   Lifecycle     │  │
│  │   Engine    │          │   (Repository)  │        │   Manager       │  │
│  │             │          │                 │        │                 │  │
│  │ • Transformers.js     │ • CRUD ops      │        │ • Decay calc    │  │
│  │ • LRU cache           │ • Vector search │        │ • Contradiction │  │
│  │ • Batch queue         │ • Index mgmt    │        │ • Consolidation │  │
│  └──────┬──────┘          └────────┬────────┘        └─────────────────┘  │
│         │                          │                                        │
├─────────┼──────────────────────────┼────────────────────────────────────────┤
│         │                    INDEXEDDB LAYER                               │
├─────────┼──────────────────────────┼────────────────────────────────────────┤
│  ┌──────▼──────┐          ┌────────▼────────┐                              │
│  │   Cache     │          │   Dexie.js      │                              │
│  │   Storage   │          │   Database      │                              │
│  │  (Models)   │          │                 │                              │
│  └─────────────┘          │ • memories      │                              │
│                           │ • episodes      │                              │
│                           │ • edges         │                              │
│                           │ • clusters      │                              │
│                           └─────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **MemoryClient** (main thread) | Public API adapter, DTO serialization, event handling | MemoryHub via SharedWorker port |
| **MemoryHub** (SharedWorker) | Connection coordinator, message routing, multi-tab sync | All worker modules, all connected tabs |
| **EmbeddingEngine** | Model loading, text embedding, LRU caching | MemoryHub, CacheStorage |
| **MemoryStore** | Vector search, CRUD operations, index management | MemoryHub, Dexie.js |
| **LifecycleManager** | Decay calculation, contradiction detection, consolidation | MemoryHub, MemoryStore |
| **Dexie.js Layer** | IndexedDB abstraction, schema management, transactions | MemoryStore |

### Data Flow

#### 1. Memory Retrieval Flow (`augment()`)

```
User Query
    ↓
MemoryClient.augment(query, tokenBudget)
    ↓
SharedWorker: MemoryHub.route('RETRIEVE', ...)
    ↓
EmbeddingEngine.embed(query) → Float32Array[384]
    ↓
MemoryStore.vectorSearch(embedding, topK)
    ├─→ Dexie: Read all memory embeddings
    ├─→ Compute cosine similarity (brute-force)
    ├─→ Apply R(m,q) composite scoring
    └─→ Return ranked memory IDs
    ↓
MemoryStore.fetchByIds(ids) → MemoryDTO[]
    ↓
MemoryHub: Format response (strip embeddings)
    ↓
MemoryClient: Return { messages: [...], debug: {...} }
```

#### 2. Learning Flow (`learn()`)

```
Conversation History
    ↓
MemoryClient.learn(exchanges)
    ↓
SharedWorker: MemoryHub.route('LEARN', ...)
    ↓
Extraction Layer (per fact):
    ├─→ Compute E(s) = novelty × specificity × recurrence
    ├─→ Filter: E(s) ≥ threshold
    └─→ Check contradictions with existing memories
    ↓
EmbeddingEngine.embed(facts)
    ↓
MemoryStore.insert(memories)
    ├─→ Dexie: memories.put()
    ├─→ Dexie: episodes.add()
    └─→ Update edges/clusters if needed
    ↓
MemoryHub: Emit 'memories:added' event
    ↓
MemoryClient: Return { added: count, contradictions: [] }
```

#### 3. Lifecycle Management Flow (Background)

```
Scheduled/Triggered
    ↓
LifecycleManager.runMaintenance()
    ├─→ Query memories due for decay
    ├─→ Apply Ebbinghaus: S = e^(-λt)
    ├─→ Identify contradictions (temporal + typed attrs)
    ├─→ Flag low-S memories for review
    └─→ Consolidate clusters if needed
    ↓
MemoryHub: Emit lifecycle events
    ↓
Connected tabs receive updates via broadcast
```

## Patterns to Follow

### Pattern 1: DTO Pattern for IPC

**What:** Exclude embeddings from cross-boundary data transfer. Embeddings stay internal to the worker layer.

**When:** Always — Float32Arrays don't serialize well across Worker boundaries and cause unnecessary memory overhead.

**Trade-offs:** Slightly more complex mapping layer, but prevents IPC bottlenecks and memory bloat.

**Example:**
```typescript
// Internal representation (worker only)
interface Memory {
  id: string;
  content: string;
  embedding: Float32Array;  // 384 floats = ~1.5KB per memory
  metadata: MemoryMetadata;
}

// DTO for public API (crosses boundaries)
interface MemoryDTO {
  id: string;
  content: string;
  metadata: MemoryMetadata;
  // embedding intentionally omitted
}

// Adapter function
function toDTO(memory: Memory): MemoryDTO {
  const { embedding, ...dto } = memory;
  return dto;
}
```

### Pattern 2: SharedWorker with Port-Based Messaging

**What:** Use SharedWorker for multi-tab model sharing, with explicit MessagePort handling.

**When:** When the same ML model should be shared across browser tabs to avoid redundant downloads and memory usage.

**Trade-offs:** More complex connection handling than DedicatedWorker, but enables true multi-tab synchronization.

**Example:**
```typescript
// Main thread connection
const worker = new SharedWorker('/workers/memory-hub.js');
const port = worker.port;
port.start();  // Required when using addEventListener

port.postMessage({ type: 'CONNECT', clientId });
port.onmessage = (e) => {
  if (e.data.type === 'BROADCAST') {
    // Handle cross-tab updates
  }
};

// Worker-side connection handling
onconnect = (e) => {
  const port = e.ports[0];
  ports.add(port);

  port.onmessage = (e) => {
    // Route to appropriate handler
    const response = handleMessage(e.data);
    port.postMessage(response);
  };

  port.start();
};
```

### Pattern 3: LRU Cache for Embeddings

**What:** Cache computed embeddings in memory with LRU eviction to avoid recomputing frequent queries.

**When:** When embedding computation is expensive and query patterns show temporal locality.

**Trade-offs:** Uses additional memory, but significantly reduces latency for repeated queries.

**Example:**
```typescript
class EmbeddingCache {
  private cache = new Map<string, Float32Array>();
  private accessOrder: string[] = [];
  private maxSize = 100;

  get(key: string): Float32Array | undefined {
    if (this.cache.has(key)) {
      // Move to end (most recently used)
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.accessOrder.push(key);
      return this.cache.get(key);
    }
    return undefined;
  }

  set(key: string, value: Float32Array): void {
    if (this.cache.size >= this.maxSize) {
      const lru = this.accessOrder.shift();
      if (lru) this.cache.delete(lru);
    }
    this.cache.set(key, value);
    this.accessOrder.push(key);
  }
}
```

### Pattern 4: Transaction-Scoped IndexedDB Operations

**What:** Group related database operations into Dexie transactions for atomicity and consistency.

**When:** Any operation that modifies multiple related records (e.g., adding a memory + updating episode + creating edges).

**Trade-offs:** Locks the object stores involved, but ensures data integrity.

**Example:**
```typescript
await db.transaction('rw', db.memories, db.episodes, db.edges, async () => {
  const memoryId = await db.memories.add(memory);
  await db.episodes.add({ memoryId, timestamp: Date.now() });
  for (const relatedId of relatedIds) {
    await db.edges.add({ source: memoryId, target: relatedId });
  }
});
```

### Pattern 5: Brute-Force Vector Search with Early Exit

**What:** For N ≤ 3,000, compute all similarities and sort rather than using HNSW or other approximate indices.

**When:** Dataset size is small enough that O(N) scan is acceptable (under ~30ms target).

**Trade-offs:** Simpler implementation, no index maintenance, but doesn't scale beyond ~10K items.

**Example:**
```typescript
async function vectorSearch(
  query: Float32Array,
  topK: number,
  threshold: number
): Promise<ScoredMemory[]> {
  const memories = await db.memories.toArray();

  const scored = memories.map(m => ({
    id: m.id,
    score: cosineSimilarity(query, m.embedding) * m.strength,
  }));

  return scored
    .filter(s => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Synchronous Model Loading

**What:** Blocking the main thread while downloading 22MB of model weights.

**Why bad:** Freezes UI, poor user experience, may trigger browser "page unresponsive" warnings.

**Instead:** Load models in SharedWorker with progress callbacks, cache in CacheStorage.

### Anti-Pattern 2: Embedding in Main Thread

**What:** Running Transformers.js inference directly in the main thread.

**Why bad:** Model inference blocks UI rendering; even quantized models can cause jank.

**Instead:** Always run embedding in a Worker. Use postMessage with Transferable objects for large arrays.

### Anti-Pattern 3: Storing Raw Float32Arrays in IndexedDB

**What:** Directly storing Float32Array objects in IndexedDB without consideration.

**Why bad:** IndexedDB uses structured clone; while it supports typed arrays, serialization overhead can be significant.

**Instead:** For export, serialize Float32Arrays to Base64. For storage, Dexie handles typed arrays efficiently.

### Anti-Pattern 4: No Fallback for SharedWorker

**What:** Assuming SharedWorker is available in all browsers.

**Why bad:** Safari had limited SharedWorker support historically; some mobile browsers don't support it.

**Instead:** Implement graceful fallback to DedicatedWorker or main-thread execution with feature detection.

```typescript
function createWorker(): SharedWorker | Worker {
  if (typeof SharedWorker !== 'undefined') {
    return new SharedWorker('/workers/memory-hub.js');
  }
  return new Worker('/workers/memory-fallback.js');
}
```

## Scalability Considerations

| Scale | Memories | Architecture Adjustments |
|-------|----------|--------------------------|
| 0-100 | N ≤ 100 | Brute-force search, no optimization needed |
| 100-1K | N ≤ 1,000 | Add LRU cache for embeddings, batch operations |
| 1K-3K | N ≤ 3,000 | Current target; monitor retrieval latency |
| 3K-10K | N ≤ 10,000 | Consider HNSW index, memory pressure monitoring |
| 10K+ | N > 10,000 | Requires HNSW or IVF index, likely out of scope for v0.1 |

### Scaling Priorities

1. **First bottleneck:** Embedding computation latency
   - Mitigation: LRU cache, batch processing, model quantization

2. **Second bottleneck:** Vector search O(N) complexity
   - Mitigation: HNSW index (deferred to v0.2), memory tiering

3. **Third bottleneck:** IndexedDB storage limits
   - Mitigation: Compression, eviction policies, export/import workflows

## Build Order Implications

Based on component dependencies, recommended build order:

1. **Dexie.js Schema** (foundation)
   - No dependencies
   - Required by: MemoryStore

2. **DTO Types** (contracts)
   - No dependencies
   - Required by: All components

3. **EmbeddingEngine** (core capability)
   - Depends on: CacheStorage
   - Required by: MemoryHub

4. **MemoryStore** (data access)
   - Depends on: Dexie.js schema
   - Required by: MemoryHub

5. **LifecycleManager** (business logic)
   - Depends on: MemoryStore
   - Required by: MemoryHub

6. **MemoryHub** (orchestration)
   - Depends on: EmbeddingEngine, MemoryStore, LifecycleManager
   - Required by: MemoryClient

7. **MemoryClient** (public API)
   - Depends on: DTO types, MemoryHub
   - Required by: Demo app

## Sources

- [MDN: SharedWorker](https://developer.mozilla.org/en-US/docs/Web/API/SharedWorker) — HIGH confidence
- [MDN: IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) — HIGH confidence
- [MDN: Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) — HIGH confidence
- [MDN: CacheStorage](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage) — HIGH confidence
- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js) — HIGH confidence
- [Transformers.js Examples](https://github.com/huggingface/transformers.js-examples) — HIGH confidence
- [Dexie.js GitHub](https://github.com/dexie/Dexie.js) — MEDIUM confidence

---
*Architecture research for: LokulMem browser-native ML memory system*
*Researched: 2026-02-23*
