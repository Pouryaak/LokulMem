# Phase 3: Storage Layer - Research

**Researched:** 2026-02-23
**Domain:** IndexedDB with Dexie.js, browser storage patterns
**Confidence:** HIGH

## Summary

Phase 3 establishes the IndexedDB storage layer using Dexie.js as the wrapper library. The research confirms Dexie.js is the appropriate choice for this project, with excellent TypeScript support, robust migration capabilities, and efficient handling of binary data (ArrayBuffer/Float32Array) for embeddings.

Key findings:
1. **Dexie.js v3/v4** provides all required features: compound indexes, schema versioning, transactions, and bulk operations
2. **Float32Array storage** requires conversion to ArrayBuffer with explicit byteOffset/byteLength handling to avoid TypedArray view footguns
3. **Schema migrations** use Dexie's built-in versioning with `.upgrade()` callbacks for data transformation
4. **Error handling** must specifically catch `Dexie.QuotaExceededError` for storage pressure and implement read-only fallback

**Primary recommendation:** Use Dexie.js class-based TypeScript pattern with explicit schema definition in constructor, implement toDbFormat/fromDbFormat conversion methods for embeddings, and establish migration chain starting at v1 with all 4 stores (memories, episodes, edges, clusters).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Index strategy:**
- All indexes in v1 upfront (not incrementally)
- All compound indexes: [type, status], [status, lastAccessedAt], [clusterId, status], [status, baseStrength]
- Range support for timestamps and strength (full range queries <, >, between)
- Equality-only for id, types, status, clusterId, pinned
- Index validFrom for temporal queries
- Index mentionCount for database-level sorting

**Schema evolution:**
- Use Dexie migrations with version increments and upgrade functions
- Create all 4 stores in v1: memories, episodes, edges, clusters
- Repair mode for migration failures (recover valid data, quarantine corrupted)
- Expose getDbVersion() API for debugging
- Best-effort migration (validate and skip malformed records)

**Float32Array handling:**
- Store as ArrayBuffer with explicit slice: `embedding.buffer.slice(embedding.byteOffset, embedding.byteOffset + embedding.byteLength)`
- Reconstruct on read: `new Float32Array(embeddingBytes)`
- Explicit conversion methods: toDbFormat() / fromDbFormat() — visible and testable
- Validate dimension on read (384 for MiniLM-L6-v2)
- Hybrid loading strategy: preload active embeddings up to cap, then on-demand

**Error handling:**
- Enter read-only mode on quota exceeded
- Reset + backup on corruption (attempt export before wipe)
- Both immediate callback (onStorageError) AND status object (getStatus())

### Claude's Discretion

- Exact cap threshold for hybrid embedding loading
- Specific implementation of repair mode (quarantine format, recovery heuristics)
- Detailed status object structure
- Compound index ordering priorities

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STORAGE-01 | Dexie.js schema v1 with memories, episodes, edges, clusters stores | Dexie Version.stores() supports multiple stores; class-based pattern recommended |
| STORAGE-02 | Memories table has all required indexes (id, types, status, clusterId, lastAccessedAt, baseStrength, validFrom, pinned, mentionCount, compound indexes) | Compound index syntax: `[prop1+prop2]`; multi-entry with `*types` for array indexing |
| STORAGE-03 | Embedding field stored as Float32Array | Store as ArrayBuffer, reconstruct with new Float32Array(); validate 384 dimensions |
| STORAGE-04 | Schema migration chain established for future versions | Dexie migration chain via sequential .version(n) calls with .upgrade() callbacks |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| dexie | ^4.0.0 | IndexedDB wrapper with TypeScript | Most popular IndexedDB wrapper, active maintenance, excellent TS support, compound indexes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none required) | — | Dexie provides all needed functionality | — |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dexie.js | Raw IndexedDB | 10x more code, no migrations, no TypeScript safety, no compound index abstraction |
| Dexie.js | idb (Jake Archibald) | Smaller but less feature-rich; no built-in migration system |
| Dexie.js | localForage | Simpler API but no indexing, no compound queries, poor TypeScript support |

**Installation:**
```bash
npm install dexie
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── storage/
│   ├── Database.ts          # Dexie subclass with schema definition
│   ├── MemoryRepository.ts  # CRUD operations for memories
│   ├── EpisodeRepository.ts # CRUD operations for episodes
│   ├── EdgeRepository.ts    # CRUD operations for edges
│   ├── ClusterRepository.ts # CRUD operations for clusters
│   ├── embeddingStorage.ts  # Float32Array <-> ArrayBuffer conversion
│   └── migrations/          # Migration functions by version
│       ├── v1.ts
│       └── v2.ts
```

