# Phase 5: Memory Store & Retrieval - Plan Summary

**Created:** 2026-02-24
**Status:** Ready for Execution
**Plans:** 2

---

## Overview

Phase 5 implements the memory retrieval infrastructure using brute-force cosine similarity search with composite relevance scoring. This phase delivers the core search and query capabilities that enable semantic memory retrieval, full-text search, and flexible data access patterns.

**Key Implementation:**
- Brute-force O(N) vector search with Float32Array math (~30ms for N ≤ 3,000)
- Composite scoring R(m,q) combining semantic (0.40), recency (0.20), strength (0.25), continuity (0.15)
- In-memory embedding cache with eager loading and write-through sync
- QueryEngine with 10+ methods: list, get, getByConversation, getRecent, getTop, getPinned, search, semanticSearch, getTimeline, getGrouped, getInjectionPreview
- Pagination with { items, total, hasMore } result format
- Full-text search with modes: exact, and, or

---

## Plans

### Plan 05-01: Vector Search & Composite Scoring (Wave 1)
**File:** `.planning/phases/05-memory-store-retrieval/05-01-PLAN.md`
**Depends on:** Phase 4 complete
**Requirements:** SEARCH-01..07

**Implementation:**
1. Create search types (SearchResult, SearchOptions, ScoringConfig, ScoreBreakdown)
2. Implement Scoring class with exponential recency decay
3. Implement VectorSearch class with Float32Array cache
4. Create search barrel file for clean exports

**Key Deliverables:**
- `src/search/types.ts` - Search-specific type definitions
- `src/search/Scoring.ts` - Composite scoring with configurable weights
- `src/search/VectorSearch.ts` - Core vector search with in-memory cache
- `src/search/_index.ts` - Search module barrel file

**Success Criteria:**
- Brute-force cosine similarity < 30ms for N ≤ 3000
- Composite scoring combines 4 components with correct weights
- Pinned memories get strength = 1.0 (weight override)
- Eager cache loading at init with write-through sync
- Exponential recency decay with 72h half-life

---

### Plan 05-02: Query Engine API (Wave 2)
**File:** `.planning/phases/05-memory-store-retrieval/05-02-PLAN.md`
**Depends on:** 05-01
**Requirements:** MGMT-01..09

**Implementation:**
1. Add query-specific types (QueryFilter, QueryOptions, PaginatedResult, etc.)
2. Implement QueryEngine with 10+ query methods
3. Update Protocol.ts with LIST, GET, SEARCH, SEMANTIC_SEARCH message types
4. Integrate QueryEngine into worker with message handlers

**Key Deliverables:**
- `src/search/QueryEngine.ts` - High-level query API
- Updated `src/core/Protocol.ts` - Query message types
- Updated `src/worker/index.ts` - Query handlers

**Query Methods:**
- `list()` - Main query with filters, sorting, pagination
- `get()` - Single memory by ID
- `getByConversation()` - Memories from specific conversation
- `getRecent()` - Convenience for recent memories
- `getTop()` - Convenience for high-strength memories
- `getPinned()` - Convenience for pinned memories
- `search()` - Full-text search with exact/and/or modes
- `semanticSearch()` - Vector search with composite scoring
- `getTimeline()` - Memories grouped by date
- `getGrouped()` - Memories organized by type
- `getInjectionPreview()` - Preview what augment would inject

**Success Criteria:**
- 10+ query methods implemented and working
- Pagination returns { items, total, hasMore }
- Method overloads for includeEmbedding parameter
- Full-text search supports 3 modes
- Semantic search uses composite scoring by default
- Return null for not found, [] for no matches

---

## Architecture

### Component Relationships

```
QueryEngine
    ├── uses → VectorSearch (for semantic search)
    ├── uses → MemoryRepository (for DB queries)
    └── uses → EmbeddingEngine (for query embeddings)

VectorSearch
    ├── uses → EmbeddingEngine (generate query embeddings)
    ├── uses → MemoryRepository (load active memories, get metadata)
    └── maintains → Map<string, Float32Array> (embedding cache)

Scoring
    └── computes → Composite R(m,q) score with exponential decay
```

