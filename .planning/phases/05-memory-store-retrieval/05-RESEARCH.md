# Phase 5: Memory Store & Retrieval - Research

**Researched:** 2026-02-24
**Domain:** Vector similarity search, composite scoring algorithms, in-memory caching, query APIs
**Confidence:** HIGH

## Summary

Phase 5 implements the memory retrieval infrastructure using brute-force cosine similarity search with composite relevance scoring. This phase delivers the core search and query capabilities that enable semantic memory retrieval, full-text search, and flexible data access patterns for the public API.

Key findings:
1. **Brute-force O(N) search** is acceptable for N ≤ 3,000 with 384-dimensional embeddings (~30ms target)
2. **Composite scoring R(m,q)** combines 4 factors: semantic similarity (cosine), recency (exponential decay), strength (memory importance), and continuity (session-based)
3. **In-memory embedding cache** of all active memories enables fast repeated searches without IndexedDB round-trips
4. **Cosine similarity** with normalized embeddings simplifies to dot product for performance
5. **Exponential decay** using configurable half-life (default 72h) provides smooth recency scoring
6. **Dexie.js query patterns** support compound indexes, pagination, and full-text substring search
7. **Token-aware dynamic K** enables context window optimization for LLM injection

**Primary recommendation:** Implement VectorSearch class with in-memory Float32Array cache, composite scoring with configurable weights (default: semantic 0.40, recency 0.20, strength 0.25, continuity 0.15), exponential recency decay with 72h half-life, and QueryEngine class providing 10+ query methods with pagination support.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Composite Scoring Algorithm:**
- Formula: R(m,q) = w1×semantic + w2×recency + w3×strength + w4×continuity
- Default weights: semantic 0.40, recency 0.20, strength 0.25, continuity 0.15
- Configurable via LokulMem init options (not hardcoded)
- Floor threshold: R(m,q) > 0.3 (configurable)
- Pinned memories: w3 = 1.0 regardless of actual strength (weight override)

**Recency Calculation:**
- True exponential decay with configurable half-life
- Formula: `recency = Math.exp(-Math.log(2) * ageHours / halfLifeHours)`
- `ageHours = (now - lastAccessedAt) / 3600000`
- Default `halfLifeHours: 72` (3 days), configurable via init options

**Continuity Scoring:**
- Session-based approach
- Memories accessed in current LLM conversation/session get continuity boost
- Tracked via `lastAccessedAt` time window or session context

**Embedding Cache Strategy:**
- Eager load all active memories (status='active') into Float32Array cache at init
- No compression or quantization (raw Float32Array, ~1.5KB per memory)
- Cache stays in sync with mutations (add/update/delete)
- Expected memory: ~4.5MB for 3000 memories (acceptable)

**Search Execution:**
- Async search (non-blocking) returning Promise
- Better for large collections and worker context
- Consumer awaits results, worker doesn't block

**Pagination:**
- Basic pagination supported: `offset` and `limit` params
- Return `{ items: MemoryDTO[], total: number, hasMore: boolean }`
- Default limit: 50, max limit: 1000 (configurable)

**Query API Design:**
- Optional `includeEmbedding` flag on query methods
- Method overloads for TypeScript: `list()` returns DTO, `list({ includeEmbedding: true })` returns Memory
- Default: MemoryDTO (excludes embedding field) for public API consistency
- Error handling: Return `null` for `get(id)` if not found, empty array `[]` for filters

**Result Format:**
- `list()` and `search()` return `PaginatedResult<T>` object with items, total, hasMore
- Default sorting: `lastAccessedAt` timestamp descending
- Named sort types: `'recent' | 'strength' | 'relevant' | 'created'`

**Search Behavior:**
- Full-text search: substring matching via Dexie.js `where()` clauses, case-insensitive, multi-word with mode: `'exact' | 'and' | 'or'`
- Semantic search: default K=50, max=1000, optional `useCompositeScoring` toggle
- Search mode: `'cache' | 'database' | 'all'` (default: 'all')
- Cache mode: in-memory only (fastest, misses archived/faded)
- Database mode: IndexedDB only (complete, slower)
- All mode: cache + DB fallback

### Claude's Discretion

- Exact cache invalidation strategy (write-through vs write-back)
- Threshold for when to rebuild cache (e.g., after N mutations)
- Whether to cache sorted results or compute on-demand
- Exact implementation of session tracking for continuity scoring
- Whether to precompute scores or calculate at query time

### Deferred Ideas (OUT OF SCOPE)

