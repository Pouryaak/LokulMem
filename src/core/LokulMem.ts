/**
 * LokulMem - Main class for browser-native LLM memory management
 *
 * This is the primary entry point that users interact with.
 * It orchestrates worker initialization, progress reporting, and provides
 * the base for augment/learn/manage APIs in later phases.
 *
 * WORKER URL RESOLUTION:
 * The worker URL is resolved using `new URL('./worker.mjs', import.meta.url).href`
 * which points to the built worker file at `dist/worker.mjs` (relative to `dist/main.mjs`).
 *
 * IMPORTANT: Do NOT use `?worker&url` import syntax. That is designed for inline
 * workers in Vite applications, not for library builds with separate worker entry
 * points in `build.lib.worker`. See Phase 4 final summary for details.
 */

import { EventManager } from '../api/EventManager.js';
import { Manager } from '../api/Manager.js';
import type {
  AugmentOptions,
  AugmentResult,
  ChatMessage,
  LearnOptions,
  LearnResult,
  MemoryEventPayload,
  StatsChangedPayload,
} from '../api/types.js';
import type { InitStage, LokulMemConfig } from '../types/api.js';
import type { ContradictionEvent, SupersessionEvent } from '../types/events.js';
import type { MemoryDTO, MemoryType } from '../types/memory.js';
import type { WorkerClient } from './MessagePort.js';
import type { ModelConfig } from './Protocol.js';
import { MessageType as MessageTypeConst } from './Protocol.js';
import { WorkerManager } from './WorkerManager.js';
import type { PersistenceStatus } from './types.js';
import type { WorkerType } from './types.js';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: {
  dbName: string;
  workerType: 'auto' | 'shared' | 'dedicated' | 'main';
  initTimeoutMs: number;
  maxRetries: number;
  extractionThreshold: number;
  localModelBaseUrl?: string;
  workerUrl?: string;
  onnxPaths?: string | Record<string, string>;
  onProgress?: (stage: InitStage, progress: number) => void;
} = {
  dbName: 'lokulmem-default',
  workerType: 'auto',
  initTimeoutMs: 10000,
  maxRetries: 1, // Per Phase 2 decisions: default 1 retry per mode
  extractionThreshold: 0.45, // Lowered from 0.50 to capture more valuable facts (preferences, dates, contact info)
};

/**
 * Main LokulMem class for memory management
 *
 * Usage:
 * ```typescript
 * const lokul = await createLokulMem({
 *   dbName: 'my-app',
 *   onProgress: (stage, progress) => console.log(stage, progress)
 * });
 * ```
 */
export class LokulMem {
  private workerManager: WorkerManager;
  private manager: Manager | null = null;
  private eventManager: EventManager;
  private config: {
    dbName: string;
    workerType: 'auto' | 'shared' | 'dedicated' | 'main';
    initTimeoutMs: number;
    maxRetries: number;
    extractionThreshold: number;
    localModelBaseUrl?: string;
    workerUrl?: string;
    onnxPaths?: string | Record<string, string>;
    fallbackLLM?: import('../types/api.js').FallbackLLMConfig;
    onProgress?: (stage: InitStage, progress: number) => void;
    // Token budget config (main thread only, NOT sent to worker)
    contextWindowTokens?: number;
    reservedForResponseTokens?: number;
    tokenOverheadPerMessage?: number;
    tokenCounter?: (text: string) => number;
    // Lifecycle config (sent to worker during init)
    lambdaByCategory?: Partial<
      Record<import('../types/memory.js').MemoryType, number>
    >;
    pinnedLambda?: number;
    fadedThreshold?: number;
    reinforcementByCategory?: Partial<
      Record<import('../types/memory.js').MemoryType, number>
    >;
    maxBaseStrength?: number;
    reinforcementDebounceMs?: number;
    maintenanceIntervalMs?: number;
    kMeansK?: number;
    kMeansMaxIterations?: number;
    kMeansConvergenceThreshold?: number;
    // Event config
    verboseEvents?: boolean;
  };
  private isInitialized = false;

