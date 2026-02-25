# Phase 7: Extraction & Contradiction - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract facts from conversations with quality scoring, detect contradictions, and manage supersession chains. This phase implements the extraction pipeline that evaluates what's worth remembering, classifies memories by type, extracts entities, detects conflicts, and handles temporal updates.

**Scope:** Extraction quality scoring, contradiction detection, entity extraction, and supersession chain management. Public API methods (augment, learn, manage) are Phase 8.

</domain>

<decisions>
## Implementation Decisions

### Extraction quality thresholds

- **Default threshold:** E(s) ≥ 0.55 (moderate - balanced for general use)
- **Configurable:** Yes - expose `extractionThreshold` in LokulMem constructor
- **Type-specific thresholds:** Yes - stricter for identity facts (names, locations), more lenient for preferences/emotional states
- **Below-threshold handling:** Three bands:
  - E(s) < 0.40 → discard silently (noise)
  - 0.40 ≤ E(s) < threshold → discard (optional: log as "candidate" in debug mode without persistence)
  - E(s) ≥ threshold → store as memory
- **Novelty scoring:** Keep novelty component (0.35 weight) and make it configurable
- **Minimum novelty gate:** Require novelty ≥ 0.15 (configurable) to prevent near-duplicates even if specificity is high
- **Overall approach:** Single E(s) threshold (default 0.55) + optional minimum novelty gate (default 0.15, configurable)
- **Edge case logging:** Log all extraction scores and threshold decisions when debug mode enabled
- **Novelty computation requirement:** MUST use `vectorSearch.search(embed(s), k=1)` from Phase 5 to avoid redundant O(N) loops

### Contradiction detection sensitivity

- **Similarity threshold:** Cosine ≥ 0.80 (moderate - catches conflicts without over-flagging)
- **Candidate retrieval:** 7 candidates (balanced performance vs thoroughness)
- **Resolution mode:** Configurable - support both manual resolution (user chooses) and auto-resolution (typed-attribute matching)
- **Type restriction:** Conflict-domain based - check contradictions within same conflict domain, not exact memory type:
  - Conflict domains: `'identity'`, `'location'`, `'preference'`, `'temporal'`, `'relational'`, `'emotional'`, `'profession'`, `'project'`
  - Example: "I live in Berlin" (location) conflicts with "My address is..." (identity) if both map to `'location'` domain
  - Prevents false positives while catching cross-type conflicts that matter
- **Temporal marker handling:** When temporal marker detected but no contradiction found, emit passive event only (no action)
- **Supersession aggressiveness:** Type-specific behavior - auto-supersede identity/location facts, prefer parallel for others unless explicit temporal marker
- **Detection timing:** Run contradiction detection synchronously during every `learn()` call (not batched)

### Entity extraction granularity

- **Extraction scope:** Full extraction - all specificity NER types from requirements (names, places, numbers, preferences, dates, negations, first-person possession)
- **Extraction approach:** Lightweight rule-based (regex and keyword patterns) - fast, no ML dependencies
- **Storage format:** Typed entities with structure - `{ type, value, count, confidence? }`
- **Date normalization:** Both raw string and normalized ISO format stored
- **Deduplication:** Unique entities with mention count (track how many times each entity appears)
- **Preference handling:** Structured form - parse to `{ pref: 'coffee', polarity: +1 }` rather than raw text
- **Position tracking:** No - don't store character offsets (reduces storage overhead)

### Supersession chain behavior

- **Retention period:** 30-day tombstone retention:
  - Day 0-30: Superseded memory kept with full content (searchable with flag)
  - After 30 days: Strip embedding and content, keep tombstone record only
  - Tombstone fields: `{ id, status: 'superseded', supersededBy, supersededAt, supersedesId, type, deletedAt }`
  - Preserves full chain traceability (A → B → C) while minimizing storage bloat
- **Chain tracking:** Full chain tracking via tombstones - trace entire history even after content stripped
- **Search visibility:** Searchable with flag - superseded memories excluded from default searches but accessible with explicit filter
- **Status representation:** New distinct status: `'superseded'` (separate from `'faded'` or `'archived'`)
- **Event emission:** Yes - emit `onMemorySuperseded` callback when memory is superseded
- **Reversibility:** No - supersession is one-way only (users can re-learn if needed)
- **Event content:** IDs and metadata only - full content retrievable via `manage().get()` if needed
- **Entity handling:** Keep separate - entities are tied to specific memory, not merged across supersession

### Claude's Discretion

- Exact regex patterns for each entity type (names, places, dates, preferences, negations, first-person possession)
- Specificity scoring algorithm implementation (NER pattern matching and weighting)
- Recurrence tracking mechanism (cosine > 0.85 threshold within session)
- Temporal marker pattern matching (16 patterns from requirements)
- Typed-attribute matching algorithm for contradiction resolution
- Default type-specific threshold values (concrete numbers for identity vs preference)
- Event callback signature and payload structure
- Conflict domain mapping (which MemoryType maps to which conflict domain)

### Required Schema Updates (IndexedDB / Dexie)

**New fields on memories store:**
- `supersededBy: string | null` - ID of memory that superseded this one
- `supersededAt: number | null` - Timestamp when superseded
- `deletedAt: number | null` - Timestamp when content was stripped (tombstone creation)
- `conflictDomain: string` - Conflict domain for contradiction checking ('identity', 'location', etc.)

**New index:**
- `supersededAt` index for cleanup job (find superseded memories older than 30 days)

**Status enum updates:**
- Add `'superseded'` to status field (already indexed)

**Tombstone record structure:**
```
{
  id: string,
  status: 'superseded',
  type: MemoryType,
  supersededBy: string,
  supersededAt: number,
  supersedesId: string | null,
  deletedAt: number,
  conflictDomain: string
  // embedding and content fields removed/null
}
```

### Extensibility Note

Extraction interfaces should remain clean to support future plug-in extractors (LLM-assisted or custom logic). Current rule-based approach is v0.1; architecture should allow swapping extraction strategies without major refactoring.

</decisions>

<specifics>
## Specific Ideas

- Extraction should be "picky enough to avoid noise but permissive enough to catch nuanced facts"
- Contradiction detection should be "balanced - catch real conflicts without flagging every minor variation"
- Entity extraction should be "lightweight and fast - no heavy ML models, just solid regex patterns"
- Supersession chains should be "fully traceable but auto-cleanup after 30 days to avoid storage bloat"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-extraction-contradiction*
*Context gathered: 2026-02-25*