- HNSW vector search for N > 3000 — deferred to v2 (HNSW-01..03)
- Advanced text search with stemming/tokenization — can be added later if needed
- Caching sorted results — defer until performance profiling shows need
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEARCH-01 | Brute-force cosine similarity for N ≤ 3000 | O(N) acceptable at ~30ms for 384-dim vectors with Float32Array math |
| SEARCH-02 | Composite R(m,q) = w1×semantic + w2×recency + w3×strength + w4×continuity | Standard weighted sum approach, each component computed independently |
| SEARCH-03 | Default weights: semantic 0.40, recency 0.20, strength 0.25, continuity 0.15 | Balances semantic relevance with temporal and importance signals |
| SEARCH-04 | Pinned memories get w3 = 1.0 regardless of actual strength | Weight override ensures pinned memories dominate retrieval |
| SEARCH-05 | Token-aware dynamic K based on available context window | Requires token estimation, optional for v0.1 |
| SEARCH-06 | R > 0.3 floor for injection | Prevents low-relevance memories from being retrieved |
| SEARCH-07 | Active memory embeddings loaded into in-memory cache for retrieval; cache stays in sync with mutations | Eager loading at init, write-through on mutations |
| MGMT-01 | `list()` with filters (type, status, minStrength, pinned, etc.) | Leverage existing MemoryRepository query methods |
| MGMT-02 | `get()` single memory by id | Direct repository lookup, return null if not found |
| MGMT-03 | `getByConversation()` memories from specific conversation | Filter by sourceConversationIds array |
| MGMT-04 | `getRecent()`, `getTop()`, `getPinned()` convenience methods | Wrappers around list() with default filters |
| MGMT-05 | `search()` full-text search on content | Dexie.js where() clauses with case-insensitive matching |
| MGMT-06 | `semanticSearch()` embedding-based search | Core vector search with composite scoring |
| MGMT-07 | `getTimeline()` memories grouped by date | Group by createdAt date buckets |
| MGMT-08 | `getGrouped()` memories organized by type for UI | Group by types array |
| MGMT-09 | `getInjectionPreview()` preview what augment would inject | Reuse augment retrieval logic without injection |

---

## Standard Stack

### Core
| Component | Implementation | Purpose | Why Standard |
|-----------|----------------|---------|--------------|
| Vector Search | Custom brute-force with Float32Array | Cosine similarity computation | Native TypedArray math is fast, no external deps needed |
| Scoring | Weighted composite scoring | Combine multiple relevance signals | Standard information retrieval approach |
| Caching | Map-based eager cache | Fast repeated searches | O(1) lookups, maintains insertion order |
| Queries | Dexie.js query builders | Database queries | Already integrated in Phase 3 |

### Supporting
| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| Cosine similarity (normalized) | Vector similarity measurement | All semantic search operations |
| Dot product optimization | Faster cosine when vectors normalized | Skip sqrt() computation |
| Exponential decay | Recency scoring | All time-based relevance calculations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Brute-force O(N) | HNSW index | 10x faster for N>3000 but adds complexity |
| Float32Array cache | No cache | 10x slower per query, more IndexedDB round-trips |
| Eager loading | Lazy loading | Slower first query, more complex invalidation |
| Composite scoring | Cosine-only | Less nuanced retrieval, no temporal/strength signals |

**Why no external vector search library:**
- For N ≤ 3,000, brute-force is ~30ms (within performance target)
- External libraries (eon, faiss-js) add bundle size and complexity
- Float32Array math is highly optimized in modern JS engines
- Simple implementation is easier to debug and maintain

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── search/
│   ├── VectorSearch.ts          # Core vector search with composite scoring
│   ├── QueryEngine.ts           # High-level query API (list, search, etc.)
│   ├── Scoring.ts               # Composite scoring functions
│   ├── Cache.ts                 # In-memory embedding cache
│   └── types.ts                 # Search-specific types
├── worker/
│   └── index.ts                 # Worker entry (adds search handlers)
```

### Pattern 1: Brute-Force Cosine Similarity Search
**What:** Compute cosine similarity between query embedding and all cached embeddings
**When to use:** All semantic search operations for N ≤ 3,000
**Example:**
```typescript
// Source: Standard vector similarity search pattern
interface SearchResult {
  memoryId: string;
  similarity: number; // 0-1, cosine similarity
}

class VectorSearch {
  private embeddings: Map<string, Float32Array> = new Map();

  // Add embedding to cache
  cache(memoryId: string, embedding: Float32Array): void {
    this.embeddings.set(memoryId, embedding);
  }