  // Lifecycle event handlers
  private fadedHandlers: Array<(memory: MemoryDTO) => void> = [];
  private deletedHandlers: Array<(memoryId: string) => void> = [];
  private contradictionHandlers: Array<(event: ContradictionEvent) => void> =
    [];
  private supersededHandlers: Array<(event: SupersessionEvent) => void> = [];
  private lifecycleUnsubscribers: Array<() => void> = [];

  /**
   * Creates a new LokulMem instance
   * @param config - Configuration options
   */
  constructor(config: LokulMemConfig = {}) {
    // Create WorkerManager instance first
    this.workerManager = new WorkerManager();

    // Initialize EventManager with verboseEvents config
    const eventConfig: { verboseEvents?: boolean } = {};
    if (config.verboseEvents !== undefined) {
      eventConfig.verboseEvents = config.verboseEvents;
    }
    this.eventManager = new EventManager(eventConfig);

    // Merge with defaults - handle optional properties carefully for exactOptionalPropertyTypes
    this.config = {
      dbName: config.dbName ?? DEFAULT_CONFIG.dbName,
      workerType: config.workerType ?? DEFAULT_CONFIG.workerType,
      initTimeoutMs: config.initTimeoutMs ?? DEFAULT_CONFIG.initTimeoutMs,
      maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
      extractionThreshold:
        config.extractionThreshold ?? DEFAULT_CONFIG.extractionThreshold,
    };

    // Set optional properties only if defined
    if (config.localModelBaseUrl !== undefined) {
      this.config.localModelBaseUrl = config.localModelBaseUrl;
    }
    if (config.workerUrl !== undefined) {
      this.config.workerUrl = config.workerUrl;
    }
    if (config.onProgress !== undefined) {
      this.config.onProgress = config.onProgress;
    }
    if (config.onnxPaths !== undefined) {
      this.config.onnxPaths = config.onnxPaths;
    }
    if (config.fallbackLLM !== undefined) {
      this.config.fallbackLLM = config.fallbackLLM;
    }

    // NEW: Store token budget config (main thread only, NOT sent to worker)
    if (config.contextWindowTokens !== undefined) {
      this.config.contextWindowTokens = config.contextWindowTokens;
    }
    if (config.reservedForResponseTokens !== undefined) {
      this.config.reservedForResponseTokens = config.reservedForResponseTokens;
    }
    if (config.tokenOverheadPerMessage !== undefined) {
      this.config.tokenOverheadPerMessage = config.tokenOverheadPerMessage;
    }
    if (config.tokenCounter !== undefined) {
      this.config.tokenCounter = config.tokenCounter;
    }

    // Store lifecycle config (sent to worker during init)
    if (config.lambdaByCategory !== undefined) {
      this.config.lambdaByCategory = config.lambdaByCategory;
    }
    if (config.pinnedLambda !== undefined) {
      this.config.pinnedLambda = config.pinnedLambda;
    }
    if (config.fadedThreshold !== undefined) {
      this.config.fadedThreshold = config.fadedThreshold;
    }
    if (config.reinforcementByCategory !== undefined) {
      this.config.reinforcementByCategory = config.reinforcementByCategory;
    }
    if (config.maxBaseStrength !== undefined) {
      this.config.maxBaseStrength = config.maxBaseStrength;
    }
    if (config.reinforcementDebounceMs !== undefined) {
      this.config.reinforcementDebounceMs = config.reinforcementDebounceMs;
    }
    if (config.maintenanceIntervalMs !== undefined) {
      this.config.maintenanceIntervalMs = config.maintenanceIntervalMs;
    }
    if (config.kMeansK !== undefined) {
      this.config.kMeansK = config.kMeansK;
    }
    if (config.kMeansMaxIterations !== undefined) {
      this.config.kMeansMaxIterations = config.kMeansMaxIterations;
    }
    if (config.kMeansConvergenceThreshold !== undefined) {
      this.config.kMeansConvergenceThreshold =
        config.kMeansConvergenceThreshold;
    }

    // Store event config
    if (config.verboseEvents !== undefined) {
      this.config.verboseEvents = config.verboseEvents;
    }
  }

