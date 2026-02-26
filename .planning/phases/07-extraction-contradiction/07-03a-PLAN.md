---
phase: 07-extraction-contradiction
plan: 03a
type: execute
wave: 3
depends_on:
  - 07-01
  - 07-02
files_modified:
  - src/storage/Database.ts
  - src/storage/MemoryRepository.ts
  - src/search/VectorSearch.ts
autonomous: true
requirements:
  - CONTRA-04
  - CONTRA-06

must_haves:
  truths:
    - "Database schema extended with supersession fields"
    - "Supersession methods added to MemoryRepository"
    - "Conflict domain search added to VectorSearch"
    - "Migration from v1 to v2 defined"
  artifacts:
    - path: "src/storage/Database.ts"
      provides: "Database schema v2 with supersession tracking"
      min_lines: 80
      contains: "supersededAt", "deletedAt", "version(2)"
    - path: "src/storage/MemoryRepository.ts"
      provides: "Supersession and tombstone management methods"
      min_lines: 100
      exports: ["supersede", "findExpiredSuperseded", "stripToTombstone", "getSupersessionChain"]
    - path: "src/search/VectorSearch.ts"
      provides: "Conflict domain search for candidate retrieval"
      min_lines: 30
      exports: ["searchByConflictDomain"]
  key_links:
    - from: "src/storage/Database.ts"
      to: "IndexedDB"
      via: "Dexie version upgrade"
      pattern: "version\\(2\\)"
    - from: "src/storage/MemoryRepository.ts"
      to: "src/storage/Database.ts"
      via: "Database table access"
      pattern: "this\\.memories"
    - from: "src/search/VectorSearch.ts"
      to: "src/storage/MemoryRepository.ts"
      via: "Metadata lookup for conflict domain filtering"
      pattern: "metaCache"
---

# Plan 07-03a: Database Schema for Supersession

**Phase:** 7 (Extraction & Contradiction)
**Wave:** 3 (Integration)
**Autonomous:** Yes
**Estimated Duration:** 15 minutes

---

## Requirements

- **CONTRA-01**: Retrieve topK candidates (5-10) and evaluate any with similarity > 0.80; choose best typed-attribute match
- **CONTRA-04**: Typed attribute conflicts mark existing as superseded
- **CONTRA-06**: Supersession chains preserved (supersededBy, supersededAt)

---

## Goal

Extend the database schema and repository layer to support supersession tracking, tombstone management, and conflict domain search for contradiction detection.

---

## Tasks

### Task 1: Extend database schema for supersession

**File:** `src/storage/Database.ts`

Add `deletedAt` field and `supersededAt` index for cleanup:

```typescript
export interface DbMemoryRow {
  // ... existing fields ...

  /** When this memory was superseded (Unix ms) */
  supersededAt: number | null;

  /** When content was stripped for tombstone (Unix ms) */
  deletedAt: number | null;
}

export class LokulDatabase extends Dexie {
  constructor() {
    super('LokulMemDB');

    // Version 2: Add supersession tracking
    // CRITICAL: deletedAt is NOT in stores() string - it uses .and() filter in queries
    // This is intentional: deletedAt is a query filter, not an indexed lookup
    this.version(2)
      .stores({
        memories: `
          id,
          *types,
          status,
          clusterId,
          lastAccessedAt,
          baseStrength,
          validFrom,
          pinnedInt,
          mentionCount,
          [status+lastAccessedAt],
          [clusterId+status],
          [status+baseStrength],
          supersededAt
        `,
        episodes: 'id, startMemoryId, endMemoryId, createdAt',
        edges: 'id, sourceMemoryId, targetMemoryId, similarity, createdAt',
        clusters: 'id, createdAt',
      })
      .upgrade(async (trans) => {
        // Migration from v1 to v2
        const memories = trans.table('memories');
        await memories.toCollection().modify((memory) => {
          // Add supersession fields
          if (memory.supersededAt === undefined) {
            memory.supersededAt = null;
          }
          if (memory.deletedAt === undefined) {
            memory.deletedAt = null;
          }
        });
      });

    // Keep v1 for backward compatibility during migration
    this.version(1)
      .stores({
        memories: `
          id,
          *types,
          status,
          clusterId,
          lastAccessedAt,
          baseStrength,
          validFrom,
          pinnedInt,
          mentionCount,
          [status+lastAccessedAt],
          [clusterId+status],
          [status+baseStrength]
        `,
        episodes: 'id, startMemoryId, endMemoryId, createdAt',
        edges: 'id, sourceMemoryId, targetMemoryId, similarity, createdAt',
        clusters: 'id, createdAt',
      });
  }
}
```

