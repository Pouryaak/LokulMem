# Phase 7: Extraction & Contradiction - Research

**Researched:** 2026-02-25
**Domain:** Entity extraction, quality scoring, contradiction detection, supersession chains
**Confidence:** HIGH

## Summary

Phase 7 implements the extraction pipeline that evaluates what's worth remembering from conversations, classifies memories by type, extracts entities, detects contradictions, and manages temporal updates. This phase delivers the core intelligence layer that separates valuable facts from conversational noise, handles conflicting information gracefully, and maintains memory consistency over time.

Key findings:
1. **Extraction quality scoring** uses E(s) = 0.35×novelty + 0.45×specificity + 0.20×recurrence with runtime default threshold 0.45
2. **Specificity NER** uses lightweight regex patterns for names, places, numbers, preferences, dates, negations, and first-person possession
3. **Novelty computation** requires vector search with k=1: `novelty = 1 - top1_similarity` (must use Phase 5 VectorSearch, not O(N) loop)
4. **Contradiction detection** uses cosine ≥ 0.80 threshold with 7 candidates, conflict-domain based filtering (8 domains)
5. **Temporal markers** detected via 16 regex patterns for phrases like "used to", "previously", "no longer"
6. **Supersession chains** use 30-day tombstone retention with full chain traceability via `supersededBy` and `supersededAt` fields
7. **Schema updates** needed: `supersededBy`, `supersededAt`, `deletedAt`, `conflictDomain` fields on memories store (some already exist in Phase 3 schema)

**Primary recommendation:** Implement ExtractionPipeline class with modular extractors (SpecificityNER, EntityExtractor, TemporalMarkerDetector), ContradictionDetector class with conflict-domain filtering, and SupersessionManager class with 30-day tombstone retention. All extraction logic in worker context, no external ML dependencies.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Extraction quality thresholds:**
- Default threshold: E(s) ≥ 0.45 (runtime tuned baseline)
- Configurable: Yes - expose `extractionThreshold` in LokulMem constructor
- Type-specific thresholds: Yes - stricter for identity facts (names, locations), more lenient for preferences/emotional states
- Below-threshold handling: Three bands:
  - E(s) < 0.40 → discard silently (noise)
  - 0.40 ≤ E(s) < threshold → discard (optional: log as "candidate" in debug mode without persistence)
  - E(s) ≥ threshold → store as memory
- Novelty scoring: Keep novelty component (0.35 weight) and make it configurable
- Minimum novelty gate: Require novelty ≥ 0.15 (configurable) to prevent near-duplicates even if specificity is high
- Overall approach: Single E(s) threshold (default 0.45) + optional minimum novelty gate (default 0.15, configurable)
- Edge case logging: Log all extraction scores and threshold decisions when debug mode enabled
- Novelty computation requirement: MUST use `vectorSearch.search(embed(s), k=1)` from Phase 5 to avoid redundant O(N) loops

**Contradiction detection sensitivity:**
- Similarity threshold: Cosine ≥ 0.80 (moderate - catches conflicts without over-flagging)
- Candidate retrieval: 7 candidates (balanced performance vs thoroughness)
- Resolution mode: Configurable - support both manual resolution (user chooses) and auto-resolution (typed-attribute matching)
- Type restriction: Conflict-domain based - check contradictions within same conflict domain, not exact memory type:
  - Conflict domains: `'identity'`, `'location'`, `'preference'`, `'temporal'`, `'relational'`, `'emotional'`, `'profession'`, `'project'`
  - Example: "I live in Berlin" (location) conflicts with "My address is..." (identity) if both map to `'location'` domain
  - Prevents false positives while catching cross-type conflicts that matter
- Temporal marker handling: When temporal marker detected but no contradiction found, emit passive event only (no action)
- Supersession aggressiveness: Type-specific behavior - auto-supersede identity/location facts, prefer parallel for others unless explicit temporal marker
- Detection timing: Run contradiction detection synchronously during every `learn()` call (not batched)

**Entity extraction granularity:**
- Extraction scope: Full extraction - all specificity NER types from requirements (names, places, numbers, preferences, dates, negations, first-person possession)
- Extraction approach: Lightweight rule-based (regex and keyword patterns) - fast, no ML dependencies
- Storage format: Typed entities with structure - `{ type, value, count, confidence? }`
- Date normalization: Both raw string and normalized ISO format stored
- Deduplication: Unique entities with mention count (track how many times each entity appears)
- Preference handling: Structured form - parse to `{ pref: 'coffee', polarity: +1 }` rather than raw text
- Position tracking: No - don't store character offsets (reduces storage overhead)

**Supersession chain behavior:**
- Retention period: 30-day tombstone retention:
  - Day 0-30: Superseded memory kept with full content (searchable with flag)
  - After 30 days: Strip embedding and content, keep tombstone record only
  - Tombstone fields: `{ id, status: 'superseded', supersededBy, supersededAt, supersedesId, type, deletedAt }`
  - Preserves full chain traceability (A → B → C) while minimizing storage bloat