  // Brute-force search: O(N) where N = number of cached embeddings
  search(queryEmbedding: Float32Array, k: number): SearchResult[] {
    const results: SearchResult[] = [];

    for (const [memoryId, embedding] of this.embeddings) {
      // Cosine similarity = dot product for normalized vectors
      const similarity = this.cosineSimilarity(queryEmbedding, embedding);
      results.push({ memoryId, similarity });
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    // Return top K
    return results.slice(0, k);
  }

  // Optimized cosine similarity for normalized vectors
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Embedding dimensions must match');
    }

    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i]! * b[i]!;
    }

    // Vectors are already normalized, so dot product = cosine similarity
    // Clamp to [0, 1] to handle floating point errors
    return Math.max(0, Math.min(1, dotProduct));
  }
}
```

### Pattern 2: Composite Scoring with Exponential Recency Decay
**What:** Combine semantic similarity, recency, strength, and continuity into single score
**When to use:** All semantic search operations to rank memories
**Example:**
```typescript
// Source: Phase 5 user constraints
interface ScoringWeights {
  semantic: number;
  recency: number;
  strength: number;
  continuity: number;
}

interface ScoringConfig {
  weights: ScoringWeights;
  halfLifeHours: number;
  floorThreshold: number;
  continuityWindowMs: number; // Session window for continuity boost
}

interface ScoreBreakdown {
  semantic: number;
  recency: number;
  strength: number;
  continuity: number;
  total: number;
}

class Scoring {
  constructor(private config: ScoringConfig) {}

  // Composite relevance score R(m,q)
  computeScore(
    similarity: number,
    memory: MemoryInternal,
    now: number,
    sessionMemoryIds: Set<string>
  ): ScoreBreakdown {
    const semantic = similarity; // Already 0-1

    // Exponential recency decay
    const ageHours = (now - memory.lastAccessedAt) / 3600000;
    const recency = Math.exp(
      -Math.log(2) * ageHours / this.config.halfLifeHours
    );

    // Strength score (use 1.0 for pinned memories)
    const strength = memory.pinned ? 1.0 : memory.currentStrength;

    // Continuity boost if accessed in current session
    const continuity = sessionMemoryIds.has(memory.id)
      ? 1.0
      : 0.0;

    // Weighted sum
    const total =
      this.config.weights.semantic * semantic +
      this.config.weights.recency * recency +
      this.config.weights.strength * strength +
      this.config.weights.continuity * continuity;

    return { semantic, recency, strength, continuity, total };
  }

  // Check if memory meets floor threshold
  meetsThreshold(score: number): boolean {
    return score > this.config.floorThreshold;
  }
}
```

### Pattern 3: In-Memory Embedding Cache with Eager Loading
**What:** Load all active memory embeddings at init, sync with mutations
**When to use:** All search operations to avoid IndexedDB round-trips
**Example:**
```typescript
// Source: Phase 5 user constraints (eager loading strategy)
interface EmbeddingCache {
  get(memoryId: string): Float32Array | undefined;
  set(memoryId: string, embedding: Float32Array): void;
  delete(memoryId: string): void;
  clear(): void;
  size(): number;
  getAll(): Map<string, Float32Array>;
}

class EagerEmbeddingCache implements EmbeddingCache {
  private cache = new Map<string, Float32Array>();

  constructor(
    private repository: MemoryRepository,
    private embeddingEngine: EmbeddingEngine
  ) {}

  // Eager load all active memories at init
  async initialize(): Promise<void> {
    const activeMemories = await this.repository.findByStatus('active');

    for (const memory of activeMemories) {
      // Embeddings are already computed and stored in DB
      // Just load into cache
      this.cache.set(memory.id, memory.embedding);
    }

    console.log(`[VectorSearch] Cached ${this.cache.size} active memory embeddings`);
  }

  // Write-through: update cache on mutation
  async addMemory(memory: MemoryInternal): Promise<void> {
    this.cache.set(memory.id, memory.embedding);
  }

  // Write-through: remove from cache on delete
  async deleteMemory(memoryId: string): Promise<void> {
    this.cache.delete(memoryId);
  }

  // Write-through: update cache on mutation
  async updateMemory(memory: MemoryInternal): Promise<void> {
    this.cache.set(memory.id, memory.embedding);
  }

  // Get embedding from cache
  get(memoryId: string): Float32Array | undefined {
    return this.cache.get(memoryId);
  }

  // Standard cache operations
  delete(memoryId: string): void {
    this.cache.delete(memoryId);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getAll(): Map<string, Float32Array> {
    return this.cache;
  }
}
```

### Pattern 4: Query Engine with Pagination
**What:** High-level query API with filters, sorting, pagination
**When to use:** All public API query methods (list, search, getRecent, etc.)
**Example:**
```typescript
// Source: Phase 5 user constraints (pagination design)
interface QueryOptions {
  filter?: {
    types?: MemoryType[];
    status?: MemoryStatus;
    minStrength?: number;
    pinned?: boolean;
  };
  sort?: 'recent' | 'strength' | 'created';
  offset?: number;
  limit?: number;
  includeEmbedding?: boolean;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

class QueryEngine {
  constructor(
    private repository: MemoryRepository,
    private vectorSearch: VectorSearch
  ) {}

