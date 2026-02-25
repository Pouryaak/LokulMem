---
phase: 07-extraction-contradiction
plan: 03b
type: execute
wave: 4
depends_on:
  - 07-03a
files_modified:
  - src/extraction/ContradictionDetector.ts
  - src/extraction/SupersessionManager.ts
  - src/extraction/_index.ts
  - src/core/Protocol.ts
  - src/core/WorkerManager.ts
  - src/core/LokulMem.ts
autonomous: true
requirements:
  - CONTRA-01
  - CONTRA-02
  - CONTRA-03
  - CONTRA-04
  - CONTRA-05
  - CONTRA-06

must_haves:
  truths:
    - "Contradiction detection retrieves top 7 candidates with similarity > 0.80"
    - "Temporal markers checked via TemporalMarkerDetector"
    - "Resolution logic applies supersede/parallel/pending based on typed-attribute matching"
    - "Supersession manager applies status changes and timestamps"
    - "Contradiction events emitted via public callbacks"
    - "IPC protocol extended with contradiction message types"
    - "Supersession chains preserved with full traceability"
  artifacts:
    - path: "src/extraction/ContradictionDetector.ts"
      provides: "Contradiction detection and resolution engine"
      min_lines: 200
      exports: ["ContradictionDetector", "ContradictionEvent", "ContradictionConfig"]
    - path: "src/extraction/SupersessionManager.ts"
      provides: "Supersession chain management and cleanup"
      min_lines: 120
      exports: ["SupersessionManager", "SupersessionResult"]
    - path: "src/core/Protocol.ts"
      provides: "IPC message types for contradiction events"
      contains: "CONTRADICTION_DETECTED", "MEMORY_SUPERSEDED"
    - path: "src/core/WorkerManager.ts"
      provides: "Event handler registration for contradictions"
      exports: ["onContradictionDetected", "onMemorySuperseded"]
    - path: "src/core/LokulMem.ts"
      provides: "Public API callbacks for contradiction events"
      exports: ["onContradictionDetected", "onMemorySuperseded"]
  key_links:
    - from: "src/extraction/ContradictionDetector.ts"
      to: "src/search/VectorSearch.ts"
      via: "Candidate retrieval for contradiction detection"
      pattern: "searchByConflictDomain"
    - from: "src/extraction/ContradictionDetector.ts"
      to: "src/extraction/TemporalMarkerDetector.ts"
      via: "Temporal marker detection for resolution logic"
      pattern: "temporalDetector\\.detect"
    - from: "src/extraction/SupersessionManager.ts"
      to: "src/storage/MemoryRepository.ts"
      via: "Supersession and tombstone operations"
      pattern: "repository\\.supersede"
    - from: "src/core/WorkerManager.ts"
      to: "src/core/Protocol.ts"
      via: "Message type constants"
      pattern: "MessageType\\.CONTRADICTION"
    - from: "src/core/LokulMem.ts"
      to: "src/core/WorkerManager.ts"
      via: "Event handler delegation"
      pattern: "workerManager\\.onContradiction"
---

# Plan 07-03b: Contradiction Detection Engine

**Phase:** 7 (Extraction & Contradiction)
**Wave:** 4 (Integration)
**Autonomous:** Yes
**Estimated Duration:** 30 minutes

---

## Requirements

- **CONTRA-01**: Retrieve topK candidates (5-10) and evaluate any with similarity > 0.80; choose best typed-attribute match
- **CONTRA-02**: Temporal markers detected (16 patterns) - implemented in 07-02
- **CONTRA-03**: Temporal updates set validTo on existing, validFrom on new
- **CONTRA-04**: Typed attribute conflicts mark existing as superseded
- **CONTRA-05**: Contradiction events emitted via callback
- **CONTRA-06**: Supersession chains preserved (supersededBy, supersededAt)

---

## Goal

Implement the contradiction detection engine that identifies conflicting memories, resolves them via typed-attribute matching or user choice, manages supersession chains with 30-day tombstone retention, and emits events for downstream consumers.

---

## Tasks

### Task 1: Implement ContradictionDetector class

**File:** `src/extraction/ContradictionDetector.ts`

Implement contradiction detection and resolution:

