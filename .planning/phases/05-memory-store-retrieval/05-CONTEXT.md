# Phase 5: Memory Store & Retrieval - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

## Phase Boundary

Vector search and query API for memory retrieval. This phase delivers:
1. Brute-force cosine similarity search with composite relevance scoring (semantic + recency + strength + continuity)
2. Token-aware dynamic K for context window optimization
3. In-memory cache of active memory embeddings
4. Query API methods (list, get, getByConversation, getRecent, getTop, getPinned, search, semanticSearch, getTimeline, getGrouped, getInjectionPreview)

This is an internal infrastructure phase — the code runs in the worker context and provides data access patterns for Phase 6+ to build on.

## Implementation Decisions

### Scoring Algorithm

**Composite R(m,q) Weights:**
- Configurable via LokulMem init options (not hardcoded)
- Spec defaults: semantic 0.40, recency 0.20, strength 0.25, continuity 0.15
- R(m,q) > 0.3 floor threshold (configurable)

**Recency Calculation:**
- True exponential decay with configurable half-life
- Formula: `recency = Math.exp(-Math.log(2) * ageHours / halfLifeHours)`
- `ageHours = (now - lastAccessedAt) / 3600000`
- Default `halfLifeHours: 72` (3 days), configurable via init options

**Continuity Scoring:**
- Session-based approach
- Memories accessed in current LLM conversation/session get continuity boost
- Tracked via `lastAccessedAt` time window or session context

**Pinned Memory Handling:**
- Weight override approach: apply `w3 = 1.0` to pinned memories
- Ignore their actual strength value
- Pinned memories always dominate in scoring

### Performance Constraints

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

### Query API Design

**Return Types:**
- Optional `includeEmbedding` flag on query methods
- Method overloads for TypeScript: `list()` returns DTO, `list({ includeEmbedding: true })` returns Memory
- Default: MemoryDTO (excludes embedding field) for public API consistency

**Error Handling:**
- Return `null` for `get(id)` if not found
- Return empty array `[]` for filters with no matches
- Ergonomic approach, no exceptions thrown

**Result Format:**
- `list()` and `search()` return `PaginatedResult<T>` object:
  ```typescript
  {
    items: T[],
    total: number,
    hasMore: boolean
  }
  ```
- Pagination-friendly design

**Default Sorting:**
- `lastAccessedAt` timestamp descending (most recently accessed first)
- Matches recency scoring component

**Custom Sorting:**
- Named sort types: `'recent' | 'strength' | 'relevant' | 'created'`
- Passed via options: `list({ sortBy: 'strength' })`
- Simpler API than raw field names

**Metadata Structure:**
- Defer to Phase 7 (Extraction) where entity structure is defined
- `getTimeline()` and `getGrouped()` use basic grouping by date/type for now

### Search Behavior

**Full-Text Search (search()):**
- Simple substring matching via Dexie.js `where()` clauses
- Case-insensitive by default
- Multi-word queries support configurable mode: `'exact' | 'and' | 'or'`
  - `'exact'`: phrase matching
  - `'and'`: all terms must match
  - `'or'`: any term matches (default)

**Semantic Search (semanticSearch()):**
- Configurable default K and max limit
- Default: 50 results, max: 1000
- Optional `useCompositeScoring` toggle:
  - `true`: full R(m,q) with all 4 components
  - `false`: semantic similarity only (cosine)
- Search mode option: `'cache' | 'database' | 'all'`
  - `'cache'`: in-memory only (fastest, misses archived/faded)
  - `'database'`: IndexedDB query only (complete, slower)
  - `'all'`: cache + DB fallback (default)

### Claude's Discretion

- Exact cache invalidation strategy (write-through vs write-back)
- Threshold for when to rebuild cache (e.g., after N mutations)
- Whether to cache sorted results or compute on-demand
- Exact implementation of session tracking for continuity scoring
- Whether to precompute scores or calculate at query time

## Specific Ideas

- Use true exponential decay for recency — "best practice + easy to tune"
- Half-life of 72h (3 days) provides good balance between recency and staleness
- Async search keeps worker responsive even at N=3000
- Paginated result objects enable smooth UI scrolling without knowing total upfront
- Method overloads provide type safety without generic complexity

## Deferred Ideas

- HNSW vector search for N > 3000 — deferred to v2 (HNSW-01..03)
- Advanced text search with stemming/tokenization — can be added later if needed
- Caching sorted results — defer until performance profiling shows need

---

*Phase: 05-memory-store-retrieval*
*Context gathered: 2026-02-24*
