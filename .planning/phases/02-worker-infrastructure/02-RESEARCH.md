# Phase 2: Worker Infrastructure - Research

**Researched:** 2026-02-23
**Domain:** Web Workers API (SharedWorker, DedicatedWorker), Storage Persistence API
**Confidence:** HIGH

## Summary

Phase 2 establishes the execution environment for LokulMem, implementing a three-tier fallback strategy: SharedWorker for multi-tab synchronization and model sharing, DedicatedWorker as the fallback for single-tab operation, and main thread execution as the final fallback when Workers are unavailable. This architecture is critical for performance (keeping heavy embedding operations off the main thread) and user experience (shared model state across tabs).

The research confirms that modern browsers support both SharedWorker and DedicatedWorker with ES module support via `{ type: 'module' }`. The key challenge is Safari's private browsing mode, which blocks SharedWorker but not DedicatedWorker. The recommended approach is feature detection via try/catch instantiation rather than user-agent sniffing.

Storage persistence via `navigator.storage.persist()` must be called BEFORE worker spawn because it requires user permission that can only be requested from the main thread (not available in Worker contexts). This ensures IndexedDB data survives browser storage pressure.

Progress reporting through five stages (worker, model, storage, maintenance, ready) requires a structured message protocol between main thread and worker, with the worker reporting stage transitions and the main thread aggregating overall progress.

**Primary recommendation:** Implement a WorkerManager class that handles detection, fallback chain, and lifecycle management, with a Promise-based initialization API that resolves when the 'ready' stage is reached.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Worker Detection & Fallback:**
- Detection method: Try/catch instantiation — attempt `new SharedWorker(url, { type: 'module' })` and catch failures
- Fallback chain: User-configurable with 'auto' as default. When auto: SharedWorker → DedicatedWorker → main thread
- Safari handling: Don't UA-detect. Try SharedWorker, catch the specific failure (common in private mode), immediately fall back
- Worker type exposure: Yes — expose via API as `workerType: 'shared' | 'dedicated' | 'main'`
- Initialization timeout: User-configurable (default: 10 seconds)
- Fallback behavior: Try DedicatedWorker immediately if SharedWorker fails
- Multiple instances: No — singleton only, library enforces single worker instance
- Message queue during init: Queue with timeout — messages queue during initialization and flush once ready, with configurable timeout
- Cleanup on unload: User-controlled — provide `terminate()` method on API
- Worker restart: Yes — manual `restart()` API available if worker crashes
- Worker file load failure: Try main thread fallback if worker.mjs fails to load (404, network error)
- Status API: Yes — detailed status object including `workerType`, `canPersist`, health info

**Progress Reporting:**
- Progress granularity: Both overall percentage and per-stage progress
- Stages reported: worker, model, storage, maintenance, ready (5 stages)
- Progress format: Overall: 30%, stage: "model: 80%"
- Error states: Included in progress callbacks
- Storage persistence result: Surface via `onStoragePersistDenied` / status flag

**Error Handling & Recovery:**
- Worker crash during init: Fail with error (throw/callback)
- Worker crash after init: Fail with error (emit error event)
- Max retry limit: Yes — configurable `maxRetries` option
- Error information: Full error details — message, code, stack trace, timestamp, recovery suggestion
- Initialization errors: Recoverable — try with different worker type
- Health check: On-demand ping always available, optional heartbeat behind config flag (default off)
- Timeout errors: Error code based — specific codes like TIMEOUT_WORKER_INIT, TIMEOUT_REQUEST
- Error exposure: Both available — LokulMemError wrapper with `rawCause` property for original error
- Degraded state visibility: Yes — detailed status object with worker type, storage persistence, health info
- Unexpected messages: Ignore unknown messages (log but continue)
- Per-operation timeout: Configurable per-operation timeout (default 5-10s) with retry once for idempotent operations only

