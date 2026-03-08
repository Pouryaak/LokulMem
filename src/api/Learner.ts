import { AmbiguityTrigger } from '../extraction/AmbiguityTrigger.js';
import {
  CandidateFusion,
  type CandidateSource,
} from '../extraction/CandidateFusion.js';
import {
  type CanonicalizationResult,
  Canonicalizer,
} from '../extraction/Canonicalizer.js';
import type { ContradictionDetector } from '../extraction/ContradictionDetector.js';
import { EntityLinker, type LinkedEntity } from '../extraction/EntityLinker.js';
import {
  type FallbackExtractor,
  PatternFallbackExtractor,
} from '../extraction/FallbackExtractor.js';
import {
  type NormalizationMetadata,
  Normalizer,
} from '../extraction/Normalizer.js';
import type { NoveltyCalculator } from '../extraction/NoveltyCalculator.js';
import type { QualityScorer } from '../extraction/QualityScorer.js';
import type { RecurrenceTracker } from '../extraction/RecurrenceTracker.js';
import { RiskValidator } from '../extraction/RiskValidator.js';
import type { SpecificityNER } from '../extraction/SpecificityNER.js';
import type { SupersessionManager } from '../extraction/SupersessionManager.js';
import type { MemoryInternal } from '../internal/types.js';
import type { LifecycleManager } from '../lifecycle/LifecycleManager.js';
import {
  type WritePolicyDecision,
  WritePolicyEngine,
} from '../policy/WritePolicyEngine.js';
import type { QueryEngine } from '../search/QueryEngine.js';
import type { VectorSearch } from '../search/VectorSearch.js';
import type { MemoryRepository } from '../storage/MemoryRepository.js';
import type { ContradictionEvent } from '../types/events.js';
import type { MemoryDTO, MemoryType } from '../types/memory.js';
import type { EmbeddingEngine } from '../worker/EmbeddingEngine.js';
import type { EventManager } from './EventManager.js';
import type {
  ChatMessage,
  LearnDiagnostic,
  LearnOptions,
  LearnResult,
} from './types.js';