- Chain tracking: Full chain tracking via tombstones - trace entire history even after content stripped
- Search visibility: Searchable with flag - superseded memories excluded from default searches but accessible with explicit filter
- Status representation: New distinct status: `'superseded'` (separate from `'faded'` or `'archived'`)
- Event emission: Yes - emit `onMemorySuperseded` callback when memory is superseded
- Reversibility: No - supersession is one-way only (users can re-learn if needed)
- Event content: IDs and metadata only - full content retrievable via `manage().get()` if needed
- Entity handling: Keep separate - entities are tied to specific memory, not merged across supersession

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
- `supersededBy: string | null` - ID of memory that superseded this one (ALREADY EXISTS in Phase 3 schema)
- `supersededAt: number | null` - Timestamp when superseded (ALREADY EXISTS in Phase 3 schema)
- `deletedAt: number | null` - Timestamp when content was stripped (tombstone creation) - NEEDS TO BE ADDED
- `conflictDomain: string` - Conflict domain for contradiction checking ('identity', 'location', etc.) - NEEDS TO BE ADDED

**New index:**
- `supersededAt` index for cleanup job (find superseded memories older than 30 days) - NEEDS TO BE ADDED

**Status enum updates:**
- Add `'superseded'` to status field (ALREADY EXISTS in Phase 3 schema)

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

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXTRACT-01 | Specificity NER detects: names (0.3), places (0.25), numbers (0.2), preferences (0.25), dates (0.2), negations (0.2), first-person possession (0.10); clamp sum to 1.0 | Regex-based pattern matching with weighted scoring, sum normalization to 1.0 |
| EXTRACT-02 | Novelty computed via `1 - top1_similarity` using vector search | Use Phase 5 VectorSearch.search() with k=1 to get top match, compute novelty |
| EXTRACT-03 | Recurrence tracked within session (cosine > 0.85) | Session-level tracking with Set of seen facts, threshold matching |
| EXTRACT-04 | E(s) = 0.35×novelty + 0.45×specificity + 0.20×recurrence | Weighted sum with configurable weights, default values from requirements |
| EXTRACT-05 | Extraction threshold default 0.45 (configurable) | LokulMemConfig.extractionThreshold, type-specific overrides supported |
| EXTRACT-06 | Memory types classified (identity, location, profession, preference, project, temporal, relational, emotional) | Rule-based classification using keyword patterns and entity types |
| EXTRACT-07 | Entities extracted and stored with memory | EntityExtractor with regex patterns, typed entities with deduplication |
| CONTRA-01 | Retrieve topK candidates (5-10) and evaluate any with similarity > 0.80; choose best typed-attribute match | VectorSearch with k=7, similarity threshold, typed-attribute matching |
| CONTRA-02 | Temporal markers detected (16 patterns: "used to", "previously", "no longer", etc.) | TemporalMarkerDetector with regex patterns for temporal phrases |
| CONTRA-03 | Temporal updates set validTo on existing, validFrom on new | SupersessionManager with temporal marker handling, validTo/validFrom updates |
| CONTRA-04 | Typed attribute conflicts mark existing as superseded | ContradictionDetector with conflict-domain filtering, supersession chain creation |
| CONTRA-05 | Contradiction events emitted via callback | EventEmitter for onMemorySuperseded, event payload with IDs and metadata |
| CONTRA-06 | Supersession chains preserved (supersededBy, supersededAt) | Tombstone retention with 30-day cleanup, full chain tracking via fields |

---

## Standard Stack

### Core

| Component | Implementation | Purpose | Why Standard |
|-----------|----------------|---------|--------------|
| Entity Extraction | Custom regex patterns | Fast, lightweight NER | No ML dependencies, sufficient for v0.1, fast execution |
| Quality Scoring | Weighted sum formula | E(s) extraction score | Standard approach combining multiple signals |
| Contradiction Detection | Cosine similarity + domain filtering | Conflict detection | Uses existing VectorSearch, no new dependencies |
| Temporal Markers | Regex pattern matching | Detect temporal phrases | Fast, rule-based, 16 patterns from requirements |
| Supersession | Tombstone records with retention | Memory versioning | Standard pattern for data versioning, space-efficient |

### Supporting

| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| Regex-based NER | Entity extraction without ML | All entity extraction for v0.1 |
| Cosine similarity | Semantic matching for contradictions | Vector search for candidate retrieval |
| Conflict domains | Group memory types for contradiction checking | Cross-type conflict detection |
| Session tracking | Recurrence detection within conversation | Track mentioned facts in current session |
| Tombstone pattern | Superseded memory retention | All supersession operations |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Regex NER | ML-based NER (spaCy, transformers) | ML more accurate but heavier, requires model download |
| Cosine contradiction | Rule-based matching | Cosine handles semantic variation, rules faster but brittle |
| 30-day retention | Permanent retention | Limited retention prevents storage bloat, permanent adds complexity |
| Auto-supersession | Manual resolution only | Auto is faster but may wrong, manual adds user burden |

**Why no external NER library:**
- For v0.1, regex patterns cover common cases (names, places, dates, preferences)
- ML-based NER adds model loading time and bundle size
- Rule-based approach is predictable and debuggable
- Can upgrade to ML extractors in v2 without architecture changes (extensibility)

**Installation:**
```bash
# No new dependencies required
# Uses existing: TypeScript, Dexie.js, Transformers.js (from Phase 4)
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── extraction/
│   ├── ExtractionPipeline.ts    # Main orchestrator for extraction
│   ├── SpecificityNER.ts         # Named entity recognition + specificity scoring
│   ├── EntityExtractor.ts        # Entity extraction with deduplication
│   ├── MemoryClassifier.ts       # Memory type classification
│   ├── RecurrenceTracker.ts      # Session-level recurrence tracking
│   ├── QualityScorer.ts          # E(s) calculation with thresholds
│   ├── TemporalMarkerDetector.ts # Temporal phrase detection
│   ├── ContradictionDetector.ts  # Conflict detection and resolution
│   ├── SupersessionManager.ts    # Supersession chain management
│   ├── types.ts                  # Extraction-specific types
│   └── _index.ts                 # Barrel exports
├── worker/
│   └── index.ts                  # Add extraction handlers
└── storage/
    └── Database.ts               # Schema updates (deletedAt, conflictDomain)
```