```typescript
import type { MemoryInternal, MemoryDTO } from '../types/memory.js';
import type { VectorSearch } from '../search/VectorSearch.js';
import type { MemoryRepository } from '../storage/MemoryRepository.js';
import type { TemporalMarkerDetector } from './TemporalMarkerDetector.js';

/**
 * ContradictionEvent - Emitted when contradiction detected
 */
export interface ContradictionEvent {
  /** New memory that triggered contradiction */
  newMemory: MemoryDTO;

  /** Conflicting existing memory */
  conflictingMemory: MemoryDTO;

  /** Similarity score */
  similarity: number;

  /** Whether temporal marker detected */
  hasTemporalMarker: boolean;

  /** Resolution mode applied */
  resolution: 'supersede' | 'parallel' | 'pending';
}

/**
 * ContradictionCandidate - Potential conflict from search
 */
export interface ContradictionCandidate {
  memory: MemoryInternal;
  similarity: number;
  hasTemporalMarker: boolean;
}

export class ContradictionDetector {
  constructor(
    private vectorSearch: VectorSearch,
    private repository: MemoryRepository,
    private temporalDetector: TemporalMarkerDetector,
    private config: ContradictionConfig,
  ) {}

  /**
   * Detect contradictions for a new memory
   *
   * Process:
   * 1. Retrieve top K candidates from same conflict domain
   * 2. Filter by similarity > 0.80
   * 3. Check for temporal markers
   * 4. Choose best typed-attribute match
   * 5. Apply resolution (supersede/parallel/pending)
   *
   * @param newMemory - New memory to check
   * @returns Array of contradiction events (may be empty)
   */
  async detect(newMemory: MemoryInternal): Promise<ContradictionEvent[]> {
    const events: ContradictionEvent[] = [];

    // Get conflict domain
    const conflictDomain = newMemory.conflictDomain;

    // Retrieve candidates (7 per CONTEXT decision)
    const candidates = await this.vectorSearch.searchByConflictDomain(
      newMemory.content,
      conflictDomain,
      this.config.candidateK,
    );

    // Filter by similarity threshold (>0.80)
    for (const candidate of candidates) {
      if (candidate.similarity < this.config.similarityThreshold) {
        continue;
      }

      const existingMemory = await this.repository.getById(candidate.memoryId);
      if (!existingMemory || existingMemory.status !== 'active') {
        continue;
      }

      // Check for temporal markers in existing memory
      const existingTemporal = this.temporalDetector.detect(existingMemory.content);
      const newTemporal = this.temporalDetector.detect(newMemory.content);

      const hasTemporalMarker = newTemporal.hasMarker || existingTemporal.hasMarker;

      // Apply resolution
      const resolution = this.resolveContradiction(
        newMemory,
        existingMemory,
        hasTemporalMarker,
      );

      if (resolution !== 'parallel') {
        events.push({
          newMemory: this.toDTO(newMemory),
          conflictingMemory: this.toDTO(existingMemory),
          similarity: candidate.similarity,
          hasTemporalMarker,
          resolution,
        });
      }
    }

    return events;
  }

  /**
   * Resolve contradiction using typed-attribute matching
   *
   * Resolution logic:
   * - Temporal marker + identity/location = auto-supersede
   * - No temporal marker + strong typed match = pending (user choice)
   * - Weak match = parallel (keep both)
   *
   * @param newMemory - New memory
   * @param existingMemory - Existing conflicting memory
   * @param hasTemporalMarker - Whether temporal marker detected
   * @returns Resolution mode
   */
  private resolveContradiction(
    newMemory: MemoryInternal,
    existingMemory: MemoryInternal,
    hasTemporalMarker: boolean,
  ): 'supersede' | 'parallel' | 'pending' {
    // Auto-supersede identity/location with temporal marker
    if (hasTemporalMarker) {
      const type = newMemory.types[0] ?? 'preference';
      if (type === 'identity' || type === 'location') {
        return 'supersede';
      }
    }

    // Check for strong typed-attribute match
    const matchStrength = this.computeTypedAttributeMatch(newMemory, existingMemory);

    if (matchStrength > 0.7) {
      return hasTemporalMarker ? 'supersede' : 'pending';
    }

    return 'parallel';
  }

  /**
   * Compute typed-attribute match strength
   * Claude's discretion: implement matching algorithm
   *
   * @param memoryA - First memory
   * @param memoryB - Second memory
   * @returns Match strength (0-1)
   */
  private computeTypedAttributeMatch(
    memoryA: MemoryInternal,
    memoryB: MemoryInternal,
  ): number {
    // Claude's discretion: implement typed-attribute matching
    // Compare entities, types, content structure
    return 0;
  }

  private toDTO(memory: MemoryInternal): MemoryDTO {
    return {
      id: memory.id,
      content: memory.content,
      types: memory.types,
      status: memory.status,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
      validFrom: memory.validFrom,
      validTo: memory.validTo,
      baseStrength: memory.baseStrength,
      currentStrength: memory.currentStrength,
      pinned: memory.pinned,
      mentionCount: memory.mentionCount,
      lastAccessedAt: memory.lastAccessedAt,
      clusterId: memory.clusterId,
      entities: memory.entities.map((e) => JSON.stringify(e)),
      sourceConversationIds: memory.sourceConversationIds,
      supersededBy: memory.supersededBy,
      supersededAt: memory.supersededAt,
      fadedAt: memory.fadedAt,
      metadata: memory.metadata,
    };
  }
}

/**
 * ContradictionConfig - Configuration for contradiction detection
 */
export interface ContradictionConfig {
  /** Similarity threshold for contradiction candidates (default: 0.80) */
  similarityThreshold: number;

  /** Number of candidates to retrieve (default: 7) */
  candidateK: number;

  /** Resolution mode: 'auto' or 'manual' (default: 'auto') */
  resolutionMode: 'auto' | 'manual';
}
```