### Pattern 1: Class-Based Dexie Database
**What:** Extend Dexie class with typed tables and schema definition
**When to use:** All Dexie.js projects for type safety
**Example:**
```typescript
// Source: https://dexie.org/docs/Typescript
import Dexie, { Table } from 'dexie';
import type { MemoryInternal } from '../internal/types.js';

export class LokulDatabase extends Dexie {
  memories!: Table<MemoryInternal, string>;
  episodes!: Table<EpisodeInternal, string>;
  edges!: Table<EdgeInternal, string>;
  clusters!: Table<ClusterInternal, string>;

  constructor() {
    super('LokulMemDB');

    this.version(1).stores({
      memories: 'id, *types, status, clusterId, lastAccessedAt, baseStrength, validFrom, pinned, mentionCount, [type+status], [status+lastAccessedAt], [clusterId+status], [status+baseStrength]',
      episodes: 'id, startMemoryId, endMemoryId, createdAt',
      edges: 'id, sourceMemoryId, targetMemoryId, similarity, createdAt',
      clusters: 'id, createdAt'
    });
  }
}
```

### Pattern 2: Embedding Conversion with Explicit Slice
**What:** Convert Float32Array to ArrayBuffer for storage, reconstruct on read
**When to use:** All TypedArray storage to avoid view footguns
**Example:**
```typescript
// Source: Dexie.js docs on binary data + user constraints
const EMBEDDING_DIM = 384; // MiniLM-L6-v2

export function toDbFormat(embedding: Float32Array): ArrayBuffer {
  // Explicit slice to avoid view footguns with underlying buffer
  return embedding.buffer.slice(
    embedding.byteOffset,
    embedding.byteOffset + embedding.byteLength
  );
}

export function fromDbFormat(buffer: ArrayBuffer): Float32Array {
  const view = new Float32Array(buffer);
  if (view.length !== EMBEDDING_DIM) {
    throw new Error(`Invalid embedding dimension: ${view.length}, expected ${EMBEDDING_DIM}`);
  }
  return view;
}
```

### Pattern 3: Schema Migration Chain
**What:** Sequential version definitions with upgrade callbacks
**When to use:** All schema evolution
**Example:**
```typescript
// Source: https://dexie.org/docs/Version/Version
export class LokulDatabase extends Dexie {
  constructor() {
    super('LokulMemDB');

    // v1: Initial schema
    this.version(1).stores({
      memories: 'id, *types, status, ...',
      episodes: 'id, ...',
      edges: 'id, ...',
      clusters: 'id, ...'
    });

    // v2: Future migration example
    this.version(2).stores({
      memories: 'id, *types, status, ..., newField'
    }).upgrade(async (trans) => {
      // Migration logic
      await trans.table('memories').toCollection().modify(memory => {
        memory.newField = defaultValue;
      });
    });
  }
}
```

### Pattern 4: Error Handling with Specific Dexie Errors
**What:** Catch specific Dexie error types for different recovery strategies
**When to use:** All database operations that might fail
**Example:**
```typescript
// Source: https://dexie.org/docs/API-Reference
import Dexie from 'dexie';

async function safeDbOperation<T>(
  operation: () => Promise<T>,
  onQuotaExceeded: () => void,
  onCorruption: () => void
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Dexie.QuotaExceededError) {
      onQuotaExceeded();
      return null;
    }
    if (error instanceof Dexie.DatabaseClosedError ||
        error instanceof Dexie.OpenFailedError) {
      onCorruption();
      return null;
    }
    throw error;
  }
}
```

### Anti-Patterns to Avoid

**Storing Float32Array directly:** IndexedDB can store TypedArrays but Dexie's type system works better with ArrayBuffer. Always convert explicitly.

**Using full buffer without slice:** Float32Array may be a view into a larger ArrayBuffer. Always use `.buffer.slice(byteOffset, byteOffset + byteLength)`.

**Incremental index addition:** Adding indexes incrementally triggers full table rebuilds. Define all indexes upfront in v1 as specified.

**Catching generic Error only:** Dexie provides specific error types. Catch `Dexie.QuotaExceededError` specifically for storage handling.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB migrations | Custom version tracking | Dexie.version().upgrade() | Handles transaction scope, rollback, schema diffing |
| Compound index queries | Manual filtering | Dexie `[prop1+prop2]` syntax | Native IndexedDB performance, proper key range optimization |
| Array field indexing | JSON.stringify workaround | Dexie `*field` multi-entry | Native IndexedDB multiEntry indexes |
| Transaction management | Manual IDBTransaction | Dexie.transaction() | Automatic scope management, promise integration |
| Bulk operations | Promise.all([...add()]) | Dexie.bulkAdd()/bulkPut() | Single transaction, better performance |
| Database versioning | Custom version storage | Dexie.verno property | Built-in version tracking |