**Storage Persistence Behavior:**
- Permission denied: Initialize with warnings — proceed but surface warning about data loss risk
- Who prompts: User calls `persistStorage()` explicitly — library provides API, site decides when
- Persistence failure: Warn and continue — emit warning, proceed without persistence
- Persistence status exposure: Yes — detailed info: `persisted: boolean`, `reason: string`, `lastAttempt: timestamp`
- Blocking behavior: Configurable (default: do not block — proceed, but surface result via callback/status)

### Claude's Discretion

None specified — all decisions locked.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WORKER-01 | Library detects and uses SharedWorker when available | SharedWorker constructor with `{ type: 'module' }` supported in all modern browsers except iOS Safari private mode. Detection via try/catch instantiation pattern. |
| WORKER-02 | Falls back to Dedicated Worker when SharedWorker unavailable | DedicatedWorker has broader support and works in Safari private mode. Same API surface via MessagePort abstraction. |
| WORKER-03 | Falls back to main thread when Workers unavailable | Main thread fallback requires same interface as worker communication. Use direct function calls instead of postMessage. |
| WORKER-04 | `navigator.storage.persist()` called before worker spawn | StorageManager.persist() only available in Window context, not Workers. Must be called before spawning worker. Returns Promise<boolean>. |
| WORKER-05 | `onProgress` callback reports init stages (worker, model, storage, maintenance, ready) | Structured message protocol with stage notifications. Worker reports stage transitions; main thread aggregates overall progress (20% per stage). |
</phase_requirements>

## Standard Stack

### Core
| API/Feature | Browser Support | Purpose | Why Standard |
|-------------|-----------------|---------|--------------|
| SharedWorker | Chrome 4+, Firefox 29+, Safari 16+ (not iOS private) | Multi-tab model sharing, singleton enforcement | Native browser API for shared execution context |
| DedicatedWorker | Universal (IE10+) | Single-tab worker fallback | Maximum compatibility, works in all modes |
| StorageManager.persist() | Chrome 52+, Firefox 55+, Safari 15+ | Request persistent storage permission | Prevents data loss from browser storage pressure |
| MessagePort | Universal | Bidirectional communication | Standard interface for all worker types |
| ES Module Workers | Chrome 80+, Firefox 114+, Safari 15+ | Modern module syntax in workers | Aligns with project TypeScript/ESM stack |

### Supporting
| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| Promise-based initialization | Async worker readiness | Always — worker spawn is inherently async |
| Request/response message IDs | Correlate responses with requests | All operations requiring round-trip |
| EventTarget wrapper | Consistent event interface | Error events, progress events |
| AbortController | Timeout handling | Per-operation timeouts with cleanup |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SharedWorker | Service Worker | Service Workers have different lifecycle (page-independent), more complex, not designed for computation |
| try/catch detection | User-Agent sniffing | UA sniffing is fragile; feature detection is robust |
| Worker.postMessage | Atomics + SharedArrayBuffer | Overkill for this use case; requires COOP/COEP headers |

## Architecture Patterns

### Recommended Project Structure
```
src/
├── worker/
│   ├── index.ts           # Worker entry point (handles onconnect/onmessage)
│   ├── types.ts           # Worker-internal types
│   └── handlers/          # Message handlers
├── core/
│   ├── WorkerManager.ts   # Main thread: detection, fallback, lifecycle
│   ├── MessagePort.ts     # Abstraction over Shared/Dedicated/main
│   └── Protocol.ts        # Message types and validation
├── storage/
│   └── Persistence.ts     # navigator.storage.persist() wrapper
└── types/
    └── api.ts             # InitStage type already defined
```