  /**
   * Build ModelConfig from LokulMemConfig options
   * Only includes properties that are explicitly set
   */
  private buildModelConfig(): ModelConfig | undefined {
    const config: ModelConfig = {};

    if (this.config.localModelBaseUrl !== undefined) {
      config.localModelBaseUrl = this.config.localModelBaseUrl;
    }

    if (this.config.onnxPaths !== undefined) {
      config.onnxPaths = this.config.onnxPaths;
    }

    if (this.config.fallbackLLM !== undefined) {
      config.fallbackLLM = this.config.fallbackLLM;
    }

    // Only return config if at least one property was set
    return Object.keys(config).length > 0 ? config : undefined;
  }

  /**
   * Build LifecycleConfig from LokulMemConfig options
   * Provides sensible defaults for all required fields
   * Returns undefined if lifecycle is not explicitly configured
   */
  private buildLifecycleConfig():
    | import('../lifecycle/types.js').LifecycleConfig
    | undefined {
    // Only build config if user explicitly set at least one lifecycle field
    const hasLifecycleConfig =
      this.config.lambdaByCategory !== undefined ||
      this.config.pinnedLambda !== undefined ||
      this.config.fadedThreshold !== undefined ||
      this.config.reinforcementByCategory !== undefined ||
      this.config.maxBaseStrength !== undefined ||
      this.config.reinforcementDebounceMs !== undefined ||
      this.config.maintenanceIntervalMs !== undefined ||
      this.config.kMeansK !== undefined ||
      this.config.kMeansMaxIterations !== undefined ||
      this.config.kMeansConvergenceThreshold !== undefined;

    if (!hasLifecycleConfig) {
      return undefined;
    }

    // Default values from Phase 6 research (06-RESEARCH.md)
    // Pre-define the default category values for type safety
    const defaultLambdaByCategory: Partial<Record<MemoryType, number>> = {
      identity: 0.0001,
      location: 0.0005,
      profession: 0.0003,
      preference: 0.001,
      project: 0.005,
      temporal: 0.02,
      relational: 0.0004,
      emotional: 0.01,
    };

    const defaultReinforcementByCategory: Partial<Record<MemoryType, number>> =
      {
        identity: 0.5,
        location: 0.3,
        profession: 0.4,
        preference: 0.4,
        project: 0.3,
        temporal: 0.1,
        relational: 0.3,
        emotional: 0.2,
      };

    // Build base config with all required fields
    const config: import('../lifecycle/types.js').LifecycleConfig = {
      // Decay defaults
      lambdaByCategory: this.config.lambdaByCategory ?? defaultLambdaByCategory,
      pinnedLambda: this.config.pinnedLambda ?? 0,
      fadedThreshold: this.config.fadedThreshold ?? 0.1,

      // Reinforcement defaults
      reinforcementByCategory:
        this.config.reinforcementByCategory ?? defaultReinforcementByCategory,
      maxBaseStrength: this.config.maxBaseStrength ?? 3.0,
      reinforcementDebounceMs: this.config.reinforcementDebounceMs ?? 5000,

      // Maintenance defaults
      maintenanceIntervalMs: this.config.maintenanceIntervalMs ?? 3600000,

      // K-means defaults
      kMeansMaxIterations: this.config.kMeansMaxIterations ?? 100,
      kMeansConvergenceThreshold:
        this.config.kMeansConvergenceThreshold ?? 0.001,
    };

    // Add optional kMeansK only if explicitly set
    if (this.config.kMeansK !== undefined) {
      (config as { kMeansK: number }).kMeansK = this.config.kMeansK;
    }

    return config;
  }

