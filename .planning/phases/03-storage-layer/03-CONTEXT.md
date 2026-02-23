# Phase 3: Storage Layer - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

IndexedDB schema is established with all required stores, indexes, and migration support for memory persistence. This phase creates the data layer that stores memories, episodes, edges, and clusters using Dexie.js.

</domain>

<decisions>
## Implementation Decisions

### Index strategy

- **All indexes in v1 upfront**: Create all indexes specified in requirements — id, types, status, clusterId, lastAccessedAt, baseStrength, validFrom, pinned, mentionCount — rather than adding incrementally
- **All three compound indexes**: [type, status], [status, lastAccessedAt], [clusterId, status], [status, baseStrength]
- **Range support for timestamps and strength**: Full range queries (<, >, between) for lastAccessedAt, validFrom, and baseStrength fields
- **Equality-only for others**: id, types, status, clusterId, pinned use exact match
- **Index validFrom for temporal queries**: Enable efficient querying of memories valid at specific times
- **Index mentionCount**: Database-level index for "most mentioned" sorting, not in-memory only

### Schema evolution

- **Use Dexie migrations**: Leverage Dexie's built-in migration system with version increments and upgrade functions
- **Create all 4 stores in v1**: memories, episodes, edges, clusters — even though episodes, edges, clusters are v2 features
- **Repair mode for migration failures**: Attempt to recover valid data, quarantine corrupted data for user review
- **Expose getDbVersion() API**: Users can query current schema version for debugging
- **Best-effort migration**: Validate and skip individual malformed records, migrate valid data

### Float32Array handling

- **Store as ArrayBuffer with explicit slice**: Use `embedding.buffer.slice(embedding.byteOffset, embedding.byteOffset + embedding.byteLength)`
- **Reconstruct on read**: `new Float32Array(embeddingBytes)` when loading from storage
- **Explicit conversion methods**: toDbFormat() / fromDbFormat() methods — visible and testable, not automatic hooks
- **Validate dimension on read**: Enforce expected dimension (384 for MiniLM-L6-v2) and throw error on mismatch
- **Hybrid loading strategy**: Preload active embeddings at startup up to a cap, otherwise incremental/on-demand loading

### Error handling

- **Enter read-only mode on quota exceeded**: Library continues working but can't create new memories
- **Reset + backup on corruption**: Attempt to save export before wiping, then reset to empty state
- **Both immediate callback and status object**: onStorageError callback for immediate notification AND getStatus() object for persistent state checking

### Claude's Discretion

- Exact cap threshold for hybrid embedding loading
- Specific implementation of repair mode (quarantine format, recovery heuristics)
- Detailed status object structure
- Compound index ordering priorities

</decisions>

<specifics>
## Specific Ideas

- "Store raw bytes (ArrayBuffer) for embeddings — most space/CPU efficient vs number[]"
- "Avoid TypedArray view footguns: store exact slice, not full underlying buffer"
- "Hybrid loading: preload active up to cap, then on-demand"
- "Repair mode should quarantine corrupted data, not just delete it"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-storage-layer*
*Context gathered: 2026-02-23*
