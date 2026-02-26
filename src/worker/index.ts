/**
 * LokulMem Worker - Runs in Web Worker context
 *
 * Handles:
 * - Embedding computation via Transformers.js
 * - Vector search operations
 * - Memory lifecycle maintenance
 * - Storage operations via Dexie.js
 */

import { Augmenter } from '../api/Augmenter.js';
import { EventManager } from '../api/EventManager.js';
import { Learner } from '../api/Learner.js';
import type {
  EmbedBatchPayload,
  EmbedBatchResponsePayload,
  EmbedPayload,
  EmbedResponsePayload,
  InitPayload,
  ModelConfig,
  ProgressMessage,
  RequestMessage,
  ResponseMessage,
} from '../core/Protocol.js';
import { MessageType as MessageTypeConst } from '../core/Protocol.js';
import type { PortLike } from '../core/types.js';
import { TemporalMarkerDetector } from '../extraction/TemporalMarkerDetector.js';
import type {
  AugmentPayload,
  AugmentResponsePayload,
  GetPayload,
  LearnPayload,
  LearnResponsePayload,
  ListPayload,
  SearchPayload,
  SemanticSearchPayload,
} from '../ipc/protocol-types.js';
import { LifecycleManager } from '../lifecycle/_index.js';
import type { LifecycleConfig } from '../lifecycle/types.js';
import { QueryEngine } from '../search/QueryEngine.js';
import { VectorSearch } from '../search/VectorSearch.js';
import { LokulDatabase } from '../storage/Database.js';
import { MemoryRepository } from '../storage/MemoryRepository.js';
import type { InitStage } from '../types/api.js';
import type { FallbackLLMConfig } from '../types/api.js';
import { EmbeddingEngine } from './EmbeddingEngine.js';

/**
 * Order of initialization stages
 */
const stageOrder: InitStage[] = [
  'worker',
  'model',
  'storage',
  'maintenance',
  'ready',
];

/**
 * Stage weights for overall progress calculation (each stage = 20%)
 */
const stageWeights: Record<InitStage, number> = {
  worker: 0.2,
  model: 0.2,
  storage: 0.2,
  maintenance: 0.2,
  ready: 0.2,
};

/**
 * Singleton embedding engine instance
 */
let embeddingEngine: EmbeddingEngine | null = null;

/**
 * Singleton database instance
 */
let database: LokulDatabase | null = null;

/**
 * Singleton memory repository instance
 */
let repository: MemoryRepository | null = null;

/**
 * Singleton vector search instance
 */
let vectorSearch: VectorSearch | null = null;

/**
 * Singleton query engine instance
 */
let queryEngine: QueryEngine | null = null;

/**
 * Singleton lifecycle manager instance
 */
let lifecycleManager: LifecycleManager | null = null;

/**
 * Singleton event manager instance
 */
let eventManager: EventManager | null = null;

/**
 * Extraction threshold from init config (default: 0.45)
 */
let configuredExtractionThreshold = 0.45;

/**
 * Optional fallback LLM extraction config from init payload
 */
let configuredFallbackLLM: FallbackLLMConfig | undefined;

/**
 * Singleton augmenter instance
 */
let augmenter: Augmenter | null = null;

/**
 * Singleton learner instance
 */
let learner: Learner | null = null;

/**
 * Calculate overall progress based on current stage and stage progress
 */
function calculateOverallProgress(
  stage: InitStage,
  stageProgress: number,
): number {
  const currentStageIndex = stageOrder.indexOf(stage);
  const completedStages = currentStageIndex * 0.2;
  const currentStageContribution = (stageProgress / 100) * stageWeights[stage];
  return (completedStages + currentStageContribution) * 100;
}

/**
 * Report progress to the main thread
 */
function reportProgress(
  port: PortLike,
  stage: InitStage,
  stageProgress: number,
): void {
  const overallProgress = calculateOverallProgress(stage, stageProgress);

  const message: ProgressMessage = {
    type: 'progress',
    stage,
    stageProgress,
    overallProgress,
    message: `${stage}: ${stageProgress}%`,
  };

  port.postMessage(message);
}

/**
 * Set up message handling on a port
 */