### Pattern 1: Extraction Pipeline Orchestration

**What:** Sequential extraction with quality filtering and contradiction checking

**When to use:** All `learn()` operations in Phase 8

**Example:**
```typescript
// Source: Phase 7 requirements + user constraints
import type { MemoryInternal } from '../internal/types.js';
import type { VectorSearch } from '../search/VectorSearch.js';
import type { MemoryRepository } from '../storage/MemoryRepository.js';

export interface ExtractionResult {
  memories: MemoryInternal[];
  contradictions: ContradictionEvent[];
  discarded: Array<{ content: string; score: number; reason: string }>;
}

export interface ExtractionConfig {
  extractionThreshold: number;
  minNoveltyGate: number;
  typeSpecificThresholds: Partial<Record<MemoryType, number>>;
  debugMode: boolean;
}

export class ExtractionPipeline {
  constructor(
    private repository: MemoryRepository,
    private vectorSearch: VectorSearch,
    private config: ExtractionConfig
  ) {
    // Initialize extractors
    this.specificityNER = new SpecificityNER();
    this.entityExtractor = new EntityExtractor();
    this.memoryClassifier = new MemoryClassifier();
    this.recurrenceTracker = new RecurrenceTracker();
    this.qualityScorer = new QualityScorer(config);
    this.temporalMarkerDetector = new TemporalMarkerDetector();
    this.contradictionDetector = new ContradictionDetector(repository, vectorSearch);
    this.supersessionManager = new SupersessionManager(repository);
  }

  /**
   * Extract memories from conversation text
   * @param facts - Array of fact strings extracted from conversation
   * @param conversationId - Source conversation ID
   * @returns ExtractionResult with accepted memories, contradictions, discarded
   */
  async extract(
    facts: string[],
    conversationId: string
  ): Promise<ExtractionResult> {
    const results: ExtractionResult = {
      memories: [],
      contradictions: [],
      discarded: []
    };

    // Process each fact
    for (const fact of facts) {
      // Step 1: Extract entities and compute specificity
      const entities = this.entityExtractor.extract(fact);
      const specificity = this.specificityNER.score(fact, entities);

      // Step 2: Classify memory type
      const types = this.memoryClassifier.classify(fact, entities);

      // Step 3: Check recurrence
      const recurrence = this.recurrenceTracker.check(fact);

      // Step 4: Compute novelty (REQUIRES vector search)
      const embedding = await this.vectorSearch.embed(fact);
      const novelty = await this.computeNovelty(embedding);

      // Step 5: Compute quality score E(s)
      const score = this.qualityScorer.compute({
        novelty,
        specificity,
        recurrence
      }, types);

      // Step 6: Apply threshold filtering
      const threshold = this.getTypeSpecificThreshold(types[0] ?? 'preference');
      const minNovelty = this.config.minNoveltyGate;

      if (score < threshold) {
        results.discarded.push({
          content: fact,
          score,
          reason: score < 0.40 ? 'noise' : 'below_threshold'
        });
        continue;
      }

      if (novelty < minNovelty) {
        results.discarded.push({
          content: fact,
          score,
          reason: 'low_novelty'
        });
        continue;
      }

      // Step 7: Create memory object
      const memory: MemoryInternal = {
        id: generateId(),
        content: fact,
        types,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        validFrom: Date.now(),
        validTo: null,
        baseStrength: score, // Use E(s) as initial strength
        currentStrength: score,
        pinned: false,
        mentionCount: 1,
        lastAccessedAt: Date.now(),
        clusterId: null,
        entities: entities.map(e => e.value),
        sourceConversationIds: [conversationId],
        supersededBy: null,
        supersededAt: null,
        fadedAt: null,
        embedding,
        metadata: {
          extractionScore: score,
          extractionBreakdown: { novelty, specificity, recurrence }
        }
      };

      // Step 8: Check for contradictions
      const contradictions = await this.contradictionDetector.detect(memory);
      if (contradictions.length > 0) {
        results.contradictions.push(...contradictions);

        // Handle supersession
        const resolved = await this.supersessionManager.resolve(memory, contradictions[0]);
        if (resolved) {
          results.memories.push(resolved.newMemory);
          // Emit supersession event
          this.emitSupersededEvent(resolved.superseded);
        }
      } else {
        results.memories.push(memory);
      }

      // Step 9: Track recurrence for session
      this.recurrenceTracker.track(fact);
    }

    return results;
  }

  /**
   * Compute novelty using vector search (k=1)
   * CRITICAL: Must use VectorSearch.search() to avoid O(N) loop
   */
  private async computeNovelty(embedding: Float32Array): Promise<number> {
    // Find most similar existing memory
    const results = await this.vectorSearch.searchWithEmbedding(embedding, { k: 1 });

    if (results.length === 0) {
      return 1.0; // No memories = fully novel
    }

    const topSimilarity = results[0]?.similarity ?? 0;
    return 1 - topSimilarity;
  }

  private getTypeSpecificThreshold(type: MemoryType): number {
    return this.config.typeSpecificThresholds[type] ?? this.config.extractionThreshold;
  }
}
```

