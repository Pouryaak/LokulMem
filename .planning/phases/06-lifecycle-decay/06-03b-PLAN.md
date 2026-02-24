---
phase: 06-lifecycle-decay
plan: 03b
type: execute
wave: 3
depends_on:
  - 06-01
  - 06-02
  - 06-03a
files_modified:
  - src/worker/index.ts
  - src/core/LokulMem.ts
  - src/core/types.ts
  - src/ipc/protocol-types.ts
  - src/lifecycle/_index.ts
autonomous: true
requirements:
  - EVENT-01
  - EVENT-02
  - EVENT-05
  - EVENT-06
  - EVENT-07

must_haves:
  truths:
    - "Worker integration: recordAccess called in get() and semanticSearch() handlers"
    - "LifecycleManager initialized after VectorSearch is ready"
    - "onProgress callback reports 'maintenance' stage during init"
    - "Lifecycle events: onMemoryFaded, onMemoryDeleted callbacks in LokulMem config"
    - "Event callbacks return unsubscribe functions"
    - "IPC protocol extended for lifecycle event messages"
  artifacts:
    - path: "src/worker/index.ts"
      provides: "Worker integration with lifecycle handlers"
      exports: ["initializeLifecycle", "handleGet with reinforcement", "handleSemanticSearch with reinforcement"]
    - path: "src/core/LokulMem.ts"
      provides: "Public API with lifecycle event callbacks"
      exports: ["LokulMem with onMemoryFaded, onMemoryDeleted"]
    - path: "src/core/types.ts"
      provides: "Extended config types with lifecycle options"
      contains: ["LokulMemConfig with lambdaByCategory, reinforcementByCategory, etc"]
    - path: "src/ipc/protocol-types.ts"
      provides: "IPC protocol extensions for lifecycle events"
      contains: ["MEMORY_FADED, MEMORY_DELETED message types"]
  key_links:
    - from: "worker/index.ts"
      to: "LifecycleManager.recordAccess"
      via: "Called after get() and high-relevance semanticSearch()"
      pattern: "lifecycleManager\.recordAccess\(memory\)"
    - from: "LokulMem"
      to: "LifecycleManager"
      via: "Initializes lifecycle during init, exposes event callbacks"
      pattern: "lifecycleManager\.initialize|onMemoryFaded.*lifecycleManager"
    - from: "LifecycleEventEmitter"
      to: "Worker IPC"
      via: "Events forwarded to main thread via postMessage"
      pattern: "port\.postMessage.*MEMORY_FADED|port\.postMessage.*MEMORY_DELETED"
---

<objective>
Integrate lifecycle system with worker and public API.

Purpose: Connect lifecycle management with worker operations (get, semanticSearch) and expose lifecycle event callbacks through public API for user applications.
Output: Worker integration with reinforcement, LokulMem lifecycle event callbacks, IPC protocol extensions.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/06-lifecycle-decay/06-CONTEXT.md
@.planning/phases/06-lifecycle-decay/06-RESEARCH.md
@src/worker/index.ts
@src/core/LokulMem.ts
@src/core/types.ts
@src/ipc/protocol-types.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Integrate lifecycle with worker</name>
  <files>src/worker/index.ts</files>
  <action>
    Update src/worker/index.ts to integrate lifecycle:

    1. Add variable at module level:
       - let lifecycleManager: LifecycleManager | null = null

    2. Add initializeLifecycle function:
       ```typescript
       async function initializeLifecycle(config: LifecycleConfig): Promise<void> {
         if (!embeddingEngine || !repository || !vectorSearch) {
           throw new Error('Dependencies not ready');
         }
         lifecycleManager = new LifecycleManager(repository, vectorSearch, config);
         await lifecycleManager.initialize();
         reportProgress(port, 'maintenance', 100);
       }
       ```

    3. Update handleGet() function:
       - After fetching memory from repository:
         - if (memory && lifecycleManager) { await lifecycleManager.recordAccess(memory); }

    4. Update handleSemanticSearch() function:
       - After getting search results:
         - if (options?.useCompositeScoring !== false && lifecycleManager) {
             for (const result of results) {
               if (result.score > 0.7) {
                 const memory = await repository.getById(result.memoryId);
                 if (memory) { await lifecycleManager.recordAccess(memory); }
               }
             }
           }

    5. Update handleShutdown() function:
       - Add: if (lifecycleManager) { await lifecycleManager.shutdown(); }

    6. Update message handler switch statement:
       - Case INIT: After initializing vector search, check if payload.lifecycleConfig exists
         - If yes, call await initializeLifecycle(payload.lifecycleConfig)
       - Case GET: Use updated handleGet with reinforcement
       - Case SEMANTIC_SEARCH: Use updated handleSemanticSearch with reinforcement
       - Case SHUTDOWN: Use updated handleShutdown with lifecycle cleanup

    Import LifecycleManager, LifecycleConfig from '../lifecycle/index.js'
  </action>
  <verification>
    lifecycleManager variable declared at module level
    initializeLifecycle function exists and initializes LifecycleManager
    handleGet calls recordAccess after fetching memory
    handleSemanticSearch reinforces results with score > 0.7
    handleShutdown calls lifecycleManager.shutdown
    Message handler switch updated for INIT, GET, SEMANTIC_SEARCH, SHUTDOWN
  </verification>
  <done>
    LifecycleManager initialized when lifecycleConfig provided in INIT message
    get() operations trigger reinforcement for accessed memory
    semanticSearch() reinforces high-relevance results (score > 0.7)
    Shutdown properly cleans up lifecycle resources
    Maintenance progress reported via reportProgress
  </done>