function setupPort(port: PortLike): void {
  port.onmessage = async (event: MessageEvent<RequestMessage>) => {
    const request = event.data;

    if (!request || typeof request !== 'object' || !('type' in request)) {
      console.warn('Received malformed message:', request);
      return;
    }

    switch (request.type) {
      case MessageTypeConst.INIT:
        await handleInit(port, request);
        break;
      case MessageTypeConst.PING:
        handlePing(port, request);
        break;
      case MessageTypeConst.EMBED:
        await handleEmbed(port, request);
        break;
      case MessageTypeConst.EMBED_BATCH:
        await handleEmbedBatch(port, request);
        break;
      case MessageTypeConst.LIST:
        await handleList(port, request);
        break;
      case MessageTypeConst.GET:
        await handleGet(port, request);
        break;
      case MessageTypeConst.SEARCH:
        await handleSearch(port, request);
        break;
      case MessageTypeConst.SEMANTIC_SEARCH:
        await handleSemanticSearch(port, request);
        break;
      case MessageTypeConst.AUGMENT:
        await handleAugment(port, request);
        break;
      case MessageTypeConst.LEARN:
        await handleLearn(port, request);
        break;
      case MessageTypeConst.MEMORY_UPDATE:
        await handleMemoryUpdate(port, request);
        break;
      case MessageTypeConst.MEMORY_PIN:
        await handleMemoryPin(port, request);
        break;
      case MessageTypeConst.MEMORY_UNPIN:
        await handleMemoryUnpin(port, request);
        break;
      case MessageTypeConst.MEMORY_DELETE:
        await handleMemoryDelete(port, request);
        break;
      case MessageTypeConst.MEMORY_STATS:
        await handleMemoryStats(port, request);
        break;
      default:
        console.warn('Unknown message type:', request.type);
    }
  };
}

/**
 * Handle PING request with PONG response
 */
function handlePing(port: PortLike, request: RequestMessage): void {
  const response: ResponseMessage = {
    id: request.id,
    type: MessageTypeConst.PONG,
    payload: { timestamp: Date.now() },
  };
  port.postMessage(response);
}

/**
 * Handle EMBED request for single text embedding
 */
async function handleEmbed(
  port: PortLike,
  request: RequestMessage,
): Promise<void> {
  // Check if embedding engine is initialized
  if (!embeddingEngine?.isReady()) {
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'NOT_INITIALIZED',
        message: 'EmbeddingEngine not initialized. Call initialize() first.',
        details: {
          recoveryHint:
            'Ensure the worker is initialized before sending EMBED requests',
        },
      },
    };
    port.postMessage(response);
    return;
  }

  try {
    const payload = request.payload as EmbedPayload;
    const embedding = await embeddingEngine.embed(payload.text);

    // Convert Float32Array to number[] for serialization
    const responsePayload: EmbedResponsePayload = {
      embedding: Array.from(embedding),
      dimensions: embedding.length,
    };

    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.EMBED,
      payload: responsePayload,
    };
    port.postMessage(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const recoveryHint =
      error instanceof Error && 'recoveryHint' in error
        ? (error as Error & { recoveryHint: string }).recoveryHint
        : 'Check model configuration and try again';

    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'EMBED_FAILED',
        message: errorMessage,
        details: { recoveryHint },
      },
    };
    port.postMessage(response);
  }
}

/**
 * Handle EMBED_BATCH request for batch text embedding
 */
async function handleEmbedBatch(
  port: PortLike,
  request: RequestMessage,
): Promise<void> {
  // Check if embedding engine is initialized
  if (!embeddingEngine?.isReady()) {
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'NOT_INITIALIZED',
        message: 'EmbeddingEngine not initialized. Call initialize() first.',
        details: {
          recoveryHint:
            'Ensure the worker is initialized before sending EMBED_BATCH requests',
        },
      },
    };
    port.postMessage(response);
    return;
  }

  try {
    const payload = request.payload as EmbedBatchPayload;
    const embeddings = await embeddingEngine.embedBatch(payload.texts);

    // Convert Float32Array[] to number[][] for serialization
    const responsePayload: EmbedBatchResponsePayload = {
      embeddings: embeddings.map((emb) => Array.from(emb)),
      dimensions: embeddings.length > 0 ? (embeddings[0]?.length ?? 0) : 0,
    };

    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.EMBED_BATCH,
      payload: responsePayload,
    };
    port.postMessage(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const recoveryHint =
      error instanceof Error && 'recoveryHint' in error
        ? (error as Error & { recoveryHint: string }).recoveryHint
        : 'Check model configuration and try again';

    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'EMBED_BATCH_FAILED',
        message: errorMessage,
        details: { recoveryHint },
      },
    };
    port.postMessage(response);
  }
}