**Done:** DbMemoryRow extended with supersededAt and deletedAt fields, LokulDatabase version 2 defined with supersededAt index, migration from v1 to v2 handles undefined fields.

---

### Task 2: Add supersession methods to MemoryRepository

**File:** `src/storage/MemoryRepository.ts`

Add supersession and tombstone management:

```typescript
export class MemoryRepository {
  // ... existing methods ...

  /**
   * Supersede a memory with a new version
   * Sets existing memory to 'superseded' status with metadata
   *
   * @param oldMemoryId - ID of memory to supersede
   * @param newMemoryId - ID of replacement memory
   */
  async supersede(oldMemoryId: string, newMemoryId: string): Promise<void> {
    const now = Date.now();
    await this.memories.update(oldMemoryId, {
      status: 'superseded',
      supersededBy: newMemoryId,
      supersededAt: now,
    });
  }

  /**
   * Find superseded memories older than 30 days
   * Used for tombstone cleanup
   *
   * @returns Array of superseded memories to strip
   */
  async findExpiredSuperseded(): Promise<MemoryInternal[]> {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return this.memories
      .where('supersededAt')
      .below(thirtyDaysAgo)
      .and((memory) => memory.status === 'superseded' && memory.deletedAt === null)
      .toArray();
  }

  /**
   * Strip memory content to create tombstone
   * Removes embedding and content, keeps metadata only
   *
   * CRITICAL: Keep minimal metadata for traceability:
   * - types, conflictDomain, supersededAt/by, validFrom/validTo
   * - sourceConversationIds, contentHash (for deduplication)
   * Do NOT strip all metadata to 0/[] - this destroys chain traceability
   *
   * @param memoryId - ID of memory to strip
   */
  async stripToTombstone(memoryId: string): Promise<void> {
    const memory = await this.memories.get(memoryId);
    if (!memory) return;

    const now = Date.now();
    await this.memories.update(memoryId, {
      // Strip heavy data
      content: '',
      embeddingBytes: new ArrayBuffer(0),
      // CRITICAL: Keep minimal metadata, not empty arrays
      entities: memory.entities, // Keep entities for chain traceability
      deletedAt: now,
      // Keep strength metadata for history
      currentStrength: 0,
      baseStrength: memory.baseStrength, // Keep original strength
      // Keep all other metadata intact
      types: memory.types,
      conflictDomain: memory.conflictDomain,
      supersededBy: memory.supersededBy,
      supersededAt: memory.supersededAt,
      validFrom: memory.validFrom,
      validTo: memory.validTo,
      sourceConversationIds: memory.sourceConversationIds,
      // Add contentHash for deduplication
      metadata: {
        ...memory.metadata,
        contentHash: this.hashContent(memory.content),
      },
    });
  }

  /**
   * Generate content hash for tombstone deduplication
   * @param content - Content to hash
   * @returns Hash string
   */
  private hashContent(content: string): string {
    // Simple hash - use crypto.subtle in production
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Get full supersession chain for a memory
   * Traces A -> B -> C relationships
   *
   * @param memoryId - Starting memory ID
   * @returns Array of memories in chain order
   */
  async getSupersessionChain(memoryId: string): Promise<MemoryInternal[]> {
    const chain: MemoryInternal[] = [];
    let currentId = memoryId;

    while (currentId) {
      const memory = await this.memories.get(currentId);
      if (!memory) break;

      chain.push(memory);

      // Follow supersededBy pointer forward
      if (memory.supersededBy) {
        currentId = memory.supersededBy;
      } else {
        break;
      }
    }

    return chain;
  }
}
```