</task>

<task type="auto">
  <name>Task 2: Extend IPC protocol for lifecycle events</name>
  <files>src/ipc/protocol-types.ts</files>
  <action>
    Extend IPC protocol to support lifecycle event messages:

    1. Add message types to MessageType enum or const:
       ```typescript
       export const MessageType = {
         // ... existing types
         MEMORY_FADED: 'MEMORY_FADED',
         MEMORY_DELETED: 'MEMORY_DELETED',
       } as const;
       ```

    2. Add request types for registering handlers (if using request/response pattern):
       ```typescript
       export const RequestType = {
         // ... existing types
         REGISTER_FADED_HANDLER: 'REGISTER_FADED_HANDLER',
         REGISTER_DELETED_HANDLER: 'REGISTER_DELETED_HANDLER',
       } as const;
       ```

    3. Update protocol interfaces to include lifecycle event payloads:
       ```typescript
       export interface MemoryFadedEvent {
         type: typeof MessageType.MEMORY_FADED;
         payload: MemoryDTO;
       }

       export interface MemoryDeletedEvent {
         type: typeof MessageType.MEMORY_DELETED;
         payload: { memoryId: string };
       }
       ```

    Import MemoryDTO from '../types/memory.js'

    This enables two-way communication for lifecycle events between worker and main thread
  </action>
  <verification>
    MEMORY_FADED and MEMORY_DELETED constants added to MessageType
    Handler registration request types added
    MemoryFadedEvent and MemoryDeletedEvent interfaces defined
    Event payloads properly typed
  </verification>
  <done>
    Worker can send MEMORY_FADED messages to main thread
    Worker can send MEMORY_DELETED messages to main thread
    Event payloads properly typed with MemoryDTO and memoryId
    Message types follow existing IPC protocol patterns
  </done>
</task>

<task type="auto">
  <name>Task 3: Update LokulMem core types</name>
  <files>src/core/types.ts</files>
  <action>
    Update src/core/types.ts to extend LokulMemConfig with lifecycle options:

    Add lifecycle configuration fields to LokulMemConfig interface:
    ```typescript
    export interface LokulMemConfig {
      // Existing fields (model, workerUrl, etc.)

      // Lifecycle configuration - optional
      lambdaByCategory?: Partial<Record<MemoryType, number>>;
      pinnedLambda?: number;
      fadedThreshold?: number;
      reinforcementByCategory?: Partial<Record<MemoryType, number>>;
      maxBaseStrength?: number;
      reinforcementDebounceMs?: number;
      maintenanceIntervalMs?: number;

      // K-means configuration - optional
      kMeansK?: number;
      kMeansMaxIterations?: number;
      kMeansConvergenceThreshold?: number;
    }
    ```

    Import MemoryType from '../types/memory.js'

    These fields will be passed through to LifecycleManager in the worker
  </action>
  <verification>
    LokulMemConfig extended with all lifecycle fields
    Decay lambda fields included (lambdaByCategory, pinnedLambda, fadedThreshold)
    Reinforcement fields included (reinforcementByCategory, maxBaseStrength, reinforcementDebounceMs)
    Maintenance and K-means fields included
    All fields optional (user can override defaults)
  </verification>
  <done>
    Decay lambda configuration available through LokulMemConfig
    Reinforcement configuration available through LokulMemConfig
    Maintenance interval configurable
    K-means parameters configurable
    All lifecycle settings flow from public API to worker
  </done>
</task>