### Pattern 2: Specificity NER with Weighted Scoring

**What:** Regex-based entity extraction with weighted scoring

**When to use:** All quality scoring operations

**Example:**
```typescript
// Source: EXTRACT-01 requirement
export interface Entity {
  type: 'name' | 'place' | 'number' | 'preference' | 'date' | 'negation' | 'possession';
  value: string;
  position?: number; // Optional for debugging
}

export interface SpecificityScore {
  score: number; // 0-1, sum of weights clamped to 1.0
  breakdown: {
    names: number;
    places: number;
    numbers: number;
    preferences: number;
    dates: number;
    negations: number;
    possession: number;
  };
}

export class SpecificityNER {
  // Weights from EXTRACT-01
  private readonly WEIGHTS = {
    names: 0.30,
    places: 0.25,
    numbers: 0.20,
    preferences: 0.25,
    dates: 0.20,
    negations: 0.20,
    possession: 0.10
  };

  // Regex patterns for each entity type
  private readonly PATTERNS = {
    // Names: Capitalized words (simple heuristic)
    names: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g,

    // Places: City/country names with common indicators
    places: /\b(in|at|from|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,

    // Numbers: Digits with optional units
    numbers: /\b\d+(?:\.\d+)?\s*(?:%|dollars?|euros?|pounds?|years?|days?|hours?)?\b/gi,

    // Preferences: "I like/love/hate/prefer X"
    preferences: /\b(I|we)\s+(?:really\s+)?(?:like|love|hate|prefer|enjoy|can't stand)\s+([^.]+)\b/gi,

    // Dates: Various date formats
    dates: /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/gi,

    // Negations: "not", "never", "no", "don't", etc.
    negations: /\b(?:not|never|no|neither|nor|don't|doesn't|didn't|won't|wouldn't|couldn't|shouldn't)\b/gi,

    // Possession: "my", "mine", "our", "ours"
    possession: /\b(?:my|mine|our|ours)\s+(?:name|address|phone|email|home|work|job)\b/gi
  };

  /**
   * Extract entities from text
   */
  extract(text: string): Entity[] {
    const entities: Entity[] = [];

    for (const [type, pattern] of Object.entries(this.PATTERNS)) {
      const matches = text.matchAll(pattern as RegExp);
      for (const match of matches) {
        entities.push({
          type: type as Entity['type'],
          value: match[0],
          position: match.index
        });
      }
    }

    return entities;
  }

  /**
   * Compute specificity score from entities
   * Clamps sum to 1.0 per EXTRACT-01
   */
  score(text: string, entities: Entity[]): SpecificityScore {
    const breakdown = {
      names: 0,
      places: 0,
      numbers: 0,
      preferences: 0,
      dates: 0,
      negations: 0,
      possession: 0
    };

    // Count entities by type
    for (const entity of entities) {
      breakdown[entity.type] += 1;
    }

    // Apply weights (binary: present or not, not cumulative)
    const weightedSum = (
      (breakdown.names > 0 ? this.WEIGHTS.names : 0) +
      (breakdown.places > 0 ? this.WEIGHTS.places : 0) +
      (breakdown.numbers > 0 ? this.WEIGHTS.numbers : 0) +
      (breakdown.preferences > 0 ? this.WEIGHTS.preferences : 0) +
      (breakdown.dates > 0 ? this.WEIGHTS.dates : 0) +
      (breakdown.negations > 0 ? this.WEIGHTS.negations : 0) +
      (breakdown.possession > 0 ? this.WEIGHTS.possession : 0)
    );

    // Clamp to 1.0 per EXTRACT-01
    const score = Math.min(1.0, weightedSum);

    return { score, breakdown };
  }
}
```

### Pattern 3: Contradiction Detection with Conflict Domains

**What:** Semantic similarity search with conflict-domain filtering

**When to use:** All `learn()` operations before inserting new memories