### Pattern 1: WorkerManager with Fallback Chain
**What:** Central class that attempts SharedWorker → DedicatedWorker → main thread in sequence
**When to use:** Primary initialization path
**Example:**
```typescript
// Source: MDN Web Docs + project requirements
class WorkerManager {
  private worker: SharedWorker | Worker | null = null;
  private port: MessagePort | null = null;
  private mode: 'shared' | 'dedicated' | 'main' = 'main';

  async initialize(config: WorkerConfig): Promise<MessagePort> {
    // Try SharedWorker first
    if (config.workerType === 'auto' || config.workerType === 'shared') {
      try {
        const shared = new SharedWorker(config.workerUrl, {
          type: 'module',
          name: 'lokulmem-shared'
        });
        this.port = shared.port;
        this.mode = 'shared';
        this.port.start();
        return this.port;
      } catch (e) {
        if (config.workerType === 'shared') throw e;
        // Fall through to DedicatedWorker
      }
    }

    // Try DedicatedWorker
    if (config.workerType === 'auto' || config.workerType === 'dedicated') {
      try {
        const dedicated = new Worker(config.workerUrl, {
          type: 'module'
        });
        this.worker = dedicated;
        this.port = dedicated as unknown as MessagePort; // DedicatedWorker has postMessage/onmessage
        this.mode = 'dedicated';
        return this.port;
      } catch (e) {
        if (config.workerType === 'dedicated') throw e;
        // Fall through to main thread
      }
    }

    // Main thread fallback
    this.mode = 'main';
    return this.createMainThreadPort();
  }
}
```

### Pattern 2: Storage Persistence Before Worker Spawn
**What:** Request persistent storage from main thread before initializing worker
**When to use:** Always — StorageManager.persist() not available in Workers
**Example:**
```typescript
// Source: MDN StorageManager API docs
async function requestPersistence(): Promise<PersistenceResult> {
  if (!navigator.storage || !navigator.storage.persist) {
    return {
      persisted: false,
      reason: 'API not supported',
      lastAttempt: Date.now()
    };
  }

  try {
    const persisted = await navigator.storage.persist();
    return {
      persisted,
      reason: persisted ? 'granted' : 'denied',
      lastAttempt: Date.now()
    };
  } catch (error) {
    return {
      persisted: false,
      reason: error instanceof Error ? error.message : 'unknown error',
      lastAttempt: Date.now()
    };
  }
}

// Usage in initialization
const persistenceResult = await requestPersistence();
// Now spawn worker
const workerPort = await workerManager.initialize(config);
```

### Pattern 3: SharedWorker Connection Handling
**What:** Proper SharedWorker lifecycle with port.start() and onconnect
**When to use:** When SharedWorker is selected
**Example:**
```typescript
// Source: MDN SharedWorker docs
// main.ts
const sharedWorker = new SharedWorker('./worker.ts', {
  type: 'module',
  name: 'lokulmem'
});

// REQUIRED: Start the port
sharedWorker.port.start();

// Handle messages
sharedWorker.port.onmessage = (event) => {
  const { type, payload } = event.data;
  // Process response
};

// worker.ts
onconnect = (event) => {
  const port = event.ports[0];

  port.onmessage = (event) => {
    const { type, payload, id } = event.data;
    // Process and respond
    port.postMessage({ type: `${type}:response`, payload, id });
  };

  // REQUIRED when using addEventListener (optional with onmessage setter)
  port.start();
};
```

### Pattern 4: Progress Reporting Protocol
**What:** Structured message format for stage-based progress
**When to use:** During worker initialization
**Example:**
```typescript
// Source: project requirements + patterns
interface ProgressMessage {
  type: 'progress';
  stage: 'worker' | 'model' | 'storage' | 'maintenance' | 'ready';
  stageProgress: number; // 0-100 within stage
  overallProgress: number; // 0-100 across all stages
  message?: string;
}

// Worker reports stage transitions
function reportProgress(stage: InitStage, stageProgress: number) {
  const stageWeights: Record<InitStage, number> = {
    worker: 0.2,
    model: 0.2,
    storage: 0.2,
    maintenance: 0.2,
    ready: 0.2
  };

  const stageOrder: InitStage[] = ['worker', 'model', 'storage', 'maintenance', 'ready'];
  const currentStageIndex = stageOrder.indexOf(stage);
  const completedStages = currentStageIndex * 0.2;
  const currentStageContribution = (stageProgress / 100) * 0.2;

  port.postMessage({
    type: 'progress',
    stage,
    stageProgress,
    overallProgress: (completedStages + currentStageContribution) * 100,
    message: `${stage}: ${stageProgress}%`
  });
}
```