**Done:** ContradictionDetector.detect() retrieves candidates, filters by similarity > 0.80, checks temporal markers, applies resolution logic (supersede/parallel/pending), returns ContradictionEvent array.

---

### Task 2: Implement SupersessionManager class

**File:** `src/extraction/SupersessionManager.ts`

Implement supersession chain management:

```typescript
import type { MemoryRepository } from '../storage/MemoryRepository.js';
import type { ContradictionEvent } from './ContradictionDetector.js';

/**
 * SupersessionResult - Result of supersession operation
 */
export interface SupersessionResult {
  /** ID of superseded memory */
  oldMemoryId: string;

  /** ID of new memory */
  newMemoryId: string;

  /** Timestamp of supersession */
  timestamp: number;
}

export class SupersessionManager {
  constructor(private repository: MemoryRepository) {}

  /**
   * Apply supersession from contradiction event
   *
   * Process:
   * 1. Set existing memory status = 'superseded'
   * 2. Set supersededBy, supersededAt
   * 3. If temporal marker, set validTo/validFrom
   *
   * @param event - Contradiction event
   * @returns Supersession result
   */
  async applySupersession(event: ContradictionEvent): Promise<SupersessionResult> {
    const { newMemory, conflictingMemory, hasTemporalMarker } = event;

    // Supersede old memory
    await this.repository.supersede(conflictingMemory.id, newMemory.id);

    // If temporal marker, set validTo/validFrom
    if (hasTemporalMarker) {
      const now = Date.now();
      await this.repository.update(conflictingMemory.id, {
        validTo: now,
      });
      await this.repository.update(newMemory.id, {
        validFrom: now,
      });
    }

    return {
      oldMemoryId: conflictingMemory.id,
      newMemoryId: newMemory.id,
      timestamp: Date.now(),
    };
  }

  /**
   * Cleanup superseded memories older than 30 days
   * Strips content/embedding, creates tombstone
   *
   * @returns Number of tombstones created
   */
  async cleanupOldSuperseded(): Promise<number> {
    const expired = await this.repository.findExpiredSuperseded();

    for (const memory of expired) {
      await this.repository.stripToTombstone(memory.id);
    }

    return expired.length;
  }

  /**
   * Get full supersession chain
   *
   * @param memoryId - Starting memory ID
   * @returns Array of memories in chain
   */
  async getChain(memoryId: string): Promise<MemoryDTO[]> {
    const chain = await this.repository.getSupersessionChain(memoryId);
    return chain.map((m) => ({
      id: m.id,
      content: m.content,
      types: m.types,
      status: m.status,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      validFrom: m.validFrom,
      validTo: m.validTo,
      baseStrength: m.baseStrength,
      currentStrength: m.currentStrength,
      pinned: m.pinned,
      mentionCount: m.mentionCount,
      lastAccessedAt: m.lastAccessedAt,
      clusterId: m.clusterId,
      entities: m.entities.map((e) => JSON.stringify(e)),
      sourceConversationIds: m.sourceConversationIds,
      supersededBy: m.supersededBy,
      supersededAt: m.supersededAt,
      fadedAt: m.fadedAt,
      metadata: m.metadata,
    }));
  }
}
```

**Done:** SupersessionManager.applySupersession() sets superseded status and timestamps, sets validTo/validFrom when temporal marker present, cleanupOldSuperseded() creates tombstones, getChain() returns full supersession history.

---

### Task 3: Extend IPC protocol for contradiction events

**File:** `src/core/Protocol.ts`

Add contradiction detection message types:

```typescript
export const MessageType = {
  // ... existing types ...

  /** Contradiction detected in worker */
  CONTRADICTION_DETECTED: 'CONTRADICTION_DETECTED',

  /** Memory superseded event */
  MEMORY_SUPERSEDED: 'MEMORY_SUPERSEDED',
} as const;

/**
 * ContradictionDetected payload
 */
export interface ContradictionDetectedPayload {
  /** Contradiction event details */
  event: {
    newMemory: MemoryDTOPayload;
    conflictingMemory: MemoryDTOPayload;
    similarity: number;
    hasTemporalMarker: boolean;
    resolution: 'supersede' | 'parallel' | 'pending';
  };
}

/**
 * MemorySuperseded payload
 */
export interface MemorySupersededPayload {
  /** Old memory ID */
  oldMemoryId: string;

  /** New memory ID */
  newMemoryId: string;

  /** Timestamp */
  timestamp: number;
}
```