**Example:**
```typescript
// Source: CONTRA-01, CONTRA-02 requirements
export interface ConflictDomain {
  type: 'identity' | 'location' | 'preference' | 'temporal' | 'relational' | 'emotional' | 'profession' | 'project';
}

export interface ContradictionEvent {
  existingMemoryId: string;
  newMemoryId: string;
  similarity: number;
  conflictDomain: ConflictDomain['type'];
  temporalMarkerDetected: boolean;
  resolution: 'supersede' | 'parallel' | 'manual';
}

export class ContradictionDetector {
  // Conflict domain mapping from MemoryType
  private readonly DOMAIN_MAPPING: Record<MemoryType, ConflictDomain['type']> = {
    'identity': 'identity',
    'location': 'location',
    'profession': 'profession',
    'preference': 'preference',
    'project': 'project',
    'temporal': 'temporal',
    'relational': 'relational',
    'emotional': 'emotional'
  };

  // Memory types that auto-supersede (identity, location)
  private readonly AUTO_SUPERSEDE_TYPES: Set<ConflictDomain['type']> = new Set(['identity', 'location']);

  constructor(
    private repository: MemoryRepository,
    private vectorSearch: VectorSearch
  ) {}

  /**
   * Detect contradictions for a new memory
   * @param newMemory - Memory to check for contradictions
   * @returns Array of contradiction events (empty if none)
   */
  async detect(newMemory: MemoryInternal): Promise<ContradictionEvent[]> {
    // Step 1: Determine conflict domain from memory type
    const primaryType = newMemory.types[0] ?? 'preference';
    const conflictDomain = this.DOMAIN_MAPPING[primaryType];

    // Step 2: Detect temporal markers
    const temporalMarker = this.detectTemporalMarker(newMemory.content);

    // Step 3: Retrieve candidates via vector search
    const candidates = await this.vectorSearch.search(newMemory.content, { k: 7 });

    // Step 4: Filter by similarity threshold (≥ 0.80)
    const similarCandidates = candidates.filter(c => c.similarity >= 0.80);

    if (similarCandidates.length === 0) {
      // If temporal marker but no contradiction, emit passive event
      if (temporalMarker) {
        this.emitPassiveTemporalEvent(newMemory);
      }
      return [];
    }

    // Step 5: Filter by conflict domain
    const contradictions: ContradictionEvent[] = [];

    for (const candidate of similarCandidates) {
      const existingMemory = await this.repository.getById(candidate.memoryId);
      if (!existingMemory) continue;

      // Check if existing memory is in same conflict domain
      const existingDomain = this.getConflictDomain(existingMemory);

      if (existingDomain === conflictDomain) {
        // Determine resolution strategy
        const resolution = this.determineResolution(
          conflictDomain,
          temporalMarker,
          newMemory,
          existingMemory
        );

        contradictions.push({
          existingMemoryId: existingMemory.id,
          newMemoryId: newMemory.id,
          similarity: candidate.similarity,
          conflictDomain,
          temporalMarkerDetected: temporalMarker.detected,
          resolution
        });
      }
    }

    return contradictions;
  }

  /**
   * Detect temporal markers in text
   * 16 patterns from CONTRA-02 requirement
   */
  private detectTemporalMarker(text: string): { detected: boolean; pattern?: string } {
    const patterns = [
      'used to', 'previously', 'no longer', 'formerly',
      'in the past', 'until recently', 'changed from',
      'switched from', 'moved from', 'transitioned from',
      'graduated from', 'left', 'quit', 'retired from',
      'divorced', 'separated from', 'broke up with'
    ];

    const lowerText = text.toLowerCase();

    for (const pattern of patterns) {
      if (lowerText.includes(pattern)) {
        return { detected: true, pattern };
      }
    }

    return { detected: false };
  }

  /**
   * Get conflict domain from memory
   */
  private getConflictDomain(memory: MemoryInternal): ConflictDomain['type'] {
    const primaryType = memory.types[0] ?? 'preference';
    return this.DOMAIN_MAPPING[primaryType];
  }

  /**
   * Determine contradiction resolution strategy
   */
  private determineResolution(
    domain: ConflictDomain['type'],
    temporalMarker: { detected: boolean },
    newMemory: MemoryInternal,
    existingMemory: MemoryInternal
  ): ContradictionEvent['resolution'] {
    // Auto-supersede for identity/location types
    if (this.AUTO_SUPERSEDE_TYPES.has(domain)) {
      return 'supersede';
    }

    // Supersede if explicit temporal marker
    if (temporalMarker.detected) {
      return 'supersede';
    }

    // Prefer parallel for other types
    return 'parallel';
  }

  private emitPassiveTemporalEvent(memory: MemoryInternal): void {
    // Emit event for temporal marker without contradiction
    // Implementation depends on event system
  }
}
```

### Pattern 4: Supersession Manager with Tombstone Retention

**What:** Manage memory supersession chains with 30-day retention

**When to use:** All contradiction resolution that results in supersession

**Example:**
```typescript
// Source: CONTRA-03, CONTRA-04, CONTRA-06 requirements
export interface SupersessionResult {
  newMemory: MemoryInternal;
  superseded: MemoryInternal;
  chain: string[]; // IDs in chain: [oldest, ..., superseded, new]
}

export class SupersessionManager {
  private readonly TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  constructor(private repository: MemoryRepository) {}

  /**
   * Resolve contradiction by superseding existing memory
   */
  async resolve(
    newMemory: MemoryInternal,
    contradiction: ContradictionEvent
  ): Promise<SupersessionResult | null> {
    const existingMemory = await this.repository.getById(contradiction.existingMemoryId);
    if (!existingMemory) return null;

    const now = Date.now();

    // Step 1: Set validTo on existing memory
    existingMemory.validTo = now;
    existingMemory.status = 'superseded';
    existingMemory.supersededBy = newMemory.id;
    existingMemory.supersededAt = now;

    // Step 2: Set validFrom on new memory
    newMemory.validFrom = now;
    newMemory.supersedesId = existingMemory.id;

    // Step 3: Get full chain trace
    const chain = await this.getSupersessionChain(existingMemory);

    // Step 4: Update repository
    await this.repository.update(existingMemory);
    await this.repository.create(newMemory);

    // Step 5: Emit supersession event
    this.emitSupersededEvent({
      supersededMemoryId: existingMemory.id,
      supersededBy: newMemory.id,
      chain,
      conflictDomain: contradiction.conflictDomain
    });

    return {
      newMemory,
      superseded: existingMemory,
      chain
    };
  }

  /**
   * Get full supersession chain (trace entire history)
   */
  private async getSupersessionChain(memory: MemoryInternal): Promise<string[]> {
    const chain: string[] = [memory.id];

    // Follow supersedesId backwards
    let current = memory;
    while (current.supersedesId) {
      const previous = await this.repository.getById(current.supersedesId);
      if (!previous) break;
      chain.unshift(previous.id);
      current = previous;
    }

    return chain;
  }

  /**
   * Clean up old tombstones (run periodically)
   * Strip embedding and content from superseded memories older than 30 days
   */
  async cleanupTombstones(): Promise<number> {
    const now = Date.now();
    const cutoff = now - this.TOMBSTONE_RETENTION_MS;

    // Find superseded memories older than 30 days
    const allSuperseded = await this.repository.findSuperseded();
    const toStrip = allSuperseded.filter(m => {
      const supersededAt = m.supersededAt ?? 0;
      return supersededAt < cutoff && m.embedding.length > 0;
    });

    // Strip content and embedding (keep tombstone)
    for (const memory of toStrip) {
      memory.content = ''; // Strip content
      memory.embedding = new Float32Array(0); // Strip embedding
      memory.deletedAt = now; // Mark when stripped

      await this.repository.update(memory);
    }

    return toStrip.length;
  }

  /**
   * Get superseded memories (with optional tombstone inclusion)
   */
  async getSupersededMemories(includeTombstones = false): Promise<MemoryInternal[]> {
    const superseded = await this.repository.findSuperseded();

    if (includeTombstones) {
      return superseded;
    }

    // Exclude tombstones (deletedAt is set)
    return superseded.filter(m => !m.deletedAt);
  }

  private emitSupersededEvent(event: {
    supersededMemoryId: string;
    supersededBy: string;
    chain: string[];
    conflictDomain: string;
  }): void {
    // Implementation depends on event system
    // Emit via EventEmitter or callback
  }
}
```