/**
 * Handle LIST request for memory listing
 */
async function handleList(
  port: PortLike,
  request: RequestMessage,
): Promise<void> {
  console.log('[Worker] handleList called, queryEngine:', !!queryEngine);

  if (!queryEngine) {
    console.log('[Worker] handleList ERROR: queryEngine not initialized');
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'NOT_INITIALIZED',
        message: 'Query engine not initialized. Call initialize() first.',
        details: {
          recoveryHint:
            'Ensure the worker is initialized before sending LIST requests',
        },
      },
    };
    port.postMessage(response);
    return;
  }

  try {
    console.log('[Worker] handleList calling queryEngine.list...');
    const payload = request.payload as ListPayload;
    const result = await queryEngine.list(payload.options);
    console.log('[Worker] handleList got result:', result.total, 'memories');

    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.LIST,
      payload: result, // Return result directly, not wrapped in { result }
    };
    console.log('[Worker] handleList posting response');
    port.postMessage(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'LIST_FAILED',
        message: errorMessage,
        details: { recoveryHint: 'Check query options and try again' },
      },
    };
    port.postMessage(response);
  }
}

/**
 * Handle GET request for single memory retrieval
 */
async function handleGet(
  port: PortLike,
  request: RequestMessage,
): Promise<void> {
  if (!queryEngine) {
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'NOT_INITIALIZED',
        message: 'Query engine not initialized. Call initialize() first.',
        details: {
          recoveryHint:
            'Ensure the worker is initialized before sending GET requests',
        },
      },
    };
    port.postMessage(response);
    return;
  }

  try {
    const payload = request.payload as GetPayload;
    const memory = await queryEngine.get(payload.id, payload.includeEmbedding);

    // Reinforce memory access if lifecycle manager is available
    if (memory && lifecycleManager && repository) {
      const internalMemory = await repository.getById(memory.id);
      if (internalMemory) {
        await lifecycleManager.recordAccess(internalMemory);
      }
    }

    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.GET,
      payload: { memory },
    };
    port.postMessage(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'GET_FAILED',
        message: errorMessage,
        details: { recoveryHint: 'Check memory ID and try again' },
      },
    };
    port.postMessage(response);
  }
}

/**
 * Handle SEARCH request for full-text search
 */
async function handleSearch(
  port: PortLike,
  request: RequestMessage,
): Promise<void> {
  if (!queryEngine) {
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'NOT_INITIALIZED',
        message: 'Query engine not initialized. Call initialize() first.',
        details: {
          recoveryHint:
            'Ensure the worker is initialized before sending SEARCH requests',
        },
      },
    };
    port.postMessage(response);
    return;
  }

  try {
    const payload = request.payload as SearchPayload;
    const result = await queryEngine.search(payload.query, payload.options);

    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.SEARCH,
      payload: result, // Return result directly, not wrapped in { result }
    };
    port.postMessage(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'SEARCH_FAILED',
        message: errorMessage,
        details: { recoveryHint: 'Check query text and options' },
      },
    };
    port.postMessage(response);
  }
}

/**
 * Handle SEMANTIC_SEARCH request for vector similarity search
 */
