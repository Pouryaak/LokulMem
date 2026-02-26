/**
 * Learner - Memory extraction from conversations
 *
 * Implements the learn() API which extracts memories from
 * user/assistant conversations using Phase 7 extraction pipeline.
 */

import type { ContradictionDetector } from '../extraction/ContradictionDetector.js';
import type { NoveltyCalculator } from '../extraction/NoveltyCalculator.js';
import type { QualityScorer } from '../extraction/QualityScorer.js';
import type { RecurrenceTracker } from '../extraction/RecurrenceTracker.js';
import type { SpecificityNER } from '../extraction/SpecificityNER.js';
import type { SupersessionManager } from '../extraction/SupersessionManager.js';
import type { MemoryInternal } from '../internal/types.js';
import type { LifecycleManager } from '../lifecycle/LifecycleManager.js';
import type { QueryEngine } from '../search/QueryEngine.js';
import type { VectorSearch } from '../search/VectorSearch.js';
import type { MemoryRepository } from '../storage/MemoryRepository.js';
import type { ContradictionEvent } from '../types/events.js';
import type { Entity, MemoryDTO, MemoryType } from '../types/memory.js';
import type { EmbeddingEngine } from '../worker/EmbeddingEngine.js';
import type { EventManager } from './EventManager.js';
import type { ChatMessage, LearnOptions, LearnResult } from './types.js';

/**
 * Learner class for extracting memories from conversations
 *
 * Handles:
 * - Entity extraction via SpecificityNER
 * - Novelty calculation via NoveltyCalculator
 * - Recurrence tracking via RecurrenceTracker
 * - Quality scoring via QualityScorer
 * - Contradiction detection via ContradictionDetector
 * - Supersession resolution via SupersessionManager
 * - Synchronous vector cache updates
 * - Optional maintenance sweeps
 */
export class Learner {
  /**
   * Create a new Learner instance
   * @param queryEngine - Query engine for semantic search
   * @param vectorSearch - Vector search for cache updates
   * @param repository - Memory repository for storage
   * @param qualityScorer - Quality scorer for extraction
   * @param contradictionDetector - Contradiction detector
   * @param supersessionManager - Supersession manager
   * @param lifecycleManager - Lifecycle manager for maintenance
   * @param specificityNER - Named entity recognition
   * @param noveltyCalculator - Novelty calculator
   * @param recurrenceTracker - Recurrence tracker
   * @param embeddingEngine - Embedding engine for text embeddings
   * @param eventManager - Event manager for emitting events
   * @param config - Learner configuration
   */
  constructor(
    private _queryEngine: QueryEngine,
    private vectorSearch: VectorSearch,
    private repository: MemoryRepository,
    private qualityScorer: QualityScorer,
    private contradictionDetector: ContradictionDetector,
    private supersessionManager: SupersessionManager,
    private lifecycleManager: LifecycleManager,
    private specificityNER: SpecificityNER,
    private _noveltyCalculator: NoveltyCalculator,
    private _recurrenceTracker: RecurrenceTracker,
    private embeddingEngine: EmbeddingEngine,
    private eventManager: EventManager,
    private config: {
      extractionThreshold: number;
    },
  ) {}