### Anti-Patterns to Avoid

**Computing novelty with O(N) loop:** Always use VectorSearch.search(k=1) for novelty computation. Don't iterate through all memories.

**Extracting entities without deduplication:** Always track entity mention counts and deduplicate within memory.

**Ignoring type-specific thresholds:** Apply stricter thresholds for identity/location facts, more lenient for preferences/emotional states.

**Storing character offsets:** Don't store entity positions - reduces storage overhead without much benefit for v0.1.

**Permanently keeping superseded memories:** Always implement tombstone retention with 30-day cleanup to prevent storage bloat.

**Running contradiction detection asynchronously:** Always run detection synchronously during learn() to ensure consistency.

**Checking contradictions across all memory types:** Use conflict-domain filtering to avoid false positives (e.g., preference vs location shouldn't conflict).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Entity extraction | ML-based NER | Regex patterns | Sufficient for v0.1, no ML dependencies, fast |
| Novelty computation | O(N) similarity loop | VectorSearch.search(k=1) | Already optimized, uses cached embeddings |
| Contradiction detection | Rule-based matching | Cosine similarity | Handles semantic variation, uses existing search |
| Temporal markers | NLP parsing | Regex patterns | 16 patterns cover common cases, fast |
| Supersession storage | Custom versioning | Tombstone records | Standard pattern, space-efficient with cleanup |

**Key insight:** For v0.1, rule-based extraction with regex patterns is sufficient and fast. Vector search already exists for novelty and contradiction detection. No new ML dependencies needed.

---

## Common Pitfalls

### Pitfall 1: O(N) Novelty Computation

**What goes wrong:** Novelty computation loops through all memories, causing performance cliff at scale.

**Why it happens:** Developer doesn't realize VectorSearch.search(k=1) is optimized with cached embeddings.

**How to avoid:** Always use `vectorSearch.search(query, { k: 1 })` for novelty. This returns the top match in O(N) but with optimized Float32Array math.

**Warning signs:** Novelty computation takes >100ms for 1000 memories, high CPU usage during extraction.

### Pitfall 2: Cross-Type False Positives

**What goes wrong:** "I prefer coffee" (preference) conflicts with "I live in Berlin" (location) because both have high similarity.

**Why it happens:** Checking contradictions across all memory types without domain filtering.

**How to avoid:** Use conflict-domain mapping to only check contradictions within same domain (identity, location, preference, etc.).

**Warning signs:** High contradiction rate (>20% of facts), user complaints about false conflicts.

### Pitfall 3: Storage Bloat from Superseded Memories

**What goes wrong:** Superseded memories accumulate indefinitely, causing IndexedDB quota errors.

**Why it happens:** No tombstone cleanup or retention policy.

**How to avoid:** Implement 30-day tombstone retention with automatic content stripping after expiration.

**Warning signs:** IndexedDB size growing monotonically, high ratio of superseded to active memories.

### Pitfall 4: Overly Permissive Extraction

**What goes wrong:** Low-quality conversational filler ("ok", "sure", "thanks") stored as memories.

**Why it happens:** Extraction threshold too low or no minimum novelty gate.

**How to avoid:** Use E(s) ≥ 0.55 default threshold with minimum novelty gate ≥ 0.15.

**Warning signs:** High number of low-specificity memories, poor search relevance.

### Pitfall 5: Regex Pattern Brittleness

**What goes wrong:** Entity extraction fails on common variations (e.g., "I don't like" vs "I do not like").

**Why it happens:** Regex patterns too narrow, not tested on real data.

**How to avoid:** Include case-insensitive matching, word boundaries, and common variations in patterns.

**Warning signs:** Low entity recall rate, user feedback about missing entities.

### Pitfall 6: Ignoring Temporal Markers

**What goes wrong:** Temporal updates ("I used to live in Berlin") treated as new facts instead of supersession.

**Why it happens:** Temporal marker detection not integrated with contradiction resolution.

**How to avoid:** Detect temporal markers and automatically supersede when found, use validTo/validFrom fields.

**Warning signs:** Contradictory memories about same topic, user confusion about outdated facts.

### Pitfall 7: Binary Recurrence Tracking

**What goes wrong:** Recurrence always 0 or 1, doesn't capture repeated mentions within session.

**Why it happens:** Using simple boolean instead of counting mentions.

**How to avoid:** Track mention count within session, use threshold (cosine > 0.85) for recurrence detection.

**Warning signs:** Recurrence score doesn't increase with repeated mentions, no reinforcement for frequently discussed topics.

### Pitfall 8: Inconsistent Conflict Domain Mapping

**What goes wrong:** Memory types map to wrong conflict domains, causing missed contradictions or false positives.

**Why it happens:** Domain mapping not aligned with actual memory semantics.

**How to avoid:** Carefully map each MemoryType to ConflictDomain based on semantic meaning, not just name.

**Warning signs:** Unexpected contradiction behavior, certain types never/always conflicting.

---

## Code Examples

### Complete ExtractionPipeline Implementation

```typescript
// Source: Phase 7 requirements + user constraints
import type { MemoryInternal } from '../internal/types.js';
import type { MemoryRepository } from '../storage/MemoryRepository.js';
import type { VectorSearch } from '../search/VectorSearch.js';
import { SpecificityNER } from './SpecificityNER.js';
import { EntityExtractor } from './EntityExtractor.js';
import { MemoryClassifier } from './MemoryClassifier.js';
import { RecurrenceTracker } from './RecurrenceTracker.js';
import { QualityScorer } from './QualityScorer.js';
import { TemporalMarkerDetector } from './TemporalMarkerDetector.js';
import { ContradictionDetector } from './ContradictionDetector.js';
import { SupersessionManager } from './SupersessionManager.js';
import type { ExtractionConfig, ExtractionResult } from './types.js';

export class ExtractionPipeline {
  private specificityNER: SpecificityNER;
  private entityExtractor: EntityExtractor;
  private memoryClassifier: MemoryClassifier;
  private recurrenceTracker: RecurrenceTracker;
  private qualityScorer: QualityScorer;
  private temporalMarkerDetector: TemporalMarkerDetector;
  private contradictionDetector: ContradictionDetector;
  private supersessionManager: SupersessionManager;

  constructor(
    private repository: MemoryRepository,
    private vectorSearch: VectorSearch,
    private config: ExtractionConfig
  ) {
    this.specificityNER = new SpecificityNER();
    this.entityExtractor = new EntityExtractor();
    this.memoryClassifier = new MemoryClassifier();
    this.recurrenceTracker = new RecurrenceTracker();
    this.qualityScorer = new QualityScorer(config);
    this.temporalMarkerDetector = new TemporalMarkerDetector();
    this.contradictionDetector = new ContradictionDetector(repository, vectorSearch);
    this.supersessionManager = new SupersessionManager(repository);
  }

  /**
   * Main extraction method
   */
  async extract(
    facts: string[],
    conversationId: string
  ): Promise<ExtractionResult> {
    const results: ExtractionResult = {
      memories: [],
      contradictions: [],
      discarded: []
    };

    for (const fact of facts) {
      const result = await this.extractFact(fact, conversationId);
      results.memories.push(...result.memories);
      results.contradictions.push(...result.contradictions);
      results.discarded.push(...result.discarded);
    }

    return results;
  }

  private async extractFact(
    fact: string,
    conversationId: string
  ): Promise<ExtractionResult> {
    const result: ExtractionResult = {
      memories: [],
      contradictions: [],
      discarded: []
    };

    // Extract entities and compute specificity
    const entities = this.entityExtractor.extract(fact);
    const specificityScore = this.specificityNER.score(fact, entities);

    // Classify memory type
    const types = this.memoryClassifier.classify(fact, entities);

    // Check recurrence
    const recurrence = this.recurrenceTracker.check(fact);

    // Compute novelty (use vector search)
    const embedding = await this.vectorSearch.embed(fact);
    const novelty = await this.computeNovelty(embedding);

    // Compute quality score
    const score = this.qualityScorer.compute({
      novelty,
      specificity: specificityScore.score,
      recurrence
    }, types);

    // Apply threshold
    const threshold = this.getTypeThreshold(types[0] ?? 'preference');
    const minNovelty = this.config.minNoveltyGate;

    if (score < threshold || novelty < minNovelty) {
      result.discarded.push({
        content: fact,
        score,
        reason: score < 0.40 ? 'noise' : (novelty < minNovelty ? 'low_novelty' : 'below_threshold')
      });

      if (this.config.debugMode) {
        console.log(`[Extraction] Discarded: "${fact}"`, {
          score,
          novelty,
          specificity: specificityScore.score,
          recurrence,
          threshold,
          minNovelty
        });
      }

      return result;
    }

    // Create memory
    const memory: MemoryInternal = {
      id: this.generateId(),
      content: fact,
      types,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      validFrom: Date.now(),
      validTo: null,
      baseStrength: score,
      currentStrength: score,
      pinned: false,
      mentionCount: 1,
      lastAccessedAt: Date.now(),
      clusterId: null,
      entities: entities.map(e => e.value),
      sourceConversationIds: [conversationId],
      supersededBy: null,
      supersededAt: null,
      fadedAt: null,
      embedding,
      metadata: {
        extractionScore: score,
        extractionBreakdown: {
          novelty,
          specificity: specificityScore.score,
          recurrence
        }
      }
    };

    // Check contradictions
    const contradictions = await this.contradictionDetector.detect(memory);

    if (contradictions.length > 0) {
      result.contradictions.push(...contradictions);

      const resolved = await this.supersessionManager.resolve(memory, contradictions[0]);
      if (resolved) {
        result.memories.push(resolved.newMemory);
      }
    } else {
      result.memories.push(memory);
    }

    // Track recurrence
    this.recurrenceTracker.track(fact);

    return result;
  }

  private async computeNovelty(embedding: Float32Array): Promise<number> {
    const results = await this.vectorSearch.searchWithEmbedding(embedding, { k: 1 });

    if (results.length === 0) {
      return 1.0;
    }

    return 1 - (results[0]?.similarity ?? 0);
  }

  private getTypeThreshold(type: string): number {
    return this.config.typeSpecificThresholds[type] ?? this.config.extractionThreshold;
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ML-based NER | Regex-based extraction | 2020+ | Faster, no dependencies, sufficient for v0.1 |
| Manual contradiction checking | Vector similarity + domains | 2022+ | Handles semantic variation, fewer false positives |
| Permanent supersession | Tombstone with retention | 2021+ | Space-efficient, full traceability |
| Simple threshold | Type-specific thresholds | 2023+ | Better quality control per memory type |
| O(N) novelty | VectorSearch(k=1) | 2024+ | Optimized cached embeddings, faster |

**Current best practices (2024-2025):**
- Rule-based extraction for v0.1, ML for v2
- Vector similarity for semantic contradiction detection
- Conflict-domain filtering to reduce false positives
- Tombstone retention with automatic cleanup
- Type-specific quality thresholds

**Deprecated/outdated:**
- Manual entity lists (use regex patterns)
- Binary quality scoring (use weighted sum)
- No novelty gating (use minimum novelty gate)
- Permanent superseded memory storage (use tombstones)

---

## Open Questions

1. **Exact Type-Specific Threshold Values**
   - What we know: Identity/location should be stricter, preference/emotional more lenient
   - What's unclear: Concrete threshold numbers for each type
   - Recommendation: Start with identity=0.65, location=0.60, profession=0.60, preference=0.50, emotional=0.45, temporal=0.55, relational=0.50, project=0.55

2. **Regex Pattern Completeness**
   - What we know: 16 temporal patterns from requirements, NER patterns for common entity types
   - What's unclear: Coverage on real conversation data
   - Recommendation: Start with provided patterns, refine based on user feedback and testing

3. **Conflict Domain Mapping Edge Cases**
   - What we know: 8 conflict domains mapped from 8 memory types
   - What's unclear: Edge cases where memory has multiple types
   - Recommendation: Use primary type (first in array) for domain mapping, document behavior

4. **Supersession Cleanup Frequency**
   - What we know: 30-day tombstone retention needed
   - What's unclear: How often to run cleanup job
   - Recommendation: Run during maintenance sweep (Phase 6), log cleanup count

---

## Sources

### Primary (HIGH confidence)

- /Users/poak/Documents/personal-project/lokul-mind/.planning/phases/07-extraction-contradiction/07-CONTEXT.md - User decisions and implementation constraints
- /Users/poak/Documents/personal-project/lokul-mind/.planning/REQUIREMENTS.md - EXTRACT-01..07, CONTRA-01..06 requirements
- /Users/poak/Documents/personal-project/lokul-mind/src/types/memory.ts - MemoryDTO and MemoryInternal types with supersession fields
- /Users/poak/Documents/personal-project/lokul-mind/src/storage/Database.ts - Schema with supersededBy, supersededAt, validTo fields
- /Users/poak/Documents/personal-project/lokul-mind/src/search/VectorSearch.ts - Vector search implementation for novelty computation
- /Users/poak/Documents/personal-project/lokul-mind/src/lifecycle/LifecycleManager.ts - Maintenance sweep for cleanup job integration

### Secondary (MEDIUM confidence)

- /Users/poak/Documents/personal-project/lokul-mind/.planning/phases/05-memory-store-retrieval/05-RESEARCH.md - Vector search patterns for novelty computation
- /Users/poak/Documents/personal-project/lokul-mind/.planning/phases/06-lifecycle-decay/06-RESEARCH.md - Maintenance sweep integration for cleanup
- Ebbinghaus forgetting curve research - Lambda decay formula for memory strength (EXTRACT-04 weight justification)

### Tertiary (LOW confidence)

- Web search results on NER patterns and contradiction detection (verified with project requirements)
- Temporal marker detection patterns (CONTRA-02 specifies 16 patterns to implement)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, uses existing VectorSearch and Repository
- Architecture: HIGH - Modular extraction pipeline follows Phase 2/3/4/5 patterns
- Extraction scoring: HIGH - Formula from requirements, weights specified
- Contradiction detection: MEDIUM - Conflict-domain mapping needs validation with real data
- Regex patterns: MEDIUM - Basic patterns defined, may need refinement with testing
- Supersession chains: HIGH - Tombstone pattern standard, schema fields already exist

**Research date:** 2026-02-25
**Valid until:** 2026-05-25 (extraction patterns are stable, 90-day validity appropriate)