<task type="auto">
  <name>Task 4: Integrate lifecycle events in LokulMem</name>
  <files>src/core/LokulMem.ts</files>
  <action>
    Update src/core/LokulMem.ts to add lifecycle event callbacks:

    1. Add properties to LokulMem class:
       - private fadedHandlers: Array<(memory: MemoryDTO) => void> = []
       - private deletedHandlers: Array<(memoryId: string) => void> = []

    2. In initialize() method, after worker is initialized:
       - Build lifecycle config object from this.config:
         ```typescript
         const lifecycleConfig = {
           lambdaByCategory: this.config.lambdaByCategory,
           pinnedLambda: this.config.pinnedLambda ?? 0,
           fadedThreshold: this.config.fadedThreshold ?? 0.1,
           reinforcementByCategory: this.config.reinforcementByCategory,
           maxBaseStrength: this.config.maxBaseStrength ?? 3.0,
           reinforcementDebounceMs: this.config.reinforcementDebounceMs ?? 5000,
           maintenanceIntervalMs: this.config.maintenanceIntervalMs ?? 3600000,
           kMeansK: this.config.kMeansK,
           kMeansMaxIterations: this.config.kMeansMaxIterations ?? 100,
           kMeansConvergenceThreshold: this.config.kMeansConvergenceThreshold ?? 0.001,
         };
         ```
       - Send INIT message to worker with lifecycleConfig in payload

    3. Add method onMemoryFaded(handler: (memory: MemoryDTO) => void): () => void
       - Add handler to fadedHandlers array
       - Return unsubscribe function that removes handler from array

    4. Add method onMemoryDeleted(handler: (memoryId: string) => void): () => void
       - Add handler to deletedHandlers array
       - Return unsubscribe function that removes handler from array

    5. In handleWorkerMessage() method, add new message type cases:
       - Case MEMORY_FADED:
         - Extract memory from payload
         - Call all fadedHandlers with memory
       - Case MEMORY_DELETED:
         - Extract memoryId from payload
         - Call all deletedHandlers with memoryId

    6. In shutdown() method:
       - Clear fadedHandlers and deletedHandlers arrays

    Import MemoryDTO from '../types/memory.js'
  </action>
  <verification>
    onMemoryFaded method exists and returns unsubscribe function
    onMemoryDeleted method exists and returns unsubscribe function
    Lifecycle config built from this.config and sent in INIT message
    handleWorkerMessage handles MEMORY_FADED and MEMORY_DELETED messages
    Handlers cleared on shutdown
    Unsubscribe functions remove handlers from arrays
  </verification>
  <done>
    Users can register callbacks for memory faded events
    Users can register callbacks for memory deleted events
    Event callbacks return unsubscribe functions for cleanup
    Lifecycle configuration passed to worker during initialization
    Worker events forwarded to user-registered handlers
  </done>
</task>

<task type="auto">
  <name>Task 5: Update lifecycle barrel export</name>
  <files>src/lifecycle/_index.ts</files>
  <action>
    Update src/lifecycle/_index.ts to include K-means export:

    ```typescript
    export { DecayCalculator } from './DecayCalculator.js';
    export { ReinforcementTracker } from './ReinforcementTracker.js';
    export { MaintenanceSweep } from './MaintenanceSweep.js';
    export { LifecycleEventEmitter } from './EventEmitter.js';
    export { LifecycleManager } from './LifecycleManager.js';
    export { KMeansClusterer } from './KMeansClusterer.js';
    export * from './types.js';
    ```

    Ensure all lifecycle components are exported for public API
  </action>
  <verification>
    KMeansClusterer exported from barrel file
    All other lifecycle components exported
    Types re-exported with wildcard
    Export follows ES module conventions (.js extensions)
  </verification>
  <done>
    KMeansClusterer importable from lifecycle module
    All lifecycle components accessible via single import
    Types available via wildcard import
  </done>
</task>

</tasks>

<verification_criteria>
1. Worker integration functional:
   - get() triggers reinforcement for accessed memory
   - semanticSearch() reinforces high-relevance results (score > 0.7)
   - LifecycleManager initialized after VectorSearch ready
   - Maintenance stage reported in onProgress callback
   - Shutdown properly cleans up lifecycle resources

2. IPC protocol extended:
   - MEMORY_FADED message type defined
   - MEMORY_DELETED message type defined
   - Event payloads properly typed
   - Message flow documented

3. Public API exposes lifecycle events:
   - onMemoryFaded(callback) returns unsubscribe function
   - onMemoryDeleted(callback) returns unsubscribe function
   - Events forwarded from worker to main thread
   - User config passed through to LifecycleManager

4. End-to-end lifecycle flow:
   - Session start: maintenance sweep → K-means clustering → periodic sweeps start
   - Memory access: reinforcement tracked → debounced write → DB updated
   - Memory decay: sweep calculates → faded marked → events emitted → 30-day deletion
   - Shutdown: periodic sweeps stop → pending flush → resources cleaned
</verification_criteria>

<success_metrics>
- Reinforcement reduces DB writes by >90% for frequent access
- Lifecycle events received in main thread within 100ms
- No race conditions between sweep and reinforcement
- Unsubscribe functions properly remove event handlers
- All lifecycle configuration flows from public API to worker
</success_metrics>