### Anti-Patterns to Avoid
- **Calling port.start() on DedicatedWorker:** DedicatedWorker doesn't have a port property; use the worker directly
- **Not handling messageerror:** Deserialization errors are silent without onmessageerror handler
- **UA sniffing for Safari:** Feature detection is more robust than checking navigator.userAgent
- **Calling persist() from Worker:** StorageManager.persist() is not available in Worker contexts
- **Not cleaning up on terminate():** Always remove event listeners and close ports to prevent memory leaks

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Worker feature detection | Custom capability checks | try/catch instantiation | Browser APIs throw on unsupported features; catching is the standard pattern |
| Message correlation | Manual ID tracking | Request/response with UUID | Race conditions, timeout handling, cleanup complexity |
| Worker pool management | Custom pool implementation | Singleton pattern (as required) | Project explicitly requires single instance |
| Storage estimation | Custom quota checks | navigator.storage.estimate() | Standard API, handles origin boundaries correctly |
| Timeout handling | setTimeout/clearTimeout | AbortController | Standard cancellation primitive, composable |

**Key insight:** The Web Workers API is mature and standardized. Custom abstractions add complexity without benefit. Focus on proper lifecycle management and error handling rather than reinventing worker communication patterns.

## Common Pitfalls

### Pitfall 1: Safari Private Mode SharedWorker Failure
**What goes wrong:** SharedWorker constructor throws in Safari private browsing mode, causing initialization to fail if not caught
**Why it happens:** Safari disables SharedWorker in private mode for privacy reasons; this is not a capability detection issue but a policy restriction
**How to avoid:** Wrap SharedWorker instantiation in try/catch, immediately fall back to DedicatedWorker on any error
**Warning signs:** Error thrown immediately on `new SharedWorker()`, message mentions "SharedWorker is not enabled"

### Pitfall 2: Missing port.start() in SharedWorker
**What goes wrong:** Messages from worker to main thread never arrive
**Why it happens:** SharedWorker MessagePort requires explicit `start()` call when using addEventListener; using `onmessage` property implicitly starts it
**How to avoid:** Always call `port.start()` after setting up SharedWorker port handlers, or use `port.onmessage = ...` setter
**Warning signs:** Worker script loads but no messages received, no errors thrown

### Pitfall 3: Calling persist() After Worker Spawn
**What goes wrong:** Worker starts without persistence, data may be lost under storage pressure
**Why it happens:** StorageManager.persist() must be called from Window context, and the decision to persist should inform worker initialization
**How to avoid:** Always call `navigator.storage.persist()` BEFORE spawning worker, pass persistence result to worker as init parameter
**Warning signs:** Data disappears after browser restart, storage quota appears limited

### Pitfall 4: Not Handling Worker Load Failures
**What goes wrong:** 404 or network error on worker script causes unhandled rejection
**Why it happens:** Worker constructor doesn't validate URL until instantiation; failures manifest as network errors
**How to avoid:** Wrap worker instantiation in try/catch, implement main thread fallback for any load failure
**Warning signs:** Network error in console, initialization hangs indefinitely

### Pitfall 5: Message Deserialization Errors
**What goes wrong:** Structured clone algorithm fails for certain data types (functions, DOM nodes, certain typed arrays)
**Why it happens:** postMessage uses structured clone, not JSON serialization; incompatible types throw silently
**How to avoid:** Implement onmessageerror handler, validate message schema, use DTO pattern for complex data
**Warning signs:** Messages not arriving, onmessageerror events fired