async function handleSemanticSearch(
  port: PortLike,
  request: RequestMessage,
): Promise<void> {
  if (!queryEngine) {
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'NOT_INITIALIZED',
        message: 'Query engine not initialized. Call initialize() first.',
        details: {
          recoveryHint:
            'Ensure the worker is initialized before sending SEMANTIC_SEARCH requests',
        },
      },
    };
    port.postMessage(response);
    return;
  }

  try {
    const payload = request.payload as SemanticSearchPayload;
    const memories = await queryEngine.semanticSearch(
      payload.query,
      payload.options,
    );

    // Reinforce memories from semantic search if lifecycle manager is available
    // When composite scoring is enabled, results are already ranked by relevance
    if (
      payload.options?.useCompositeScoring !== false &&
      lifecycleManager &&
      repository
    ) {
      // Reinforce all returned memories (they are already filtered and ranked)
      for (const dto of memories) {
        const memory = await repository.getById(dto.id);
        if (memory) {
          await lifecycleManager.recordAccess(memory);
        }
      }
    }

    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.SEMANTIC_SEARCH,
      payload: { memories },
    };
    port.postMessage(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'SEMANTIC_SEARCH_FAILED',
        message: errorMessage,
        details: { recoveryHint: 'Check query text and options' },
      },
    };
    port.postMessage(response);
  }
}

/**
 * Handle AUGMENT request for memory augmentation
 */
async function handleAugment(
  port: PortLike,
  request: RequestMessage,
): Promise<void> {
  if (!augmenter) {
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'NOT_INITIALIZED',
        message: 'Augmenter not initialized',
      },
    };
    port.postMessage(response);
    return;
  }

  try {
    const payload = request.payload as AugmentPayload;
    const result = await augmenter.augment(
      payload.userMessage,
      payload.history,
      payload.options,
    );

    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.AUGMENT,
      payload: result as AugmentResponsePayload,
    };
    port.postMessage(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'AUGMENT_ERROR',
        message: errorMessage,
      },
    };
    port.postMessage(response);
  }
}

/**
 * Handle LEARN request for memory extraction
 */
async function handleLearn(
  port: PortLike,
  request: RequestMessage,
): Promise<void> {
  if (!learner) {
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'NOT_INITIALIZED',
        message: 'Learner not initialized',
      },
    };
    port.postMessage(response);
    return;
  }

  try {
    const payload = request.payload as LearnPayload;
    const result = await learner.learn(
      payload.userMessage,
      payload.assistantResponse,
      payload.options,
    );

    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.LEARN,
      payload: result as LearnResponsePayload,
    };
    port.postMessage(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'LEARN_ERROR',
        message: errorMessage,
      },
    };
    port.postMessage(response);
  }
}

/**
 * Handle MEMORY_UPDATE request
 */
async function handleMemoryUpdate(
  port: PortLike,
  request: RequestMessage,
): Promise<void> {
  if (!repository) {
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'NOT_INITIALIZED',
        message: 'Repository not initialized',
      },
    };
    port.postMessage(response);
    return;
  }

  try {
    const payload = request.payload as { id: string; updates: unknown };
    const memory = await repository.getById(payload.id);

    if (!memory) {
      throw new Error(`Memory not found: ${payload.id}`);
    }

    // Apply updates to memory
    const updates = payload.updates as Partial<
      import('../types/memory.js').MemoryDTO
    >;
    const updatedMemory = { ...memory, ...updates, updatedAt: Date.now() };

    await repository.update(updatedMemory);

    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.MEMORY_UPDATE,
      payload: { id: payload.id, status: 'updated' },
    };
    port.postMessage(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'MEMORY_UPDATE_FAILED',
        message: errorMessage,
      },
    };
    port.postMessage(response);
  }
}

/**
 * Handle MEMORY_PIN request
 */
async function handleMemoryPin(
  port: PortLike,
  request: RequestMessage,
): Promise<void> {
  if (!repository) {
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'NOT_INITIALIZED',
        message: 'Repository not initialized',
      },
    };
    port.postMessage(response);
    return;
  }

  try {
    const payload = request.payload as { id: string };
    const memory = await repository.getById(payload.id);

    if (!memory) {
      throw new Error(`Memory not found: ${payload.id}`);
    }

    // Update pinned status
    const updatedMemory = { ...memory, pinned: true, updatedAt: Date.now() };
    await repository.update(updatedMemory);

    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.MEMORY_PIN,
      payload: { id: payload.id, status: 'pinned' },
    };
    port.postMessage(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'MEMORY_PIN_FAILED',
        message: errorMessage,
      },
    };
    port.postMessage(response);
  }
}

/**
 * Handle MEMORY_UNPIN request
 */