### Data Flow

1. **Initialization (Worker Startup)**
   ```
   WorkerManager.init()
       → EmbeddingEngine.initialize()
       → MemoryRepository.initialize()
       → VectorSearch.initialize() (eager load all active embeddings)
       → QueryEngine constructor
   ```

2. **Semantic Search Query**
   ```
   Client.semanticSearch(query)
       → Worker sends SEMANTIC_SEARCH message
       → QueryEngine.semanticSearch()
       → EmbeddingEngine.embed(query) (with LRU cache)
       → VectorSearch.search() (brute-force O(N))
       → Scoring.computeScore() (composite R(m,q))
       → Return top K results as MemoryDTO[]
   ```

3. **Full-Text Search Query**
   ```
   Client.search(query)
       → Worker sends SEARCH message
       → QueryEngine.search()
       → MemoryRepository.getAll()
       → Filter by matchesQuery() (exact/and/or)
       → Apply filters, sorting, pagination
       → Return PaginatedResult<MemoryDTO>
   ```

4. **Cache Invalidation (Write-Through)**
   ```
   Memory added/updated/deleted
       → MemoryRepository mutation
       → VectorSearch.add/update/delete() (sync cache)
       → Cache stays consistent
   ```

---

## Technical Decisions

### Composite Scoring Algorithm

**Formula:** R(m,q) = w1×semantic + w2×recency + w3×strength + w4×continuity

**Default Weights:**
- semantic: 0.40 (cosine similarity)
- recency: 0.20 (exponential decay)
- strength: 0.25 (memory importance, pinned → 1.0)
- continuity: 0.15 (session-based boost)

**Recency Decay:**
```
recency = exp(-ln(2) × ageHours / halfLifeHours)
```
- Default half-life: 72 hours (3 days)
- Configurable via init options
- Pinned memories exempt (λ = 0)

**Floor Threshold:** R > 0.3 (filters low-relevance memories)

### In-Memory Cache Strategy

**Eager Loading:**
- Load all active memories (status='active') at init
- Expected memory: ~4.5MB for 3000 memories (384 dims × 4 bytes × 3000)
- Acceptable for browser context

**Write-Through Sync:**
- Add: cache.set(memory.id, memory.embedding)
- Update: cache.set(memory.id, memory.embedding)
- Delete: cache.delete(memory.id)
- No rebuild needed on mutations

**Cache Structure:**
```typescript
Map<string, Float32Array>
  Key: memory.id
  Value: embedding (384 dimensions, Float32Array)
```

### Search Modes

**cache** (in-memory only):
- Fastest (no IndexedDB round-trip)
- Misses archived/faded memories
- Use for real-time queries

**database** (IndexedDB only):
- Complete (all memories)
- Slower (IndexedDB query + embedding load)
- Use for comprehensive search

**all** (cache + DB fallback):
- Default mode
- Cache first, DB for missing
- Best balance of speed and completeness

---

## Testing Strategy

### Unit Tests (Vitest)

**VectorSearch:**
- Test cosine similarity calculation
- Test composite scoring with all components
- Test pinned memory weight override
- Test floor threshold filtering
- Test cache add/update/delete operations
- Test eager loading at initialization

**Scoring:**
- Test exponential recency decay formula
- Test configurable weights and half-life
- Test pinned memory strength override
- Test continuity scoring with session set
- Test floor threshold checking

**QueryEngine:**
- Test all 10+ query methods
- Test pagination (offset, limit, hasMore)
- Test filter combinations (types, status, strength, pinned)
- Test sorting (recent, strength, created)
- Test full-text search modes (exact, and, or)
- Test semantic search with/without composite scoring
- Test getTimeline grouping by date
- Test getGrouped grouping by type
- Test getInjectionPreview token estimation

### Integration Tests

**Worker Integration:**
- Test LIST/GET/SEARCH/SEMANTIC_SEARCH messages
- Test QueryEngine initialization in worker
- Test query execution through worker protocol
- Test error handling (not initialized, not found)