  /**
   * Set up lifecycle event listeners after worker initialization
   */
  private setupLifecycleEventListeners(): void {
    // Listen for MEMORY_FADED events
    const unfade = this.workerManager.on(
      MessageTypeConst.MEMORY_FADED,
      (payload: unknown) => {
        const memory = payload as MemoryDTO;
        // Notify all registered handlers
        for (const handler of this.fadedHandlers) {
          handler(memory);
        }
      },
    );
    this.lifecycleUnsubscribers.push(unfade);

    // Listen for MEMORY_DELETED events
    const undelete = this.workerManager.on(
      MessageTypeConst.MEMORY_DELETED,
      (payload: unknown) => {
        const data = payload as { memoryId: string };
        // Notify all registered handlers
        for (const handler of this.deletedHandlers) {
          handler(data.memoryId);
        }
      },
    );
    this.lifecycleUnsubscribers.push(undelete);

    // Listen for CONTRADICTION_DETECTED events
    const uncontradict = this.workerManager.on(
      MessageTypeConst.CONTRADICTION_DETECTED,
      (payload: unknown) => {
        const event = payload as ContradictionEvent;
        // Notify all registered handlers
        for (const handler of this.contradictionHandlers) {
          handler(event);
        }
      },
    );
    this.lifecycleUnsubscribers.push(uncontradict);

    // Listen for MEMORY_SUPERSEDED events
    const unsupersede = this.workerManager.on(
      MessageTypeConst.MEMORY_SUPERSEDED,
      (payload: unknown) => {
        const event = payload as SupersessionEvent;
        // Notify all registered handlers
        for (const handler of this.supersededHandlers) {
          handler(event);
        }
      },
    );
    this.lifecycleUnsubscribers.push(unsupersede);
  }

  /**
   * Initialize the worker and wait for completion
   * Reports progress through the onProgress callback if provided in config
   *
   * @returns Promise that resolves when initialization is complete
   * @throws Error if initialization fails
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.workerManager.initialize(
        {
          workerType: this.config.workerType,
          workerUrl:
            this.config.workerUrl ??
            // Default worker URL - points to built worker file
            new URL('./worker.mjs', import.meta.url).href,
          initTimeoutMs: this.config.initTimeoutMs,
          maxRetries: this.config.maxRetries,
          dbName: this.config.dbName,
          modelConfig: this.buildModelConfig(),
          lifecycleConfig: this.buildLifecycleConfig(),
          extractionThreshold: this.config.extractionThreshold,
        },
        this.config.onProgress,
      );

      // Set up lifecycle event listeners after initialization
      this.setupLifecycleEventListeners();

      // Create Manager singleton for memory inspection and manipulation
      const client = this.workerManager.getClient();
      if (client) {
        this.manager = new Manager(client, this.eventManager);
      }

      this.isInitialized = true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`LokulMem initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Request storage persistence explicitly
   * Note: This is NOT auto-called during initialize() per Phase 2 decisions
   * The user decides when to call this based on their UX flow
   *
   * @returns Promise that resolves with persistence status
   */
  async persistStorage(): Promise<PersistenceStatus> {
    return this.workerManager.persistStorage();
  }

  /**
   * Learn from conversation by extracting memories
   *
   * @param userMessage - User's message
   * @param assistantResponse - Assistant's response
   * @param options - Learn options
   * @returns Learn result with extracted memories and contradictions
   *
   * @example
   * ```typescript
   * const lokul = await createLokulMem();
   * const result = await lokul.learn(
   *   { role: 'user', content: 'My name is Alice' },
   *   { role: 'assistant', content: 'Hi Alice!' }
   * );
   * console.log(`Extracted ${result.extracted.length} memories`);
   * ```
   */
  async learn(
    userMessage: ChatMessage,
    assistantResponse: ChatMessage,
    options: LearnOptions = {},
  ): Promise<LearnResult> {
    if (!this.isInitialized) {
      throw new Error('LokulMem not initialized. Call initialize() first.');
    }

    // Route to worker RPC
    const client = this.workerManager.getClient();
    if (!client) {
      throw new Error('Worker client not available.');
    }

    return (await client.request(
      MessageTypeConst.LEARN,
      {
        userMessage,
        assistantResponse,
        options: {
          conversationId: options.conversationId,
          // CRITICAL: Let Learner class handle extractFrom default ('user')
          // Previously defaulted to 'both' here, causing assistant messages to be extracted
          extractFrom: options.extractFrom,
          runMaintenance: options.runMaintenance ?? false,
          learnThreshold: options.learnThreshold,
          autoAssociate: options.autoAssociate ?? false,
          storeResponse: options.storeResponse ?? false,
          verbose: options.verbose ?? false,
        },
      },
      60000, // 60 second timeout for learn operation (includes extraction)
    )) as LearnResult;
  }