### Pitfall 6: SharedWorker Singleton Confusion
**What goes wrong:** Multiple tabs create separate SharedWorker instances instead of sharing one
**Why it happens:** Different script URLs or names create separate SharedWorkerGlobalScopes
**How to avoid:** Use consistent name parameter in SharedWorker constructor, ensure same-origin URLs
**Warning signs:** Multiple worker instances in DevTools, state not shared across tabs

## Code Examples

### Worker Detection and Instantiation
```typescript
// Source: MDN + project requirements
function createWorker(
  url: string,
  preferredType: 'auto' | 'shared' | 'dedicated' | 'main' = 'auto'
): { port: MessagePort; type: 'shared' | 'dedicated' | 'main' } {
  // Try SharedWorker
  if (preferredType === 'auto' || preferredType === 'shared') {
    try {
      const worker = new SharedWorker(url, {
        type: 'module',
        name: 'lokulmem-v1'
      });
      worker.port.start();
      return { port: worker.port, type: 'shared' };
    } catch (e) {
      if (preferredType === 'shared') throw e;
    }
  }

  // Try DedicatedWorker
  if (preferredType === 'auto' || preferredType === 'dedicated') {
    try {
      const worker = new Worker(url, { type: 'module' });
      // DedicatedWorker is MessagePort-like
      return { port: worker as unknown as MessagePort, type: 'dedicated' };
    } catch (e) {
      if (preferredType === 'dedicated') throw e;
    }
  }

  // Main thread fallback
  return { port: createMainThreadPort(), type: 'main' };
}
```

### Storage Persistence Request
```typescript
// Source: MDN StorageManager API
interface PersistenceStatus {
  persisted: boolean;
  reason: 'granted' | 'denied' | 'not-supported' | 'error';
  lastAttempt: number;
  error?: string;
}

async function requestStoragePersistence(): Promise<PersistenceStatus> {
  const lastAttempt = Date.now();

  if (!navigator.storage?.persist) {
    return {
      persisted: false,
      reason: 'not-supported',
      lastAttempt
    };
  }

  try {
    const persisted = await navigator.storage.persist();
    return {
      persisted,
      reason: persisted ? 'granted' : 'denied',
      lastAttempt
    };
  } catch (error) {
    return {
      persisted: false,
      reason: 'error',
      lastAttempt,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
```

### Message Protocol with Request/Response
```typescript
// Source: standard worker patterns
interface RequestMessage {
  id: string;
  type: string;
  payload: unknown;
}

interface ResponseMessage {
  id: string;
  type: string;
  payload: unknown;
  error?: { code: string; message: string };
}

class WorkerClient {
  private port: MessagePort;
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();

  constructor(port: MessagePort) {
    this.port = port;
    this.port.onmessage = this.handleMessage.bind(this);
    this.port.onmessageerror = this.handleMessageError.bind(this);
  }

  request(type: string, payload: unknown, timeoutMs = 5000): Promise<unknown> {
    const id = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${type}`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.port.postMessage({ id, type, payload });
    });
  }

  private handleMessage(event: MessageEvent<ResponseMessage>) {
    const { id, payload, error } = event.data;
    const request = this.pendingRequests.get(id);
    if (!request) return;

    clearTimeout(request.timeout);
    this.pendingRequests.delete(id);

    if (error) {
      request.reject(new Error(error.message));
    } else {
      request.resolve(payload);
    }
  }

  private handleMessageError(event: MessageEvent) {
    console.error('Message deserialization error:', event);
  }
}
```

### Worker Entry Point (SharedWorker Compatible)
```typescript
// Source: MDN SharedWorker docs + project requirements
// src/worker/index.ts

interface InitMessage {
  type: 'init';
  payload: {
    dbName: string;
    persistenceGranted: boolean;
    modelConfig: unknown;
  };
}

interface ProgressMessage {
  type: 'progress';
  stage: 'worker' | 'model' | 'storage' | 'maintenance' | 'ready';
  stageProgress: number;
  overallProgress: number;
}

// Handle both DedicatedWorker (direct) and SharedWorker (port)
function setupPort(port: MessagePort) {
  port.onmessage = async (event) => {
    const { type, payload } = event.data;

    switch (type) {
      case 'init':
        await handleInit(port, payload);
        break;
      // ... other handlers
    }
  };
}