**Key insight:** IndexedDB's API is verbose and error-prone. Dexie abstracts away transaction lifetime management, request callbacks, and cursor iteration. The migration system alone saves hundreds of lines of complex upgrade logic.

---

## Common Pitfalls

### Pitfall 1: Float32Array View Footgun
**What goes wrong:** Storing `float32array.buffer` directly when the TypedArray is a view into a larger buffer causes data corruption or extra bytes.
**Why it happens:** TypedArrays can be views into shared ArrayBuffers with different offsets.
**How to avoid:** Always use `.buffer.slice(byteOffset, byteOffset + byteLength)` to extract exact bytes.
**Warning signs:** Embeddings have wrong dimensions on read, similarity scores are garbage.

### Pitfall 2: Missing Multi-Entry Index for Arrays
**What goes wrong:** Querying `types` array field without multi-entry index requires full table scan.
**Why it happens:** Regular indexes treat arrays as single values.
**How to avoid:** Use `*types` in schema definition for multi-entry indexing.
**Warning signs:** Queries on array fields are slow even with "index".

### Pitfall 3: QuotaExceededError Not Caught
**What goes wrong:** App crashes when storage is full instead of gracefully degrading to read-only.
**Why it happens:** Generic error handling doesn't catch Dexie-specific error types.
**How to avoid:** Specifically catch `Dexie.QuotaExceededError` and set read-only mode.
**Warning signs:** Users report data loss, app becomes unresponsive.

### Pitfall 4: Migration Transaction Timeout
**What goes wrong:** Large data migrations fail with timeout because upgrade function takes too long.
**Why it happens:** IndexedDB upgrade transactions have implicit timeouts.
**How to avoid:** Process migrations in batches, use `trans` object for chunked processing.
**Warning signs:** "Transaction inactive" errors during upgrade.

### Pitfall 5: Compound Index Order Mismatch
**What goes wrong:** Query `where('[status+lastAccessedAt]').equals(['active', Date.now()])` fails to use index efficiently.
**Why it happens:** Compound index order matters for range queries.
**How to avoid:** Define compound indexes with most selective field first for equality queries.
**Warning signs:** Queries are slow despite compound index existing.

---

## Code Examples

### Complete Database Class Definition
```typescript
// Source: Dexie.js docs + project requirements
import Dexie, { Table } from 'dexie';
import type { MemoryInternal, EpisodeInternal, EdgeInternal } from '../internal/types.js';

// ClusterInternal type (needs to be defined)
interface ClusterInternal {
  id: string;
  centroid: Float32Array;
  memoryIds: string[];
  createdAt: number;
}

export class LokulDatabase extends Dexie {
  memories!: Table<MemoryInternal, string>;
  episodes!: Table<EpisodeInternal, string>;
  edges!: Table<EdgeInternal, string>;
  clusters!: Table<ClusterInternal, string>;

  constructor() {
    super('LokulMemDB');

    // v1: Complete schema with all indexes upfront
    this.version(1).stores({
      memories: `
        id,
        *types,
        status,
        clusterId,
        lastAccessedAt,
        baseStrength,
        validFrom,
        pinned,
        mentionCount,
        [type+status],
        [status+lastAccessedAt],
        [clusterId+status],
        [status+baseStrength]
      `,
      episodes: 'id, startMemoryId, endMemoryId, createdAt',
      edges: 'id, sourceMemoryId, targetMemoryId, similarity, createdAt',
      clusters: 'id, createdAt'
    });
  }

  async getVersion(): Promise<number> {
    await this.open();
    return this.verno;
  }
}
```

### Embedding Storage with Validation
```typescript
// Source: User constraints + Dexie binary data patterns
const EXPECTED_DIM = 384;

export interface DbMemoryRow {
  // ... other fields
  embeddingBytes: ArrayBuffer;
}

export function memoryToDb(memory: MemoryInternal): DbMemoryRow {
  return {
    ...memory,
    embeddingBytes: toDbFormat(memory.embedding),
  };
}

export function memoryFromDb(row: DbMemoryRow): MemoryInternal {
  return {
    ...row,
    embedding: fromDbFormat(row.embeddingBytes),
  };
}

function toDbFormat(embedding: Float32Array): ArrayBuffer {
  return embedding.buffer.slice(
    embedding.byteOffset,
    embedding.byteOffset + embedding.byteLength
  );
}

function fromDbFormat(buffer: ArrayBuffer): Float32Array {
  const view = new Float32Array(buffer);
  if (view.length !== EXPECTED_DIM) {
    throw new Error(
      `Embedding dimension mismatch: ${view.length} != ${EXPECTED_DIM}`
    );
  }
  return view;
}
```