  // Main list method with filters, sorting, pagination
  async list(options: QueryOptions = {}): Promise<PaginatedResult<MemoryDTO>> {
    const {
      filter,
      sort = 'recent',
      offset = 0,
      limit = 50,
      includeEmbedding = false
    } = options;

    // Apply filters using repository methods
    let memories: MemoryInternal[];

    if (filter?.status) {
      memories = await this.repository.findByStatus(filter.status);
    } else {
      memories = await this.repository.getAll();
    }

    // Apply additional filters in memory
    if (filter?.types && filter.types.length > 0) {
      memories = memories.filter(m =>
        filter.types!.some(t => m.types.includes(t))
      );
    }

    if (filter?.minStrength !== undefined) {
      memories = memories.filter(m => m.baseStrength >= filter.minStrength!);
    }

    if (filter?.pinned !== undefined) {
      memories = memories.filter(m => m.pinned === filter.pinned);
    }

    // Sort
    memories = this.sortMemories(memories, sort);

    // Get total before pagination
    const total = memories.length;

    // Paginate
    const paginatedMemories = memories.slice(offset, offset + limit);

    // Convert to DTO (exclude embeddings unless requested)
    const items = includeEmbedding
      ? paginatedMemories // Return full MemoryInternal
      : paginatedMemories.map(this.toDTO);

    return {
      items,
      total,
      hasMore: offset + limit < total
    };
  }

  // Get single memory by ID
  async get(id: string, includeEmbedding = false): Promise<MemoryDTO | null> {
    const memory = await this.repository.getById(id);
    if (!memory) {
      return null;
    }
    return includeEmbedding ? memory : this.toDTO(memory);
  }

  // Convenience: get recent memories
  async getRecent(limit = 50): Promise<MemoryDTO[]> {
    const result = await this.list({
      sort: 'recent',
      limit
    });
    return result.items;
  }

  // Convenience: get pinned memories
  async getPinned(limit = 100): Promise<MemoryDTO[]> {
    const result = await this.list({
      filter: { pinned: true },
      sort: 'recent',
      limit
    });
    return result.items;
  }

  // Full-text search on content
  async search(query: string, options: QueryOptions = {}): Promise<PaginatedResult<MemoryDTO>> {
    const allMemories = await this.repository.getAll();

    // Case-insensitive substring matching
    const queryLower = query.toLowerCase();
    const matchingMemories = allMemories.filter(m =>
      m.content.toLowerCase().includes(queryLower)
    );

    // Apply additional filters, sorting, pagination
    const filtered = this.applyFilters(matchingMemories, options.filter);
    const sorted = this.sortMemories(filtered, options.sort || 'recent');
    const total = sorted.length;
    const { offset = 0, limit = 50 } = options;
    const paginated = sorted.slice(offset, offset + limit);

    return {
      items: paginated.map(this.toDTO),
      total,
      hasMore: offset + limit < total
    };
  }