async function handleInit(port: MessagePort, config: InitMessage['payload']) {
  // Report worker stage complete
  reportProgress(port, 'worker', 100, 20);

  // Initialize model
  reportProgress(port, 'model', 0, 20);
  await initializeModel(config.modelConfig);
  reportProgress(port, 'model', 100, 40);

  // Initialize storage
  reportProgress(port, 'storage', 0, 40);
  await initializeStorage(config.dbName);
  reportProgress(port, 'storage', 100, 60);

  // Run maintenance
  reportProgress(port, 'maintenance', 0, 60);
  await runMaintenance();
  reportProgress(port, 'maintenance', 100, 80);

  // Ready
  reportProgress(port, 'ready', 100, 100);
}

function reportProgress(
  port: MessagePort,
  stage: ProgressMessage['stage'],
  stageProgress: number,
  overallProgress: number
) {
  port.postMessage({
    type: 'progress',
    stage,
    stageProgress,
    overallProgress
  });
}

// SharedWorker entry point
onconnect = (event) => {
  const port = event.ports[0];
  setupPort(port);
  port.start();
};

// DedicatedWorker entry point (also runs for DedicatedWorker)
if (typeof onconnect === 'undefined') {
  // We're in a DedicatedWorker, use self directly
  setupPort(self as unknown as MessagePort);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Classic workers (no modules) | ES Module Workers with `{ type: 'module' }` | Chrome 80 (2020), Firefox 114 (2023), Safari 15 (2021) | Native import/export syntax, no bundler workarounds needed |
| Blob URL workers for inline code | Separate worker files with ?worker&url imports | Vite/Webpack native support | Cleaner code organization, source maps work correctly |
| Service Workers for computation | Dedicated/Shared Workers only | Always separate use cases | Service Workers have different lifecycle, not for heavy computation |
| postMessage with JSON.stringify | Structured clone algorithm | Always native | Faster, handles typed arrays (like Float32Array embeddings) |

**Deprecated/outdated:**
- `importScripts()` in module workers: Use standard ES imports instead
- `worker.toString()` + Blob URL: Modern bundlers handle worker imports natively
- `window.Worker` checks: Use try/catch for feature detection

## Open Questions

1. **Safari iOS SharedWorker Error Type**
   - What we know: SharedWorker throws in private mode
   - What's unclear: Exact error type/message to distinguish from other failures
   - Recommendation: Catch all SharedWorker errors and fall back; don't try to distinguish

2. **Storage Persistence UX Pattern**
   - What we know: persist() may trigger browser permission prompt
   - What's unclear: Best practice for when to call (page load vs user interaction)
   - Recommendation: Call during initialization but make it non-blocking per user decision

3. **Worker Termination Cleanup**
   - What we know: terminate() stops worker immediately
   - What's unclear: Whether to wait for in-flight operations to complete
   - Recommendation: Document that terminate() is immediate; use graceful shutdown message for cleanup

## Sources

### Primary (HIGH confidence)
- `/mdn/content` - SharedWorker constructor, options, port lifecycle, StorageManager.persist()
- `/mdn/content` - DedicatedWorkerGlobalScope.close(), Worker.terminate()
- `/mdn/content` - MessagePort.start(), onconnect event handling

### Secondary (MEDIUM confidence)
- Project requirements (REQUIREMENTS.md) - WORKER-01 through WORKER-05 specifications
- Project context (02-CONTEXT.md) - User decisions on fallback chain, progress reporting

### Tertiary (LOW confidence)
- Safari private mode behavior: Based on historical reports, not officially documented by Apple

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - MDN documentation verified for all core APIs
- Architecture: HIGH - Established patterns from MDN + project constraints
- Pitfalls: MEDIUM-HIGH - Some Safari-specific behaviors based on community reports

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (30 days - Web APIs are stable)