**Done:** Protocol.ts exports CONTRADICTION_DETECTED and MEMORY_SUPERSEDED message types, ContradictionDetectedPayload and MemorySupersededPayload interfaces defined.

---

### Task 4: Add contradiction handlers to WorkerManager

**File:** `src/core/WorkerManager.ts`

Add contradiction event forwarding:

```typescript
export class WorkerManager {
  // ... existing code ...

  /**
   * Register handler for contradiction events
   * @param handler - Event handler
   * @returns Unsubscribe function
   */
  onContradictionDetected(handler: (event: ContradictionEvent) => void): () => void {
    return this.on(MessageType.CONTRADICTION_DETECTED, (payload) => {
      handler(payload as ContradictionEvent);
    });
  }

  /**
   * Register handler for memory superseded events
   * @param handler - Event handler
   * @returns Unsubscribe function
   */
  onMemorySuperseded(handler: (event: SupersessionEvent) => void): () => void {
    return this.on(MessageType.MEMORY_SUPERSEDED, (payload) => {
      handler(payload as SupersessionEvent);
    });
  }
}
```

**Done:** WorkerManager.onContradictionDetected() and onMemorySuperseded() methods return unsubscribe functions, delegate to underlying on() method with correct message types.

---

### Task 5: Add public API callbacks to LokulMem

**File:** `src/core/LokulMem.ts`

Add public contradiction event callbacks:

```typescript
export class LokulMem {
  // ... existing code ...

  /**
   * Register callback for contradiction detection
   * @param handler - Event handler
   * @returns Unsubscribe function
   */
  onContradictionDetected(handler: (event: ContradictionEvent) => void): () => void {
    return this.workerManager.onContradictionDetected(handler);
  }

  /**
   * Register callback for memory superseded events
   * @param handler - Event handler
   * @returns Unsubscribe function
   */
  onMemorySuperseded(handler: (event: SupersessionEvent) => void): () => void {
    return this.workerManager.onMemorySuperseded(handler);
  }
}
```

**Done:** LokulMem.onContradictionDetected() and onMemorySuperseded() public methods return unsubscribe functions, delegate to WorkerManager event handlers.

---

### Task 6: Update extraction barrel file

**File:** `src/extraction/_index.ts`

Add contradiction detection exports:

```typescript
export { SpecificityNER, type SpecificityResult } from './SpecificityNER.js';
export { NoveltyCalculator } from './NoveltyCalculator.js';
export { RecurrenceTracker } from './RecurrenceTracker.js';
export { QualityScorer, type QualityInput } from './QualityScorer.js';
export {
  TemporalMarkerDetector,
  type TemporalMarker,
  type TemporalUpdate,
} from './TemporalMarkerDetector.js';
export {
  ContradictionDetector,
  SupersessionManager,
  type ContradictionEvent,
  type ContradictionCandidate,
  type SupersessionResult,
  type ContradictionConfig,
} from './ContradictionDetector.js';
```

**Done:** src/extraction/_index.ts exports all contradiction detection classes and types (ContradictionDetector, SupersessionManager, and their interfaces).

---

## Success Criteria

1. **Retrieve topK candidates (7)** with similarity > 0.80 threshold
2. **Typed-attribute matching** chooses best conflict resolution
3. **Temporal markers detected** via TemporalMarkerDetector from 07-02
4. **Temporal updates set validTo/validFrom** when contradiction resolved
5. **Typed attribute conflicts mark existing as superseded** with status change
6. **Contradiction events emitted** via onContradictionDetected callback
7. **Supersession chains preserved** with supersededBy, supersededAt, deletedAt fields
8. **30-day tombstone retention** with stripToTombstone() cleanup
9. **Full chain traceability** via getSupersessionChain()

---

## Notes

- **Claude's discretion areas:**
  - Typed-attribute matching algorithm implementation
  - Specific confidence thresholds for auto-resolution
  - Event callback signature and payload structure
  - Conflict domain mapping (which MemoryType maps to which conflict domain)
- **Supersession aggressiveness:** Type-specific behavior - auto-supersede identity/location facts, prefer parallel for others unless explicit temporal marker
- **Detection timing:** Run contradiction detection synchronously during every `learn()` call (not batched)
- **Supersession reversibility:** No - supersession is one-way only (users can re-learn if needed)
- **Event content:** IDs and metadata only - full content retrievable via `manage().get()` if needed