async function handleMemoryUnpin(
  port: PortLike,
  request: RequestMessage,
): Promise<void> {
  if (!repository) {
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'NOT_INITIALIZED',
        message: 'Repository not initialized',
      },
    };
    port.postMessage(response);
    return;
  }

  try {
    const payload = request.payload as { id: string };
    const memory = await repository.getById(payload.id);

    if (!memory) {
      throw new Error(`Memory not found: ${payload.id}`);
    }

    // Update pinned status
    const updatedMemory = { ...memory, pinned: false, updatedAt: Date.now() };
    await repository.update(updatedMemory);

    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.MEMORY_UNPIN,
      payload: { id: payload.id, status: 'unpinned' },
    };
    port.postMessage(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'MEMORY_UNPIN_FAILED',
        message: errorMessage,
      },
    };
    port.postMessage(response);
  }
}

/**
 * Handle MEMORY_DELETE request
 */
async function handleMemoryDelete(
  port: PortLike,
  request: RequestMessage,
): Promise<void> {
  if (!repository) {
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'NOT_INITIALIZED',
        message: 'Repository not initialized',
      },
    };
    port.postMessage(response);
    return;
  }

  try {
    const payload = request.payload as { id: string };
    await repository.delete(payload.id);

    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.MEMORY_DELETE,
      payload: { id: payload.id, status: 'deleted' },
    };
    port.postMessage(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'MEMORY_DELETE_FAILED',
        message: errorMessage,
      },
    };
    port.postMessage(response);
  }
}

/**
 * Handle MEMORY_STATS request
 */
async function handleMemoryStats(
  port: PortLike,
  request: RequestMessage,
): Promise<void> {
  if (!repository) {
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'NOT_INITIALIZED',
        message: 'Repository not initialized',
      },
    };
    port.postMessage(response);
    return;
  }

  try {
    // Get all memories to compute stats
    const memories = await repository.getAll();

    // Compute statistics
    const totalMemories = memories.length;
    const activeMemories = memories.filter((m) => m.status === 'active').length;
    const fadedMemories = memories.filter((m) => m.status === 'faded').length;
    const pinnedMemories = memories.filter((m) => m.pinned).length;

    let averageStrength = 0;
    if (memories.length > 0) {
      const sumStrength = memories.reduce(
        (sum: number, m) => sum + m.currentStrength,
        0,
      );
      averageStrength = sumStrength / memories.length;
    }

    let oldestMemoryAt: number | null = null;
    let newestMemoryAt: number | null = null;
    if (memories.length > 0) {
      const timestamps = memories.map((m) => m.createdAt);
      oldestMemoryAt = Math.min(...timestamps);
      newestMemoryAt = Math.max(...timestamps);
    }

    const stats = {
      totalMemories,
      activeMemories,
      fadedMemories,
      pinnedMemories,
      averageStrength,
      oldestMemoryAt,
      newestMemoryAt,
    };

    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.MEMORY_STATS,
      payload: stats,
    };
    port.postMessage(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'MEMORY_STATS_FAILED',
        message: errorMessage,
      },
    };
    port.postMessage(response);
  }
}

/**
 * Initialize lifecycle management
 */
async function initializeLifecycle(config: LifecycleConfig): Promise<void> {
  if (!embeddingEngine || !repository || !vectorSearch) {
    throw new Error('Dependencies not ready');
  }
  lifecycleManager = new LifecycleManager(repository, vectorSearch, config);
  await lifecycleManager.initialize();
  // Note: Progress will be reported by the caller (handleInit)
}

/**
 * Handle initialization request with progress reporting through all 5 stages
 */