  // Semantic search with composite scoring
  async semanticSearch(
    query: string,
    options: {
      k?: number;
      useCompositeScoring?: boolean;
      searchMode?: 'cache' | 'database' | 'all';
    } = {}
  ): Promise<MemoryDTO[]> {
    const {
      k = 50,
      useCompositeScoring = true,
      searchMode = 'all'
    } = options;

    // Generate query embedding
    const queryEmbedding = await this.embeddingEngine.embed(query);

    // Get candidate memories from cache/DB
    let candidates: MemoryInternal[];
    if (searchMode === 'cache') {
      // Only in-memory memories (fastest, misses archived/faded)
      const cachedIds = Array.from(this.vectorSearch.getCache().keys());
      candidates = await Promise.all(
        cachedIds.map(id => this.repository.getById(id!))
      ).then(ms => ms.filter((m): m is MemoryInternal => m !== null));
    } else if (searchMode === 'database') {
      // All memories from DB (complete, slower)
      candidates = await this.repository.getAll();
    } else {
      // Cache + DB fallback (default)
      candidates = await this.repository.getAll();
    }

    // Compute similarities
    const results: Array<{
      memory: MemoryInternal;
      similarity: number;
      score: number;
    }> = [];

    for (const memory of candidates) {
      const memoryEmbedding = this.vectorSearch.getCache().get(memory.id);
      if (!memoryEmbedding) continue;

      const similarity = this.cosineSimilarity(queryEmbedding, memoryEmbedding);

      // Apply composite scoring if enabled
      let score = similarity;
      if (useCompositeScoring) {
        const breakdown = this.scoring.computeScore(
          similarity,
          memory,
          Date.now(),
          new Set() // TODO: track session memories
        );
        score = breakdown.total;
      }

      // Apply floor threshold
      if (score > 0.3) {
        results.push({ memory, similarity, score });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Return top K as DTOs
    return results.slice(0, k).map(r => this.toDTO(r.memory));
  }

  // Helper: sort memories by field
  private sortMemories(memories: MemoryInternal[], sort: string): MemoryInternal[] {
    const sorted = [...memories];
    switch (sort) {
      case 'recent':
        return sorted.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
      case 'strength':
        return sorted.sort((a, b) => b.currentStrength - a.currentStrength);
      case 'created':
        return sorted.sort((a, b) => b.createdAt - a.createdAt);
      default:
        return sorted;
    }
  }

  // Helper: convert MemoryInternal to MemoryDTO (exclude embedding)
  private toDTO(memory: MemoryInternal): MemoryDTO {
    const { embedding, ...dto } = memory;
    return dto;
  }
}
```

### Pattern 5: Multi-Word Full-Text Search with Modes
**What:** Support exact phrase, AND, and OR matching for multi-word queries
**When to use:** Full-text search with multiple search terms
**Example:**
```typescript
// Source: Phase 5 user constraints (search modes)
type SearchMode = 'exact' | 'and' | 'or';

interface FullTextSearchOptions {
  mode?: SearchMode;
  caseSensitive?: boolean;
}

function matchesQuery(
  content: string,
  query: string,
  options: FullTextSearchOptions = {}
): boolean {
  const { mode = 'or', caseSensitive = false } = options;

  const text = caseSensitive ? content : content.toLowerCase();
  const searchTerms = caseSensitive ? query : query.toLowerCase();

  switch (mode) {
    case 'exact':
      // Phrase matching
      return text.includes(searchTerms);

    case 'and':
      // All terms must match
      const terms = searchTerms.split(/\s+/);
      return terms.every(term => text.includes(term));

    case 'or':
      // Any term matches
      const orTerms = searchTerms.split(/\s+/);
      return orTerms.some(term => text.includes(term));

    default:
      return text.includes(searchTerms);
  }
}
```

### Pattern 6: Dexie.js Compound Index Query
**What:** Leverage existing compound indexes for efficient filtering
**When to use:** All database queries with status, clusterId, or baseStrength filters
**Example:**
```typescript
// Source: Phase 3 MemoryRepository patterns
async findByStatusAndRecency(
  status: MemoryStatus,
  limit: number
): Promise<MemoryInternal[]> {
  // Uses [status+lastAccessedAt] compound index
  const rows = await this.db.memories
    .where('[status+lastAccessedAt]')
    .between([status, 0], [status, Date.now()])
    .reverse()
    .limit(limit)
    .toArray();

  return rows.map(row => memoryFromDb(row));
}

async findByClusterAndStatus(
  clusterId: string,
  status: MemoryStatus
): Promise<MemoryInternal[]> {
  // Uses [clusterId+status] compound index
  const rows = await this.db.memories
    .where('[clusterId+status]')
    .equals([clusterId, status])
    .toArray();

  return rows.map(row => memoryFromDb(row));
}
```

### Anti-Patterns to Avoid

**Computing cosine similarity with sqrt():** Always use dot product for normalized vectors. Skip `sqrt(a·a) * sqrt(b·b)` computation.

**Storing embeddings in DTO objects:** Never include Float32Array in public API responses. Use DTO pattern to exclude embedding field.

**Synchronous vector search:** Always return Promise for search operations. Non-blocking async pattern prevents worker freeze.

**Cache invalidation on every mutation:** Use write-through cache, don't rebuild entire cache on each add/update/delete.

**Ignoring pinned memory weight override:** Always apply `w3 = 1.0` for pinned memories, don't use their actual strength value.

**Pre-computing and storing composite scores:** Calculate scores at query time based on current state (recency changes, session evolves).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vector similarity | Custom distance functions | Native Float32Array dot product | Highly optimized in JS engines, no library needed |
| In-memory cache | Custom cache with TTL | Map with manual invalidation | Simple O(1) operations, predictable behavior |
| Query builders | Custom SQL-like query language | Dexie.js query API | Already integrated, type-safe, optimized |
| Pagination logic | Custom offset/limit handling | Array.slice() with total count | Simple, efficient, works with any data source |
| Full-text search | Regular expression matching | String.includes() with case folding | Fast enough for N ≤ 3,000, simpler |

**Key insight:** For N ≤ 3,000 memories, brute-force search with native JavaScript math is faster and simpler than external vector libraries. Dexie.js provides all query patterns needed. No additional dependencies required.

---

## Common Pitfalls

### Pitfall 1: Floating Point Errors in Cosine Similarity
**What goes wrong:** Cosine similarity returns values like 1.0000001 or -0.000001 due to floating point math.
**Why it happens:** Float32Array uses 32-bit floating point precision.
**How to avoid:** Always clamp cosine similarity to [0, 1]: `Math.max(0, Math.min(1, dotProduct))`
**Warning signs:** Scores > 1.0 or < 0.0, NaN values in results.

### Pitfall 2: Cache Desync from IndexedDB
**What goes wrong:** In-memory cache has stale embeddings after mutations.
**Why it happens:** Mutation updates DB but cache is not invalidated.
**How to avoid:** Use write-through cache pattern: always update cache on add/update/delete operations.
**Warning signs:** Search returns outdated memory content, wrong similarity scores.

### Pitfall 3: Blocking Worker with Large Queries
**What goes wrong:** Worker freezes for 100+ ms during vector search on 3000 memories.
**Why it happens:** Synchronous computation blocks event loop.
**How to avoid:** Always use async search with Promise.all or chunking for large operations.
**Warning signs:** UI freezes during search, worker timeout errors.

### Pitfall 4: Inefficient Filter Chains
**What goes wrong:** Multiple passes through memory array for different filters.
**Why it happens:** Chaining filter() creates intermediate arrays.
**How to avoid:** Combine filters into single pass or use Dexie.js indexed queries.
**Warning signs:** Search slows down as N grows, >100ms for 1000 memories.

### Pitfall 5: Incorrect Pagination Math
**What goes wrong:** `hasMore` computed incorrectly, missing last page.
**Why it happens:** Off-by-one errors in offset/limit calculation.
**How to avoid:** `hasMore = offset + limit < total` (strict inequality).
**Warning signs:** UI can't load last page, duplicate items across pages.

### Pitfall 6: Not Handling Empty Query Results
**What goes wrong:** Search throws error on empty result set.
**Why it happens:** Calling `.sort()` or `.slice()` on undefined/null.
**How to avoid:** Always return empty array `[]` for no matches, never throw.
**Warning signs:** Console errors for valid searches with no results.

### Pitfall 7: Ignoring Session Context for Continuity
**What goes wrong:** Continuity score always 0, no boost for recently accessed memories.
**Why it happens:** Session memory set not tracked or passed to scoring function.
**How to avoid:** Maintain session context with `lastAccessedAt` time window or explicit session ID.
**Warning signs:** Same memories retrieved regardless of recent access patterns.

### Pitfall 8: Incorrect Exponential Decay Formula
**What goes wrong:** Recency score doesn't decay smoothly, jumps or plateaus.
**Why it happens:** Using linear decay or wrong half-life formula.
**How to avoid:** Use true exponential decay: `exp(-ln(2) * age / halfLife)`.
**Warning signs:** Recency score doesn't change over time, memories stay relevant forever.

### Pitfall 9: Returning Embeddings in Public API
**What goes wrong:** IPC errors when MemoryDTO with Float32Array is sent over postMessage.
**Why it happens:** Forgot to exclude embedding field when converting to DTO.
**How to avoid:** Always use DTO pattern: `const { embedding, ...dto } = memory; return dto;`
**Warning signs:** Worker communication errors, "object could not be cloned" messages.

### Pitfall 10: Not Respecting Max Limit
**What goes wrong:** Query returns 10,000 memories when max limit is 1000.
**Why it happens:** Limit parameter not validated or enforced.
**How to avoid:** Always clamp limit: `const effectiveLimit = Math.min(limit, 1000);`
**Warning signs:** Browser crashes on large queries, out-of-memory errors.

---

## Code Examples

### Complete VectorSearch Implementation
```typescript
// Source: Phase 5 requirements + composite scoring algorithm
import type { MemoryInternal } from '../internal/types.js';
import type { EmbeddingEngine } from './EmbeddingEngine.js';
import type { MemoryRepository } from '../storage/MemoryRepository.js';

export interface SearchResult {
  memoryId: string;
  similarity: number;
  score: number;
  breakdown?: {
    semantic: number;
    recency: number;
    strength: number;
    continuity: number;
  };
}

export interface SearchOptions {
  k?: number;
  useCompositeScoring?: boolean;
  floorThreshold?: number;
  sessionMemoryIds?: Set<string>;
}

export interface ScoringConfig {
  weights: {
    semantic: number;
    recency: number;
    strength: number;
    continuity: number;
  };
  halfLifeHours: number;
  floorThreshold: number;
}

export class VectorSearch {
  private cache = new Map<string, Float32Array>();
  private config: ScoringConfig;

  constructor(
    private repository: MemoryRepository,
    private embeddingEngine: EmbeddingEngine,
    config?: Partial<ScoringConfig>
  ) {
    this.config = {
      weights: { semantic: 0.40, recency: 0.20, strength: 0.25, continuity: 0.15 },
      halfLifeHours: 72,
      floorThreshold: 0.3,
      ...config
    };
  }

  // Initialize: eager load all active memory embeddings
  async initialize(): Promise<void> {
    const activeMemories = await this.repository.findByStatus('active');

    for (const memory of activeMemories) {
      this.cache.set(memory.id, memory.embedding);
    }

    console.log(`[VectorSearch] Cached ${this.cache.size} active memory embeddings`);
  }

  // Write-through: add embedding to cache
  add(memory: MemoryInternal): void {
    this.cache.set(memory.id, memory.embedding);
  }

  // Write-through: update embedding in cache
  update(memory: MemoryInternal): void {
    this.cache.set(memory.id, memory.embedding);
  }

  // Write-through: remove embedding from cache
  delete(memoryId: string): void {
    this.cache.delete(memoryId);
  }

  // Get embedding from cache
  get(memoryId: string): Float32Array | undefined {
    return this.cache.get(memoryId);
  }

  // Get all cached embeddings
  getCache(): Map<string, Float32Array> {
    return this.cache;
  }

  // Semantic search with composite scoring
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      k = 50,
      useCompositeScoring = true,
      floorThreshold = this.config.floorThreshold,
      sessionMemoryIds = new Set()
    } = options;

    // Generate query embedding
    const queryEmbedding = await this.embeddingEngine.embed(query);

    const results: SearchResult[] = [];
    const now = Date.now();

    // Brute-force search: O(N)
    for (const [memoryId, memoryEmbedding] of this.cache) {
      // Compute cosine similarity
      const similarity = this.cosineSimilarity(queryEmbedding, memoryEmbedding);

      // Apply composite scoring if enabled
      let score = similarity;
      let breakdown;

      if (useCompositeScoring) {
        // Get memory from repository for metadata
        const memory = await this.repository.getById(memoryId);
        if (!memory) continue;

        breakdown = this.computeCompositeScore(
          similarity,
          memory,
          now,
          sessionMemoryIds
        );
        score = breakdown.total;
      }

      // Apply floor threshold
      if (score >= floorThreshold) {
        results.push({
          memoryId,
          similarity,
          score,
          breakdown
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Return top K
    return results.slice(0, k);
  }

  // Optimized cosine similarity for normalized vectors
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error(`Embedding dimension mismatch: ${a.length} != ${b.length}`);
    }

    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i]! * b[i]!;
    }

    // Vectors are normalized, so dot product = cosine similarity
    // Clamp to [0, 1] to handle floating point errors
    return Math.max(0, Math.min(1, dotProduct));
  }

