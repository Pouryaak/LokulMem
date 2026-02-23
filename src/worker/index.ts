/**
 * LokulMem Worker - Runs in Web Worker context
 *
 * Handles:
 * - Embedding computation via Transformers.js
 * - Vector search operations
 * - Memory lifecycle maintenance
 * - Storage operations via Dexie.js
 */

import type {
  InitPayload,
  ProgressMessage,
  RequestMessage,
  ResponseMessage,
} from '../core/Protocol.js';
import { MessageType as MessageTypeConst } from '../core/Protocol.js';
import type { PortLike } from '../core/types.js';
import type { InitStage } from '../types/api.js';

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
 * Handle initialization request with progress reporting through all 5 stages
 */
async function handleInit(
  port: PortLike,
  request: RequestMessage,
): Promise<void> {
  const payload = request.payload as InitPayload;

  try {
    // Stage 1: Worker initialization (complete - we're running)
    reportProgress(port, 'worker', 100);

    // Stage 2: Model initialization (stub for future phase)
    reportProgress(port, 'model', 0);
    await initializeModel(payload.modelConfig);
    reportProgress(port, 'model', 100);

    // Stage 3: Storage initialization (stub for future phase)
    reportProgress(port, 'storage', 0);
    await initializeStorage(payload.dbName);
    reportProgress(port, 'storage', 100);

    // Stage 4: Maintenance (stub for future phase)
    reportProgress(port, 'maintenance', 0);
    await runMaintenance();
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
    const response: ResponseMessage = {
      id: request.id,
      type: MessageTypeConst.ERROR,
      payload: null,
      error: {
        code: 'INIT_FAILED',
        message: errorMessage,
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
      workerScope.postMessage(data, transfer);
    },
    onmessage: null,
    onmessageerror: null,
  };
}

// Stubs for future phases

/**
 * Initialize the embedding model (Phase 4)
 */
async function initializeModel(_config?: unknown): Promise<void> {
  // Stub: Will be implemented in Phase 4 (Embedding Engine)
  // Simulates async work
  await new Promise((resolve) => setTimeout(resolve, 10));
}

/**
 * Initialize storage layer (Phase 3)
 */
async function initializeStorage(_dbName: string): Promise<void> {
  // Stub: Will be implemented in Phase 3 (Storage Layer)
  // Simulates async work
  await new Promise((resolve) => setTimeout(resolve, 10));
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
// biome-ignore lint/suspicious/noExplicitAny: SharedWorker global scope
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