**End-to-End:**
- Test full query flow from client to worker
- Test semantic search with composite scoring
- Test full-text search with all modes
- Test pagination across multiple pages
- Test cache sync on mutations

### Performance Tests

**Vector Search:**
- Benchmark search latency at 1K, 2K, 3K memories
- Verify < 30ms target for N ≤ 3000
- Profile cosine similarity computation

**Cache Operations:**
- Measure cache memory usage
- Verify ~4.5MB estimate for 3000 memories
- Test cache sync overhead on mutations

---

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Vector search latency (N=3000) | < 30ms | Benchmark test |
| Cosine similarity (single) | < 0.01ms | Micro-benchmark |
| Cache load time (init) | < 500ms | Init timing |
| Full-text search (3000) | < 50ms | String.includes() perf |
| Query pagination | < 10ms | Array.slice() perf |
| Cache memory (3000 memories) | ~4.5MB | 384 × 4 × 3000 |

---

## Future Considerations

### Phase 6+ Integration

**Decay & Lifecycle (Phase 6):**
- Ebbinghaus decay will update currentStrength
- Maintenance sweep will call VectorSearch.syncCache()
- Faded memories automatically excluded from cache

**Extraction (Phase 7):**
- New memories added via learn() will call VectorSearch.add()
- Entity extraction will populate metadata field
- Contradiction detection will use semanticSearch()

**Public API (Phase 8):**
- augment() will use semanticSearch() with getInjectionPreview()
- learn() will add memories with VectorSearch.add()
- manage() will use all query methods for CRUD operations

### v2 Enhancements (Deferred)

**HNSW Vector Search:**
- When N > 3000, switch to HNSW index
- Lazy loading: only build HNSW when threshold exceeded
- Estimated 10x faster for large collections

**Advanced Full-Text:**
- Add stemming/tokenization for better text search
- Add regex support for advanced queries
- Add fuzzy matching for typos

**Query Optimization:**
- Pre-compute static scores (semantic, strength)
- Cache sorted results for common queries
- Add query result caching layer

---

## Open Questions

1. **Session Tracking for Continuity:**
   - Q: How to track "current session" for continuity scoring?
   - A: Start with time window (30 minutes), add explicit session ID later if needed

2. **Cache Rebuild Strategy:**
   - Q: When to rebuild entire cache?
   - A: Only on init and explicit clear(), write-through for normal operations

3. **Pre-computing Scores:**
   - Q: Pre-compute static components vs on-demand calculation?
   - A: Calculate on-demand for now, optimize later if profiling shows bottleneck

4. **Full-Text Search Performance:**
   - Q: Is String.includes() fast enough for 3000 memories?
   - A: Benchmark in Phase 5, add text index if >100ms

---

## Dependencies

### Internal Dependencies
- Phase 1: Core types (MemoryDTO, MemoryInternal)
- Phase 2: Worker infrastructure (worker context, message protocol)
- Phase 3: Storage layer (MemoryRepository, IndexedDB)
- Phase 4: Embedding engine (EmbeddingEngine, LRU cache)

### External Dependencies
- None (uses native Float32Array math, no vector libraries)

### Build Configuration
- Vite: Library mode (already configured)
- TypeScript: Strict mode (already configured)
- Vitest: Unit testing framework (already configured)

---

## Rollout Plan

### Wave 1: Foundation (05-01)
1. Create search types
2. Implement Scoring class
3. Implement VectorSearch class
4. Create search barrel file

### Wave 2: Query API (05-02)
1. Add query-specific types
2. Implement QueryEngine with all methods
3. Update Protocol.ts with query messages
4. Integrate QueryEngine into worker

### Testing
1. Unit tests for VectorSearch, Scoring, QueryEngine
2. Integration tests for worker queries
3. Performance benchmarks (1K, 2K, 3K memories)

### Documentation
1. Update STATE.md with Phase 5 progress
2. Create plan summaries (05-01-SUMMARY.md, 05-02-SUMMARY.md)
3. Update ROADMAP.md with Phase 5 completion

---

*Plan summary created: 2026-02-24*
*Phase 5 ready for execution*