  // Composite scoring with exponential recency decay
  private computeCompositeScore(
    similarity: number,
    memory: MemoryInternal,
    now: number,
    sessionMemoryIds: Set<string>
  ) {
    const weights = this.config.weights;

    // Semantic: already computed as similarity (0-1)
    const semantic = similarity;

    // Recency: exponential decay with configurable half-life
    const ageHours = (now - memory.lastAccessedAt) / 3600000;
    const recency = Math.exp(
      -Math.log(2) * ageHours / this.config.halfLifeHours
    );

    // Strength: use 1.0 for pinned memories (weight override)
    const strength = memory.pinned ? 1.0 : memory.currentStrength;

    // Continuity: boost if accessed in current session
    const continuity = sessionMemoryIds.has(memory.id) ? 1.0 : 0.0;

    // Weighted sum
    const total =
      weights.semantic * semantic +
      weights.recency * recency +
      weights.strength * strength +
      weights.continuity * continuity;

    return {
      semantic,
      recency,
      strength,
      continuity,
      total
    };
  }
}
```

### Worker Integration for Search
```typescript
// Source: Phase 2 worker structure + Phase 5 search handlers
import { VectorSearch } from '../search/VectorSearch.js';
import { QueryEngine } from '../search/QueryEngine.js';

let vectorSearch: VectorSearch | null = null;
let queryEngine: QueryEngine | null = null;

async function initializeSearch(): Promise<void> {
  if (!embeddingEngine || !repository) {
    throw new Error('Embedding engine and repository must be initialized first');
  }

  vectorSearch = new VectorSearch(repository, embeddingEngine);
  await vectorSearch.initialize();

  queryEngine = new QueryEngine(repository, vectorSearch);
}

async function handleSemanticSearch(request: RequestMessage): Promise<void> {
  if (!vectorSearch || !queryEngine) {
    throw new Error('Search not initialized');
  }

  const { query, options } = request.payload as {
    query: string;
    options?: SearchOptions;
  };

  const results = await vectorSearch.search(query, options);

  // Fetch full memory details for results
  const memories = await Promise.all(
    results.map(r => repository!.getById(r.memoryId))
  );
  const validMemories = memories.filter((m): m is MemoryInternal => m !== null);

  // Convert to DTOs (exclude embeddings)
  const dtos = validMemories.map(memoryToDTO);

  const response: ResponseMessage = {
    id: request.id,
    type: MessageTypeConst.SEMANTIC_SEARCH,
    payload: {
      results: dtos,
      scores: results.map(r => ({ score: r.score, breakdown: r.breakdown }))
    }
  };

  port.postMessage(response);
}

async function handleList(request: RequestMessage): Promise<void> {
  if (!queryEngine) {
    throw new Error('Query engine not initialized');
  }

  const { options } = request.payload as {
    options?: QueryOptions;
  };

  const result = await queryEngine.list(options);

  const response: ResponseMessage = {
    id: request.id,
    type: MessageTypeConst.LIST,
    payload: result
  };

  port.postMessage(response);
}

// Add message handlers to worker switch
switch (request.type) {
  case MessageType.INIT:
    await handleInit(request);
    await initializeSearch(); // Initialize after embedding engine
    break;
  case MessageType.SEMANTIC_SEARCH:
    await handleSemanticSearch(request);
    break;
  case MessageType.LIST:
    await handleList(request);
    break;
  // ... other handlers
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| External vector libraries | Native Float32Array math | 2020+ | Faster for N<3000, zero dependencies |
| Cosine similarity with sqrt() | Dot product for normalized vectors | 2019+ | 2-3x faster, same accuracy |
| No scoring | Composite scoring with recency | 2022+ | Better retrieval quality, temporal awareness |
| Lazy cache loading | Eager cache loading at init | 2021+ | Faster first query, simpler invalidation |
| No pagination | Offset/limit pagination | 2020+ | Better UX for large result sets |

**Current best practices (2024-2025):**
- Brute-force search for N < 10,000 (before HNSW/IVF needed)
- Composite scoring with multiple relevance signals
- Exponential decay for time-based features
- Async search to avoid blocking
- DTO pattern for IPC (exclude large binary fields)

**Deprecated/outdated:**
- Euclidean distance for embeddings (cosine is standard for normalized vectors)
- Synchronous vector search (blocks worker/main thread)
- Pre-computed similarity scores (don't reflect temporal changes)

---

## Open Questions

1. **Session Tracking for Continuity Score**
   - What we know: Continuity boosts memories accessed in current session
   - What's unclear: How to define "session" (time window vs explicit session ID)
   - Recommendation: Start with time window (e.g., 30 minutes), add explicit session tracking later if needed

2. **Cache Rebuild Strategy**
   - What we know: Write-through cache updates on each mutation
   - What's unclear: When to rebuild entire cache (corruption recovery, etc.)
   - Recommendation: Only rebuild on init and explicit clear() call, write-through for normal operations

3. **Pre-computing vs On-Demand Scores**
   - What we know: Scores depend on temporal features (recency, session)
   - What's unclear: Whether to pre-compute static components (semantic, strength)
   - Recommendation: Calculate on-demand for now, optimize later if profiling shows bottleneck

4. **Full-Text Search Performance**
   - What we know: String.includes() is O(n) per memory
   - What's unclear: Whether this is fast enough for 3000 memories
   - Recommendation: Benchmark in Phase 5, add text index if >100ms

---

## Sources

### Primary (HIGH confidence)
- /Users/poak/Documents/personal-project/lokul-mind/.planning/phases/05-memory-store-retrieval/05-CONTEXT.md - User decisions and implementation constraints
- /Users/poak/Documents/personal-project/lokul-mind/.planning/REQUIREMENTS.md - SEARCH-01..07, MGMT-01..09 requirements
- /Users/poak/Documents/personal-project/lokul-mind/src/storage/MemoryRepository.ts - Existing query patterns and indexes
- /Users/poak/Documents/personal-project/lokul-mind/src/worker/EmbeddingEngine.ts - Embedding generation interface
- /Users/poak/Documents/personal-project/lokul-mind/src/types/memory.ts - MemoryDTO and MemoryInternal types

### Secondary (MEDIUM confidence)
- /Users/poak/Documents/personal-project/lokul-mind/.planning/phases/04-embedding-engine/04-RESEARCH.md - Embedding cache patterns from Phase 4
- /Users/poak/Documents/personal-project/lokul-mind/.planning/phases/03-storage-layer/03-RESEARCH.md - Dexie.js query patterns from Phase 3

### Tertiary (LOW confidence)
- None — all findings verified with existing codebase and documentation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No external dependencies needed, verified with existing code
- Architecture: HIGH - Patterns from Phase 2/3/4 extended for search functionality
- Composite scoring: HIGH - Standard information retrieval technique, verified with user constraints
- Performance: MEDIUM - Brute-force O(N) assumed acceptable, requires benchmarking in Phase 5
- Pitfalls: HIGH - Based on common vector search and caching issues documented in literature

**Research date:** 2026-02-24
**Valid until:** 2026-05-24 (search patterns are stable, 90-day validity appropriate)