  /**
   * Get the current worker type
   * @returns 'shared' | 'dedicated' | 'main-thread'
   */
  getWorkerType(): WorkerType {
    return this.workerManager.getWorkerType();
  }

  /**
   * Get the current persistence status
   * @returns PersistenceStatus or null if not requested
   */
  getPersistenceStatus(): PersistenceStatus | null {
    return this.workerManager.getPersistenceStatus();
  }

  /**
   * Check if initialization is complete
   * @returns true if ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Manager namespace for memory inspection and manipulation
   *
   * @returns Manager instance with 16+ methods (cached singleton)
   * @throws Error if Manager is not available (LokulMem not initialized)
   *
   * @example
   * ```typescript
   * const lokul = await createLokulMem();
   * await lokul.manage().pin(memoryId);
   * const stats = await lokul.manage().stats();
   * const exported = await lokul.manage().export('json');
   * ```
   */
  manage(): Manager {
    if (!this.manager) {
      throw new Error('Manager not available. LokulMem not initialized.');
    }
    return this.manager; // Returns cached singleton, NOT new instance
  }

  /**
   * Terminate the worker and clean up resources
   */
  terminate(): void {
    this.workerManager.terminate();
    this.manager = null;
    this.isInitialized = false;
    // Clear lifecycle event handlers
    this.fadedHandlers = [];
    this.deletedHandlers = [];
    this.contradictionHandlers = [];
    this.supersededHandlers = [];
    // Unsubscribe from lifecycle events
    for (const unsubscribe of this.lifecycleUnsubscribers) {
      unsubscribe();
    }
    this.lifecycleUnsubscribers = [];
  }