async function handleInit(
  port: PortLike,
  request: RequestMessage,
): Promise<void> {
  const payload = request.payload as InitPayload;

  try {
    // Store extraction threshold from config
    if (payload.extractionThreshold !== undefined) {
      configuredExtractionThreshold = payload.extractionThreshold;
    }
    configuredFallbackLLM = payload.modelConfig?.fallbackLLM;

    // Stage 1: Worker initialization (complete - we're running)
    reportProgress(port, 'worker', 100);

    // Stage 2: Model initialization
    reportProgress(port, 'model', 0);
    await initializeModel(port, payload.modelConfig);
    reportProgress(port, 'model', 100);

    // Stage 3: Storage initialization
    reportProgress(port, 'storage', 0);
    await initializeStorage(payload.dbName);
    reportProgress(port, 'storage', 100);

    // Stage 3.5: Query engine initialization (part of storage stage)
    await initializeQueryEngine();

    // Stage 3.6: API components initialization (after all dependencies ready)
    await initializeAPIComponents();

    // Stage 4: Maintenance - initialize lifecycle if configured
    reportProgress(port, 'maintenance', 0);
    if (payload.lifecycleConfig) {
      await initializeLifecycle(payload.lifecycleConfig);
    } else {
      await runMaintenance();
    }
    reportProgress(port, 'maintenance', 100);

    // Stage 5: Ready
    reportProgress(port, 'ready', 100);

    // Send success response
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.INIT,
      payload: { ok: true },
    };
    port.postMessage(response);
  } catch (error) {
    // Send error response
    const errorMessage = error instanceof Error ? error.message : String(error);
    const recoveryHint =
      error instanceof Error && 'recoveryHint' in error
        ? (error as Error & { recoveryHint: string }).recoveryHint
        : 'Check configuration and try again';

    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'INIT_FAILED',
        message: errorMessage,
        details: { recoveryHint },
      },
    };
    port.postMessage(response);
  }
}

/**
 * Create a PortLike wrapper for DedicatedWorkerGlobalScope
 * DedicatedWorker uses self directly (not a MessagePort like SharedWorker)
 */
function createWorkerPortLike(
  workerScope: DedicatedWorkerGlobalScope,
): PortLike {
  return {
    postMessage: (data: unknown, transfer?: Transferable[]) => {
      if (transfer) {
        workerScope.postMessage(data, transfer);
      } else {
        workerScope.postMessage(data);
      }
    },
    onmessage: null,
    onmessageerror: null,
    addEventListener: (
      type: string,
      listener: (event: Event) => void,
      options?: AddEventListenerOptions | boolean,
    ) => {
      workerScope.addEventListener(type, listener, options);
    },
    removeEventListener: (
      type: string,
      listener: (event: Event) => void,
      options?: EventListenerOptions | boolean,
    ) => {
      workerScope.removeEventListener(type, listener, options);
    },
  };
}

// Stubs for future phases

/**
 * Initialize the embedding model (Phase 4)
 */
async function initializeModel(
  port: PortLike,
  config?: ModelConfig,
): Promise<void> {
  // Get or create the singleton embedding engine
  embeddingEngine = EmbeddingEngine.getInstance();

  // Initialize with progress reporting
  await embeddingEngine.initialize(
    config,
    (stage: string, progress: number) => {
      // Map internal stages to progress within the 'model' stage
      // stage can be 'download', 'init', 'ready', etc.
      let stageProgress = progress;

      // Normalize progress to 0-100 range for the model stage
      if (stage === 'download') {
        // Download phase: 0-70%
        stageProgress = Math.round(progress * 0.7);
      } else if (stage === 'init') {
        // Init/WASM phase: 70-100%
        stageProgress = 70 + Math.round(progress * 0.3);
      } else if (stage === 'ready') {
        stageProgress = 100;
      }

      reportProgress(port, 'model', stageProgress);
    },
  );
}

/**
 * Initialize storage layer (Phase 3)
 */
async function initializeStorage(dbName: string): Promise<void> {
  // Note: LokulDatabase uses hardcoded name 'LokulMemDB'
  // dbName parameter is kept for API compatibility but not used
  console.log(`[Worker] Initializing storage (requested: ${dbName})`);

  // Create database instance
  database = new LokulDatabase();
  await database.open();

  // Create repository
  repository = new MemoryRepository(database);
  console.log('[Worker] Storage layer initialized');
}

/**
 * Initialize query engine (Phase 5)
 */
async function initializeQueryEngine(): Promise<void> {
  if (!embeddingEngine || !repository) {
    throw new Error(
      'Embedding engine and repository must be initialized first',
    );
  }

  // Create vector search
  vectorSearch = new VectorSearch(repository, embeddingEngine);
  await vectorSearch.initialize();

  // Create query engine
  queryEngine = new QueryEngine(repository, vectorSearch, embeddingEngine);
  console.log('[Worker] Query engine initialized');
}