interface EvaluatedCandidate {
  origin: CandidateSource;
  source: string;
  normalization: NormalizationMetadata;
  extractionContent: string;
  matchingContent: string;
  scoreResult: {
    score: number;
    novelty: number;
    specificity: number;
    recurrence: number;
    meetsThreshold: boolean;
    threshold: number;
  };
  specificityResult: {
    memoryTypes: MemoryType[];
  };
  linkedEntities: LinkedEntity[];
  canonicalization: CanonicalizationResult;
  threshold: number;
  acceptedByScore: boolean;
  fallbackConfidence?: number;
  riskSignals: Array<
    | 'REPETITIVE_NOISE'
    | 'LOW_STRUCTURE_HIGH_SCORE'
    | 'AMBIGUOUS_TEMPORAL'
    | 'INTERROGATIVE_ONLY'
  >;
  accepted: boolean;
  candidate?: MemoryInternal;
  processingMs: number;
}

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
  private readonly normalizer = new Normalizer();
  private readonly canonicalizer = new Canonicalizer();
  private readonly entityLinker = new EntityLinker();
  private readonly riskValidator = new RiskValidator();
  private readonly writePolicyEngine = new WritePolicyEngine();
  private readonly ambiguityTrigger = new AmbiguityTrigger();
  private readonly candidateFusion = new CandidateFusion();
  private readonly fallbackExtractor: FallbackExtractor;

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
   * @param _noveltyCalculator - Novelty calculator (embedded in qualityScorer, passed for reference)
   * @param _recurrenceTracker - Recurrence tracker (embedded in qualityScorer, passed for reference)
   * @param embeddingEngine - Embedding engine for text embeddings
   * @param eventManager - Event manager for emitting events
   * @param config - Learner configuration
   */
  constructor(
    _queryEngine: QueryEngine, // Reserved for future use
    private vectorSearch: VectorSearch,
    private repository: MemoryRepository,
    private qualityScorer: QualityScorer,
    private contradictionDetector: ContradictionDetector,
    private supersessionManager: SupersessionManager,
    private lifecycleManager: LifecycleManager | null,
    private specificityNER: SpecificityNER,
    _noveltyCalculator: NoveltyCalculator, // Embedded in qualityScorer
    _recurrenceTracker: RecurrenceTracker, // Embedded in qualityScorer
    private embeddingEngine: EmbeddingEngine,
    private eventManager: EventManager,
    config: {
      extractionThreshold: number;
      fallbackExtractor?: FallbackExtractor;
    },
  ) {
    this.fallbackExtractor =
      config.fallbackExtractor ?? new PatternFallbackExtractor();
  }

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
      extractFrom = 'user', // Default to user messages only (assistant responses are usually not information sources)
      runMaintenance = false,
      learnThreshold,
      storeResponse = false,
      verbose = false,
    } = options;

    const conversationId =
      providedConversationId ?? this.generateConversationId();

    // Step 2: Collect extraction sources
    const sources: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (extractFrom === 'user' || extractFrom === 'both') {
      sources.push({ role: 'user', content: userMessage.content });
    }
    if (extractFrom === 'assistant' || extractFrom === 'both') {
      sources.push({ role: 'assistant', content: assistantResponse.content });
    }

    const startedAt = performance.now();
    const perSourceMs: number[] = [];

    // Step 3: Extract candidates using Phase 7 pipeline
    const candidates: MemoryInternal[] = [];
    const diagnostics: LearnDiagnostic[] = [];
    const policySupersessions: Array<{
      newMemoryId: string;
      targetMemoryId: string;
      hasTemporalMarker: boolean;
    }> = [];
    const activeMemoriesForPolicy =
      await this.repository.findByStatus('active');

    for (const sourceEntry of sources) {
      const sourceStartedAt = performance.now();

      const deterministic = await this.evaluateCandidate({
        source: sourceEntry.content,
        origin: 'deterministic',
        conversationId,
        ...(learnThreshold !== undefined && { learnThreshold }),
      });

      const ambiguityDecision = this.ambiguityTrigger.evaluate({
        content: deterministic.extractionContent,
        score: deterministic.scoreResult.score,
        threshold: deterministic.threshold,
        memoryTypes: deterministic.specificityResult.memoryTypes,
        entityCount: deterministic.linkedEntities.length,
        temporalBucket: deterministic.canonicalization.temporalBucket,
      });

      const evaluations: EvaluatedCandidate[] = [deterministic];
      let fallbackInvoked = false;
      let fallbackFactCount = 0;
      let fallbackProvider: 'pattern' | 'webllm' | 'noop' | undefined;
      let fallbackModel: string | undefined;
      let fallbackError: string | undefined;

      if (
        sourceEntry.role === 'user' &&
        ambiguityDecision.shouldTriggerFallback
      ) {
        fallbackInvoked = true;
        const fallback = await this.fallbackExtractor.extract({
          source: sourceEntry.content,
          conversationId,
        });
        fallbackProvider = fallback.provider;
        fallbackModel = fallback.model;
        fallbackError = fallback.error;

        for (const fact of fallback.facts) {
          fallbackFactCount += 1;
          const fallbackEvaluation = await this.evaluateCandidate({
            source: fact.text,
            origin: 'fallback',
            conversationId,
            fallbackConfidence: fact.confidence,
            ...(learnThreshold !== undefined && { learnThreshold }),
          });
          evaluations.push(fallbackEvaluation);
        }
      }

      const deduped = new Map<string, EvaluatedCandidate>();
      for (const evaluation of evaluations) {
        const key = `${evaluation.origin}:${evaluation.canonicalization.key}`;
        const existing = deduped.get(key);
        if (
          !existing ||
          evaluation.scoreResult.score > existing.scoreResult.score
        ) {
          deduped.set(key, evaluation);
        }
      }
      const dedupedEvaluations = Array.from(deduped.values());

      const fusionDecisions = this.candidateFusion.calibrate(
        dedupedEvaluations.map((evaluation) => ({
          source: evaluation.origin,
          canonicalKey: evaluation.canonicalization.key,
          score: evaluation.scoreResult.score,
          threshold: evaluation.threshold,
          accepted: evaluation.accepted,
          ...(evaluation.fallbackConfidence !== undefined && {
            fallbackConfidence: evaluation.fallbackConfidence,
          }),
        })),
      );

      for (const evaluation of dedupedEvaluations) {
        const fusion = fusionDecisions.find(
          (decision) =>
            decision.canonicalKey === evaluation.canonicalization.key &&
            decision.source === evaluation.origin,
        );
        const fusionAccepted = Boolean(fusion?.accepted);
        const fusionAgreement = Boolean(fusion?.agreement);

        let policyAction: WritePolicyDecision['action'] | undefined;
        let policyReasonCodes: WritePolicyDecision['reasonCodes'] | undefined;
        let policyTargetMemoryId: string | undefined;

        if (fusionAccepted && evaluation.candidate) {
          const policyDecision = this.writePolicyEngine.decide(
            evaluation.candidate,
            activeMemoriesForPolicy,
          );
          policyAction = policyDecision.action;
          policyReasonCodes = policyDecision.reasonCodes;
          policyTargetMemoryId = policyDecision.targetMemoryId;

          if (policyDecision.action !== 'IGNORE') {
            candidates.push(evaluation.candidate);
            activeMemoriesForPolicy.push(evaluation.candidate);

            if (
              (policyDecision.action === 'SUPERSEDE' ||
                policyDecision.action === 'UPDATE') &&
              policyDecision.targetMemoryId
            ) {
              policySupersessions.push({
                newMemoryId: evaluation.candidate.id,
                targetMemoryId: policyDecision.targetMemoryId,
                hasTemporalMarker: policyDecision.action === 'SUPERSEDE',
              });
            }
          }
        }

        if (verbose) {
          const diagnostic: LearnDiagnostic = {
            source: evaluation.source,
            extractionMode: evaluation.origin,
            normalizedSource: evaluation.matchingContent,
            extractionSource: evaluation.extractionContent,
            normalizationOperations: evaluation.normalization.operations,
            canonicalKey: evaluation.canonicalization.key,
            score: evaluation.scoreResult.score,
            novelty: evaluation.scoreResult.novelty,
            specificity: evaluation.scoreResult.specificity,
            recurrence: evaluation.scoreResult.recurrence,
            threshold: evaluation.threshold,
            accepted:
              fusionAccepted &&
              (policyAction === undefined || policyAction !== 'IGNORE'),
            memoryTypes: evaluation.specificityResult.memoryTypes,
            entityCount: evaluation.linkedEntities.length,
            linkedEntityCount: evaluation.linkedEntities.filter(
              (entity) => entity.linkReason !== 'new',
            ).length,
            riskSignals: evaluation.riskSignals,
            ambiguityTriggered: ambiguityDecision.shouldTriggerFallback,
            ambiguityReasons: ambiguityDecision.reasons,
            fallbackInvoked,
            fallbackFactCount,
            fusionAccepted,
            fusionAgreement,
            processingMs: evaluation.processingMs,
          };

          if (fallbackProvider !== undefined) {
            diagnostic.fallbackProvider = fallbackProvider;
          }
          if (fallbackModel !== undefined) {
            diagnostic.fallbackModel = fallbackModel;
          }
          if (fallbackError !== undefined) {
            diagnostic.fallbackError = fallbackError;
          }

          if (policyAction !== undefined) {
            diagnostic.policyAction = policyAction;
          }
          if (policyReasonCodes !== undefined) {
            diagnostic.policyReasonCodes = policyReasonCodes;
          }
          if (policyTargetMemoryId !== undefined) {
            diagnostic.policyTargetMemoryId = policyTargetMemoryId;
          }

          diagnostics.push(diagnostic);
        }
      }

      perSourceMs.push(performance.now() - sourceStartedAt);
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

    // Step 7: Apply deterministic policy supersessions before contradiction pass
    for (const supersession of policySupersessions) {
      const newMemory = candidates.find(
        (memory) => memory.id === supersession.newMemoryId,
      );
      const oldMemory = await this.repository.getById(
        supersession.targetMemoryId,
      );
      if (!newMemory || !oldMemory || oldMemory.status !== 'active') {
        continue;
      }

      const event: ContradictionEvent = {
        newMemoryId: newMemory.id,
        conflictingMemoryId: oldMemory.id,
        similarity: 1,
        hasTemporalMarker: supersession.hasTemporalMarker,
        resolution: 'supersede',
        newMemoryCreatedAt: newMemory.createdAt,
        conflictingMemoryCreatedAt: oldMemory.createdAt,
        newMemoryTypes: newMemory.types,
        conflictingMemoryTypes: oldMemory.types,
        conflictDomain: newMemory.conflictDomain,
      };

      const supersessionResult =
        await this.supersessionManager.applySupersession(event);
      this.vectorSearch.delete(supersessionResult.oldMemoryId);
      this.eventManager.emit('MEMORY_SUPERSEDED', {
        oldMemoryId: supersessionResult.oldMemoryId,
        newMemoryId: supersessionResult.newMemoryId,
        timestamp: supersessionResult.timestamp,
      });
    }

    // Step 8: Detect contradictions
    const contradictions: ContradictionEvent[] = [];

    for (const memory of candidates) {
      const events = await this.contradictionDetector.detect(memory);

      for (const event of events) {
        if (event.conflictingMemoryId === memory.id) {
          continue;
        }

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

    // Step 9: Optional maintenance sweep
    let maintenanceStats = { faded: 0, deleted: 0 };
    if (runMaintenance && this.lifecycleManager) {
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

    // Step 10: Optional episode storage
    if (storeResponse) {
      // Episodes would be stored here - for now this is a placeholder
      // await this.repository.addEpisode({
      //   conversationId,
      //   userMessage,
      //   assistantResponse,
      //   timestamp: Date.now()
      // });
    }

    // Step 11: Return result
    const result: LearnResult = {
      extracted: candidates.map((m) => this.toDTO(m)),
      contradictions,
      maintenance: maintenanceStats,
      conversationId,
    };

    if (verbose) {
      result.diagnostics = diagnostics;
      result.timings = {
        totalMs: performance.now() - startedAt,
        perSourceMs,
      };
    }

    return result;
  }

  private async evaluateCandidate(input: {
    source: string;
    origin: CandidateSource;
    conversationId: string;
    learnThreshold?: number;
    fallbackConfidence?: number;
  }): Promise<EvaluatedCandidate> {
    const startedAt = performance.now();
    const {
      source,
      origin,
      conversationId,
      learnThreshold,
      fallbackConfidence,
    } = input;

    const normalization = this.normalizer.buildNormalizationMetadata(source);
    const extractionContent = normalization.extractionNormalized;
    const matchingContent = normalization.normalized;

    const embedding = await this.getEmbedding(source);
    const scoreResult = await this.qualityScorer.score({
      content: extractionContent,
      embedding,
    });

    const specificityResult = this.specificityNER.analyze(extractionContent);
    const linkedEntities = this.entityLinker.resolve(
      specificityResult.entities,
      {
        conversationId,
      },
    );
    const canonicalization = this.canonicalizer.canonicalize({
      content: matchingContent,
      entities: linkedEntities,
      memoryTypes: specificityResult.memoryTypes,
      subject: 'user',
      scope: { conversationId },
    });

    const threshold = learnThreshold ?? scoreResult.threshold;
    const acceptedByScore =
      learnThreshold !== undefined
        ? scoreResult.score >= learnThreshold
        : scoreResult.meetsThreshold;
    const hasHighValueMemoryType = specificityResult.memoryTypes.some((type) =>
      ['identity', 'relational', 'profession'].includes(type),
    );
    const fallbackBoostAccepted =
      origin === 'fallback' &&
      fallbackConfidence !== undefined &&
      ((fallbackConfidence >= 0.8 &&
        specificityResult.memoryTypes.length > 0) ||
        (fallbackConfidence >= 0.72 &&
          hasHighValueMemoryType &&
          scoreResult.score >= threshold - 0.08));
    const riskValidation = this.riskValidator.validate({
      content: extractionContent,
      score: scoreResult.score,
      threshold,
      memoryTypes: specificityResult.memoryTypes,
      entities: linkedEntities,
      canonicalization,
    });
    const accepted =
      (acceptedByScore || fallbackBoostAccepted) && riskValidation.accepted;

    let candidate: MemoryInternal | undefined;
    if (accepted) {
      candidate = this.createMemory(
        source,
        linkedEntities,
        scoreResult.score,
        specificityResult.memoryTypes,
        normalization,
        canonicalization,
        conversationId,
        embedding,
      );
    }

    const evaluation: EvaluatedCandidate = {
      origin,
      source,
      normalization,
      extractionContent,
      matchingContent,
      scoreResult: {
        score: scoreResult.score,
        novelty: scoreResult.novelty,
        specificity: scoreResult.specificity,
        recurrence: scoreResult.recurrence,
        meetsThreshold: scoreResult.meetsThreshold,
        threshold: scoreResult.threshold,
      },
      specificityResult: {
        memoryTypes: specificityResult.memoryTypes,
      },
      linkedEntities,
      canonicalization,
      threshold,
      acceptedByScore,
      ...(fallbackConfidence !== undefined && { fallbackConfidence }),
      riskSignals: riskValidation.signals,
      accepted,
      processingMs: performance.now() - startedAt,
    };

    if (candidate !== undefined) {
      evaluation.candidate = candidate;
    }

    return evaluation;
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
    entities: LinkedEntity[],
    score: number,
    memoryTypes: MemoryType[],
    normalization: NormalizationMetadata,
    canonicalization: CanonicalizationResult,
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
        extractionNormalizedContent: normalization.extractionNormalized,
        normalizedContent: normalization.normalized,
        normalizationOperations: normalization.operations,
        canonical: {
          key: canonicalization.key,
          subject: canonicalization.subject,
          predicate: canonicalization.predicate,
          object: canonicalization.object,
          temporalBucket: canonicalization.temporalBucket,
          entities: canonicalization.entities,
        },
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