**Done:** MemoryRepository has supersede(), findExpiredSuperseded(), stripToTombstone(), and getSupersessionChain() methods, all methods use correct IndexedDB queries.

---

### Task 3: Add conflict domain search to VectorSearch

**File:** `src/search/VectorSearch.ts`

Add search by conflict domain for candidate retrieval:

```typescript
export class VectorSearch {
  // ... existing code ...

  /**
   * Search memories within a conflict domain
   * Used for contradiction detection candidate retrieval
   *
   * @param query - Query text
   * @param conflictDomain - Conflict domain to filter
   * @param k - Number of candidates (default: 7)
   * @returns Array of search results with memory details
   */
  async searchByConflictDomain(
    query: string,
    conflictDomain: string,
    k: number = 7,
  ): Promise<Array<{ memoryId: string; similarity: number }>> {
    const queryEmbedding = await this.embeddingEngine.embed(query);

    // Build similarity map filtered by conflict domain
    const candidates: Array<{ memoryId: string; similarity: number }> = [];

    for (const [memoryId, memoryEmbedding] of this.cache) {
      const meta = this.metaCache.get(memoryId);
      if (!meta) continue;

      // CRITICAL FIX: Filter by conflict domain during iteration
      // conflictDomain MUST be in metaCache from Phase 5 init
      if (meta.conflictDomain !== conflictDomain) {
        continue;
      }

      const similarity = this.cosineSimilarity(queryEmbedding, memoryEmbedding);
      candidates.push({ memoryId, similarity });
    }

    // Sort by similarity descending
    candidates.sort((a, b) => b.similarity - a.similarity);

    return candidates.slice(0, k);
  }
}
```

**Done:** VectorSearch.searchByConflictDomain() returns top K candidates sorted by similarity, uses cosine similarity for matching, slices results to k limit.

---

## Success Criteria

1. **Database schema v2** adds supersededAt and deletedAt fields
2. **Migration from v1 to v2** handles undefined fields safely
3. **Supersession methods** handle status changes, tombstone creation, and chain tracing
4. **Conflict domain search** returns candidate memories for contradiction detection

---

## Notes

- **Schema migration:** Version 2 adds supersession fields while maintaining v1 for backward compatibility
- **Tombstone retention:** 30-day retention period balances traceability with storage efficiency
- **Supersession chain tracing:** Follows supersededBy pointers forward through history

### REVISION FIXES (2026-02-25)

**Issue 1: Database schema missing deletedAt in stores()**
- Fix: Added comment documenting that `deletedAt` is intentionally NOT in stores() string. It uses `.and()` filter in queries (e.g., `.and((memory) => memory.deletedAt === null)`). This is intentional: deletedAt is a query filter, not an indexed lookup.

**Issue 2: Tombstone semantics destroy metadata**
- Fix: Changed stripToTombstone() to keep minimal metadata (types, conflictDomain, supersededAt/by, validFrom/validTo, sourceConversationIds, contentHash) instead of stripping all to 0/[]. Added hashContent() method and contentHash tracking for deduplication. Original implementation destroyed traceability.

**Issue 3: VectorSearch.searchByConflictDomain not implemented**
- Fix: Added actual conflict domain filtering in the loop: `if (meta.conflictDomain !== conflictDomain) continue;`. Note that conflictDomain must be in metaCache from Phase 5 init. Original implementation claimed to filter but returned all similarities.