  /**
   * Learn from conversation by extracting memories
   *
   * @param userMessage - User's message
   * @param assistantResponse - Assistant's response
   * @param options - Learn options
   * @returns Extraction results with contradictions and maintenance
   */
  async learn(
    userMessage: ChatMessage,
    assistantResponse: ChatMessage,
    options: LearnOptions = {},
  ): Promise<LearnResult> {
    // Step 1: Handle options defaults
    const {
      conversationId: providedConversationId,
      extractFrom = 'both',
      runMaintenance = false,
      learnThreshold,
      storeResponse = false,
    } = options;

    const conversationId =
      providedConversationId ?? this.generateConversationId();

    // Step 2: Collect extraction sources
    const sources: string[] = [];
    if (extractFrom === 'user' || extractFrom === 'both') {
      sources.push(userMessage.content);
    }
    if (extractFrom === 'assistant' || extractFrom === 'both') {
      sources.push(assistantResponse.content);
    }

    // Step 3: Extract candidates using Phase 7 pipeline
    const candidates: MemoryInternal[] = [];

    for (const source of sources) {
      // Generate embedding for this source
      const embedding = await this.getEmbedding(source);

      // Calculate quality score using QualityScorer (does full pipeline internally)
      const scoreResult = await this.qualityScorer.score({
        content: source,
        embedding,
      });

      // Apply threshold
      const threshold = learnThreshold ?? this.config.extractionThreshold;
      if (scoreResult.meetsThreshold && scoreResult.score >= threshold) {
        // Extract entities for memory creation
        const specificityResult = this.specificityNER.analyze(source);
        candidates.push(
          this.createMemory(
            source,
            specificityResult.entities,
            scoreResult.score,
            specificityResult.memoryTypes,
            conversationId,
            embedding,
          ),
        );
      }
    }

    // Step 4: Store memories in database
    if (candidates.length > 0) {
      await this.repository.bulkCreate(candidates);
    }

    // CRITICAL STEP 5: Update vector cache IMMEDIATELY (synchronous guarantee)
    // This MUST happen before learn() resolves for the guarantee:
    // await learn(); await augment(); // new memory IS in results
    for (const memory of candidates) {
      this.vectorSearch.add(memory);
    }

    // Step 6: Emit MEMORY_ADDED events (after cache update)
    for (const memory of candidates) {
      this.eventManager.emit(
        'MEMORY_ADDED',
        this.eventManager.createMemoryEvent(this.toDTO(memory)),
      );
    }

    // Step 7: Detect contradictions
    const contradictions: ContradictionEvent[] = [];

    for (const memory of candidates) {
      const events = await this.contradictionDetector.detect(memory);

      for (const event of events) {
        // Apply supersession if resolution is 'supersede'
        if (event.resolution === 'supersede') {
          const supersessionResult =
            await this.supersessionManager.applySupersession(event);

          // Update cache to remove superseded memory
          this.vectorSearch.delete(supersessionResult.oldMemoryId);

          // Emit supersession event
          this.eventManager.emit('MEMORY_SUPERSEDED', {
            oldMemoryId: supersessionResult.oldMemoryId,
            newMemoryId: memory.id,
            timestamp: Date.now(),
          });
        }

        // Emit contradiction event
        this.eventManager.emit('CONTRADICTION_DETECTED', event);

        contradictions.push(event);
      }
    }

    // Step 8: Optional maintenance sweep
    let maintenanceStats = { faded: 0, deleted: 0 };
    if (runMaintenance) {
      // Get maintenance sweep from LifecycleManager
      const maintenanceSweep = (
        this.lifecycleManager as unknown as {
          maintenanceSweep: {
            runSweep: () => Promise<{
              fadedCount: number;
              deletedCount: number;
              fadedMemories?: MemoryDTO[];
            }>;
          };
        }
      ).maintenanceSweep;
      const sweepResult = await maintenanceSweep.runSweep();
      maintenanceStats = {
        faded: sweepResult.fadedCount,
        deleted: sweepResult.deletedCount,
      };

      // Emit MEMORY_FADED events for each faded memory
      if (sweepResult.fadedMemories) {
        for (const fadedMemory of sweepResult.fadedMemories) {
          this.eventManager.emit(
            'MEMORY_FADED',
            this.eventManager.createMemoryEvent(fadedMemory),
          );
        }
      }

      // Emit STATS_CHANGED after maintenance (already emitted via repository hooks)
      // No additional stats() call needed - events fire at mutation point
    }

    // Step 8: Optional episode storage
    if (storeResponse) {
      // Episodes would be stored here - for now this is a placeholder
      // await this.repository.addEpisode({
      //   conversationId,
      //   userMessage,
      //   assistantResponse,
      //   timestamp: Date.now()
      // });
    }

    // Step 9: Return result
    return {
      extracted: candidates.map((m) => this.toDTO(m)),
      contradictions,
      maintenance: maintenanceStats,
      conversationId,
    };
  }

  /**
   * Generate a unique conversation ID
   * @returns UUID v4 string
   */
  private generateConversationId(): string {
    return crypto.randomUUID();
  }

  /**
   * Create a MemoryInternal from extraction results
   * @param content - Memory content
   * @param entities - Extracted entities
   * @param score - Quality score
   * @param memoryTypes - Detected memory types
   * @param conversationId - Conversation ID
   * @param embedding - Text embedding
   * @returns MemoryInternal object
   */
  private createMemory(
    content: string,
    entities: Entity[],
    score: number,
    memoryTypes: MemoryType[],
    conversationId: string,
    embedding: Float32Array,
  ): MemoryInternal {
    const now = Date.now();

    return {
      id: crypto.randomUUID(),
      content,
      types: memoryTypes.length > 0 ? memoryTypes : ['preference'],
      status: 'active',
      createdAt: now,
      updatedAt: now,
      validFrom: now,
      validTo: null,
      baseStrength: 1.0,
      currentStrength: 1.0,
      pinned: false,
      mentionCount: 0,
      lastAccessedAt: now,
      clusterId: null,
      entities: entities.map((e) => e.value),
      sourceConversationIds: [conversationId],
      supersededBy: null,
      supersededAt: null,
      fadedAt: null,
      embedding,
      conflictDomain: this.inferConflictDomain(memoryTypes),
      metadata: {
        extractionScore: score,
        extractedEntities: entities,
      },
    };
  }

  /**
   * Infer conflict domain from memory types
   * @param types - Memory types
   * @returns Conflict domain
   */
  private inferConflictDomain(
    types: MemoryType[],
  ): import('../internal/types.js').ConflictDomain {
    const domainMapping: Partial<
      Record<MemoryType, import('../internal/types.js').ConflictDomain>
    > = {
      identity: 'identity',
      location: 'location',
      profession: 'profession',
      preference: 'preference',
      temporal: 'temporal',
      relational: 'relational',
      emotional: 'emotional',
      project: 'project',
    };

    // Return the first mapped conflict domain, or 'preference' as default
    for (const type of types) {
      const domain = domainMapping[type];
      if (domain) {
        return domain;
      }
    }

    return 'preference';
  }

  /**
   * Convert MemoryInternal to MemoryDTO (excludes embedding)
   * @param memory - MemoryInternal object
   * @returns MemoryDTO object
   */
  private toDTO(memory: MemoryInternal): MemoryDTO {
    const { embedding, conflictDomain, ...dto } = memory;
    return dto as MemoryDTO;
  }

  /**
   * Get embedding for text via EmbeddingEngine
   * @param text - Text to embed
   * @returns Float32Array embedding
   */
  private async getEmbedding(text: string): Promise<Float32Array> {
    return this.embeddingEngine.embed(text);
  }
}