### Repository Pattern for Type-Safe Access
```typescript
// Source: Dexie Table API patterns
export class MemoryRepository {
  constructor(private db: LokulDatabase) {}

  async findByTypeAndStatus(
    type: MemoryType,
    status: MemoryStatus
  ): Promise<MemoryInternal[]> {
    return this.db.memories
      .where('[type+status]')
      .equals([type, status])
      .toArray();
  }

  async findActiveByRecency(limit: number): Promise<MemoryInternal[]> {
    return this.db.memories
      .where('[status+lastAccessedAt]')
      .between(['active', 0], ['active', Date.now()])
      .reverse()
      .limit(limit)
      .toArray();
  }

  async bulkCreate(memories: MemoryInternal[]): Promise<void> {
    const rows = memories.map(memoryToDb);
    await this.db.memories.bulkAdd(rows);
  }
}
```

### Error Handling with Status Tracking
```typescript
// Source: Dexie error types + user requirements
interface StorageStatus {
  isReadOnly: boolean;
  lastError: string | null;
  dbVersion: number;
}

export class StorageManager {
  private status: StorageStatus = {
    isReadOnly: false,
    lastError: null,
    dbVersion: 0,
  };

  private onStorageError?: (error: Error) => void;

  constructor(
    private db: LokulDatabase,
    options: { onStorageError?: (error: Error) => void }
  ) {
    this.onStorageError = options.onStorageError;
  }

  async initialize(): Promise<void> {
    try {
      await this.db.open();
      this.status.dbVersion = this.db.verno;
    } catch (error) {
      this.handleStorageError(error as Error);
      throw error;
    }
  }

  private handleStorageError(error: Error): void {
    this.status.lastError = error.message;

    if (error instanceof Dexie.QuotaExceededError) {
      this.status.isReadOnly = true;
    }

    this.onStorageError?.(error);
  }

  getStatus(): StorageStatus {
    return { ...this.status };
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw IndexedDB | Dexie.js wrapper | 2014+ | 90% code reduction, migration support |
| Manual schema versioning | Dexie.version() chain | Dexie 1.0 | Declarative migrations, automatic rollback |
| JSON.stringify for arrays | Multi-entry indexes | IndexedDB 2.0 | Native array indexing, query performance |
| Blob for binary | ArrayBuffer/TypedArray | IndexedDB 2.0 | Better WASM interop, no serialization cost |

**Deprecated/outdated:**
- WebSQL: Removed from Chrome, deprecated standard
- localStorage for structured data: 5MB limit, no indexing, synchronous
- Cookies: Never appropriate for client-side data storage

---

## Open Questions

1. **Repair Mode Implementation Details**
   - What we know: Need to quarantine corrupted data, recover valid data
   - What's unclear: Exact quarantine format (separate table? JSON export?)
   - Recommendation: Start with JSON export of corrupted records, implement quarantine table in v2 if needed

2. **Hybrid Loading Cap Threshold**
   - What we know: Preload active embeddings up to cap, then on-demand
   - What's unclear: Exact number (100? 500? 1000?)
   - Recommendation: Start with 500, make configurable, benchmark in Phase 5

3. **Compound Index Ordering for Range Queries**
   - What we know: Order matters for compound index efficiency
   - What's unclear: Whether [status+lastAccessedAt] or [lastAccessedAt+status] is better for "active memories accessed in last 7 days"
   - Recommendation: Use [status+lastAccessedAt] — equality first (status='active'), then range (lastAccessedAt > X)

---

## Sources

### Primary (HIGH confidence)
- Context7 /websites/dexie - Schema definition, Version.stores(), compound indexes, migrations, error types, transactions, bulk operations
- https://dexie.org/docs/Version/Version - Schema versioning API
- https://dexie.org/docs/Typescript - TypeScript patterns
- https://dexie.org/docs/Compound-Index - Compound index syntax and usage
- https://dexie.org/docs/API-Reference - Error types, binary data storage

### Secondary (MEDIUM confidence)
- https://dexie.org/docs/Tutorial/Best-Practices - Transaction patterns

### Tertiary (LOW confidence)
- None — all findings verified with official Dexie documentation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Dexie is clearly the standard, verified with Context7
- Architecture: HIGH - Patterns from official Dexie TypeScript docs
- Pitfalls: HIGH - Verified with Dexie error documentation and IndexedDB spec

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (Dexie is stable, 30-day validity appropriate)
