/**
 * ContradictionDetector - Detects and resolves conflicting memories
 *
 * Identifies memories that contradict each other using:
 * - Vector similarity search within conflict domains
 * - Temporal marker detection for factual changes
 * - Typed-attribute matching for resolution decisions
 *
 * Per CONTEXT decisions:
 * - Events contain IDs and metadata only (NOT full MemoryDTO with content)
 * - Temporal marker decision based on NEW message, not existing
 * - ResolutionMode config branches detect() behavior
 * - Worker-side IPC event emission required
 */

import type { MemoryInternal } from '../internal/types.js';
import type { VectorSearch } from '../search/VectorSearch.js';
import type { MemoryRepository } from '../storage/MemoryRepository.js';
import type { TemporalMarkerDetector } from './TemporalMarkerDetector.js';

/**
 * ContradictionEvent - Emitted when contradiction detected
 *
 * CRITICAL: Per CONTEXT decision, events contain IDs and metadata only.
 * Full content retrievable via manage().get() if needed.
 * DTO violation: Do NOT include full MemoryDTO with content field.
 */
export interface ContradictionEvent {
  /** New memory ID that triggered contradiction */
  newMemoryId: string;

  /** Conflicting existing memory ID */
  conflictingMemoryId: string;

  /** Similarity score */
  similarity: number;

  /** Whether temporal marker detected in NEW message text */
  hasTemporalMarker: boolean;

  /** Resolution mode applied */
  resolution: 'supersede' | 'parallel' | 'pending';

  /** Timestamps for both memories */
  newMemoryCreatedAt: number;
  conflictingMemoryCreatedAt: number;

  /** Memory types for domain context */
  newMemoryTypes: string[];
  conflictingMemoryTypes: string[];

  /** Conflict domain */
  conflictDomain: string;
}

/**
 * ContradictionCandidate - Potential conflict from search
 */
export interface ContradictionCandidate {
  memory: MemoryInternal;
  similarity: number;
  hasTemporalMarker: boolean;
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

  /** Event callback for contradiction detection (worker-side) */
  onContradictionDetected?: (event: ContradictionEvent) => void;
}

/**
 * ContradictionDetector class for identifying and resolving conflicts
 */
export class ContradictionDetector {
  constructor(
    private vectorSearch: VectorSearch,
    private repository: MemoryRepository,
    private temporalDetector: TemporalMarkerDetector,
    private config: ContradictionConfig,
  ) {}

  /**
   * Emit event to worker IPC bus
   * CRITICAL FIX: Worker-side event emission for CONTRADICTION_DETECTED
   *
   * @param event - Contradiction event to emit
   */
  private emitContradictionEvent(event: ContradictionEvent): void {
    // Call the configured callback if provided
    if (this.config.onContradictionDetected) {
      this.config.onContradictionDetected(event);
    }
  }

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

      // Check for temporal markers - primarily in NEW message text
      // CRITICAL FIX: Base temporal decision on newTemporal.hasMarker
      // existingTemporal used for context only, not for flagging contradiction
      const newTemporal = this.temporalDetector.detect(newMemory.content);

      // CRITICAL: hasTemporalMarker based on NEW message, not existing
      const hasTemporalMarker = newTemporal.hasMarker;

      // Apply resolution based on config mode
      const resolution = await this.resolveContradiction(
        newMemory,
        existingMemory,
        hasTemporalMarker,
      );

      if (resolution !== 'parallel') {
        // CRITICAL: Return IDs and metadata only, NOT full DTOs
        const event: ContradictionEvent = {
          newMemoryId: newMemory.id,
          conflictingMemoryId: existingMemory.id,
          similarity: candidate.similarity,
          hasTemporalMarker,
          resolution,
          newMemoryCreatedAt: newMemory.createdAt,
          conflictingMemoryCreatedAt: existingMemory.createdAt,
          newMemoryTypes: newMemory.types,
          conflictingMemoryTypes: existingMemory.types,
          conflictDomain: newMemory.conflictDomain,
        };

        events.push(event);

        // CRITICAL FIX: Emit worker-side IPC event
        this.emitContradictionEvent(event);
      }
    }

    return events;
  }

  /**
   * Resolve contradiction using typed-attribute matching
   *
   * Resolution logic:
   * - If resolutionMode === 'manual': emit event with resolution='pending', do NOT supersede
   * - If resolutionMode === 'auto': apply typed-attribute matching
   *   - Temporal marker + identity/location = auto-supersede
   *   - No temporal marker + strong typed match = pending (user choice)
   *   - Weak match = parallel (keep both)
   *
   * CRITICAL FIX: resolutionMode config must branch detect() behavior
   *
   * @param newMemory - New memory
   * @param existingMemory - Existing conflicting memory
   * @param hasTemporalMarker - Whether temporal marker detected
   * @returns Resolution mode
   */
  private async resolveContradiction(
    newMemory: MemoryInternal,
    existingMemory: MemoryInternal,
    hasTemporalMarker: boolean,
  ): Promise<'supersede' | 'parallel' | 'pending'> {
    // CRITICAL FIX: Branch on resolutionMode config
    if (this.config.resolutionMode === 'manual') {
      // Manual mode: emit pending event, do NOT auto-supersede
      return 'pending';
    }

    // Auto mode: apply typed-attribute matching
    // Auto-supersede identity/location with temporal marker
    if (hasTemporalMarker) {
      const type = newMemory.types[0] ?? 'preference';
      if (type === 'identity' || type === 'location') {
        return 'supersede';
      }
    }

    // Check for strong typed-attribute match
    const matchStrength = this.computeTypedAttributeMatch(
      newMemory,
      existingMemory,
    );

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
    let matchScore = 0;

    // Type overlap: if both memories share the same primary type
    const typeA = memoryA.types[0];
    const typeB = memoryB.types[0];
    if (typeA && typeB && typeA === typeB) {
      matchScore += 0.3;
    }

    // Entity overlap: check for shared entities
    const entitiesA = new Set(memoryA.entities);
    const entitiesB = new Set(memoryB.entities);
    const sharedEntities = [...entitiesA].filter((e) => entitiesB.has(e));

    if (sharedEntities.length > 0) {
      // More shared entities = stronger match
      matchScore += Math.min(0.5, sharedEntities.length * 0.15);
    }

    // Conflict domain match
    if (memoryA.conflictDomain === memoryB.conflictDomain) {
      matchScore += 0.2;
    }

    return Math.min(1, matchScore);
  }
}