/**
 * Initialize API components (Augmenter, Learner, Manager)
 */
async function initializeAPIComponents(): Promise<void> {
  if (!queryEngine || !vectorSearch || !repository || !embeddingEngine) {
    throw new Error('Dependencies not ready');
  }

  // Initialize EventManager first (needed by other components)
  eventManager = new EventManager({
    verboseEvents: false, // Can be configured via InitPayload if needed
  });

  // Check for extraction dependencies (needed for Learner)
  const {
    ChainedFallbackExtractor,
    WebLLMFallbackExtractor,
    PatternFallbackExtractor,
    ContradictionDetector,
    QualityScorer,
    SupersessionManager,
    SpecificityNER,
    NoveltyCalculator,
    RecurrenceTracker,
  } = await import('../extraction/_index.js');

  // Create temporary instances for extraction pipeline
  const noveltyCalculator = new NoveltyCalculator(vectorSearch);
  const specificityNER = new SpecificityNER();
  const recurrenceTracker = new RecurrenceTracker();
  const temporalMarkerDetector = new TemporalMarkerDetector();
  const qualityScorer = new QualityScorer(
    specificityNER,
    noveltyCalculator,
    recurrenceTracker,
    {
      threshold: configuredExtractionThreshold,
      minNovelty: 0.15,
      noveltyWeight: 0.35,
      specificityWeight: 0.45,
      recurrenceWeight: 0.2,
      recurrenceThreshold: 0.85,
      thresholdsByType: {
        identity: 0.36,
        preference: 0.38,
        relational: 0.38,
        temporal: 0.33,
      },
    },
  );
  const contradictionDetector = new ContradictionDetector(
    vectorSearch,
    repository,
    temporalMarkerDetector,
    {
      similarityThreshold: 0.8,
      candidateK: 7,
      resolutionMode: 'auto',
    },
  );
  const supersessionManager = new SupersessionManager(repository);
  const fallbackExtractor =
    configuredFallbackLLM && configuredFallbackLLM.enabled !== false
      ? new ChainedFallbackExtractor(
          new WebLLMFallbackExtractor(configuredFallbackLLM),
          new PatternFallbackExtractor(),
        )
      : new PatternFallbackExtractor();

  // Initialize Augmenter
  augmenter = new Augmenter(
    queryEngine,
    eventManager,
    {}, // empty config - use defaults
  );

  // Initialize Learner (with all dependencies)
  // Note: lifecycleManager can be null if not configured
  learner = new Learner(
    queryEngine,
    vectorSearch,
    repository,
    qualityScorer,
    contradictionDetector,
    supersessionManager,
    lifecycleManager, // May be null if lifecycle not configured
    specificityNER,
    noveltyCalculator,
    recurrenceTracker,
    embeddingEngine,
    eventManager,
    {
      extractionThreshold: configuredExtractionThreshold,
      fallbackExtractor,
    },
  );

  // Note: Manager is not instantiated in worker
  // Manager lives on main thread and communicates via WorkerClient

  console.log('[Worker] API components initialized');
}

/**
 * Run maintenance tasks (Phase 6)
 */
async function runMaintenance(): Promise<void> {
  // Stub: Will be implemented in Phase 6 (Lifecycle & Decay)
  // Simulates async work
  await new Promise((resolve) => setTimeout(resolve, 10));
}

// Worker entry points

/**
 * SharedWorker entry point
 * Called when a new client connects to the shared worker
 */
declare let onconnect: ((event: MessageEvent) => void) | undefined;

if (typeof onconnect !== 'undefined') {
  onconnect = (event: MessageEvent) => {
    const port = event.ports[0] as unknown as PortLike;
    setupPort(port);
    if (port.start) {
      port.start();
    }
  };
}

/**
 * DedicatedWorker entry point
 * Uses 'onconnect' presence for reliable detection
 */
if (!('onconnect' in self)) {
  // We're in a DedicatedWorker context
  const portLike = createWorkerPortLike(self as DedicatedWorkerGlobalScope);
  setupPort(portLike);
}

/**
 * Export functions for testing and external use
 */
export { setupPort, reportProgress, calculateOverallProgress };