  /**
   * Register a callback for memory faded events
   *
   * Fired when a memory's strength drops below the faded threshold.
   * The memory is marked as faded and will be deleted after 30 days.
   *
   * @param handler - Callback function that receives the faded memory
   * @returns Unsubscribe function to remove the handler
   *
   * @example
   * ```typescript
   * const unsubscribe = lokul.onMemoryFaded((memory) => {
   *   console.log('Memory faded:', memory.content);
   * });
   *
   * // Later, to stop listening:
   * unsubscribe();
   * ```
   */
  onMemoryFaded(handler: (memory: MemoryDTO) => void): () => void {
    this.fadedHandlers.push(handler);
    // Return unsubscribe function
    return () => {
      const index = this.fadedHandlers.indexOf(handler);
      if (index > -1) {
        this.fadedHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Register a callback for memory deleted events
   *
   * Fired when a memory is permanently deleted from storage.
   * This happens 30 days after a memory is marked as faded.
   *
   * @param handler - Callback function that receives the deleted memory ID
   * @returns Unsubscribe function to remove the handler
   *
   * @example
   * ```typescript
   * const unsubscribe = lokul.onMemoryDeleted((memoryId) => {
   *   console.log('Memory deleted:', memoryId);
   * });
   *
   * // Later, to stop listening:
   * unsubscribe();
   * ```
   */
  onMemoryDeleted(handler: (memoryId: string) => void): () => void {
    this.deletedHandlers.push(handler);
    // Return unsubscribe function
    return () => {
      const index = this.deletedHandlers.indexOf(handler);
      if (index > -1) {
        this.deletedHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Register callback for contradiction detection
   *
   * CRITICAL: ContradictionEvent contains IDs and metadata only per CONTEXT decision.
   * Full content retrievable via manage().get() if needed.
   *
   * Fired when a new memory contradicts an existing memory.
   * The event includes similarity scores, temporal markers, and resolution mode.
   *
   * @param handler - Callback function that receives the contradiction event
   * @returns Unsubscribe function to remove the handler
   *
   * @example
   * ```typescript
   * const unsubscribe = lokul.onContradictionDetected((event) => {
   *   console.log('Contradiction:', event.newMemoryId, 'vs', event.conflictingMemoryId);
   *   console.log('Resolution:', event.resolution);
   * });
   *
   * // Later, to stop listening:
   * unsubscribe();
   * ```
   */
  onContradictionDetected(
    handler: (event: ContradictionEvent) => void,
  ): () => void {
    return this.workerManager.onContradictionDetected(handler);
  }

  /**
   * Register callback for memory superseded events
   *
   * Fired when a memory is superseded by a newer version.
   * The old memory is marked as 'superseded' and linked to the new memory.
   *
   * @param handler - Callback function that receives the supersession event
   * @returns Unsubscribe function to remove the handler
   *
   * @example
   * ```typescript
   * const unsubscribe = lokul.onMemorySuperseded((event) => {
   *   console.log('Superseded:', event.oldMemoryId, '->', event.newMemoryId);
   * });
   *
   * // Later, to stop listening:
   * unsubscribe();
   * ```
   */
  onMemorySuperseded(handler: (event: SupersessionEvent) => void): () => void {
    return this.workerManager.onMemorySuperseded(handler);
  }

  /**
   * Register callback for when memories are added
   * @returns Unsubscribe function
   */
  onMemoryAdded(handler: (event: MemoryEventPayload) => void): () => void {
    return this.eventManager.on('MEMORY_ADDED', handler);
  }

  /**
   * Register callback for when memories are updated
   * @returns Unsubscribe function
   */
  onMemoryUpdated(handler: (event: MemoryEventPayload) => void): () => void {
    return this.eventManager.on('MEMORY_UPDATED', handler);
  }

  /**
   * Register callback for when stats change
   * @returns Unsubscribe function
   */
  onStatsChanged(handler: (event: StatsChangedPayload) => void): () => void {
    return this.eventManager.on('STATS_CHANGED', handler);
  }

  /**
   * Get the worker client for making requests
   * Used internally for operations that need worker communication
   *
   * @returns WorkerClient or null if not initialized
   * @internal
   */
  getClient(): WorkerClient | null {
    return this.workerManager.getClient();
  }

  /**
   * Augment user message with relevant memories for LLM context
   *
   * Retrieves relevant memories using semantic search and injects them
   * into the message array as a system message. Token-aware to ensure
   * memories fit within the LLM context window.
   *
   * @param userMessage - Current user message
   * @param history - Conversation history (optional)
   * @param options - Augment options
   * @returns Augmented messages with metadata
   *
   * @example
   * ```typescript
   * const { messages, metadata } = await lokul.augment(
   *   "What's my name?",
   *   [{ role: "user", content: "Hi, I'm John" }, { role: "assistant", content: "Hi John!" }],
   *   { contextWindowTokens: 8192, debug: true }
   * );
   *
   * // messages[0] is now a system message with relevant memories
   * // metadata.injectedCount shows how many memories were injected
   * ```
   */
  async augment(
    userMessage: string,
    history: ChatMessage[] = [],
    options: AugmentOptions = {},
  ): Promise<AugmentResult> {
    if (!this.isInitialized) {
      throw new Error('LokulMem not initialized. Call initialize() first.');
    }

    // Route to worker RPC
    const client = this.workerManager.getClient();
    if (!client) {
      throw new Error('Worker client not available.');
    }

    return (await client.request(
      MessageTypeConst.AUGMENT,
      {
        userMessage,
        history,
        options: {
          contextWindowTokens:
            options.contextWindowTokens ?? this.config.contextWindowTokens,
          reservedForResponseTokens:
            options.reservedForResponseTokens ??
            this.config.reservedForResponseTokens ??
            1024,
          maxTokens: options.maxTokens,
          debug: options.debug ?? false,
        },
      },
      30000, // 30 second timeout for augment operation
    )) as AugmentResult;
  }
}

/**
 * Factory function to create and initialize a LokulMem instance
 *
 * This is the recommended way to create a LokulMem instance as it
 * handles initialization automatically.
 *
 * @param config - Configuration options
 * @returns Promise that resolves with initialized LokulMem instance
 *
 * @example
 * ```typescript
 * const lokul = await createLokulMem({
 *   dbName: 'my-chat-app',
 *   onProgress: (stage, progress) => {
 *     console.log(`${stage}: ${progress}%`);
 *   }
 * });
 * ```
 */
export async function createLokulMem(
  config?: LokulMemConfig,
): Promise<LokulMem> {
  const lokul = new LokulMem(config);
  await lokul.initialize();
  return lokul;
}
