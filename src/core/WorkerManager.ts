/**
 * WorkerManager - Manages worker lifecycle with three-tier fallback
 *
 * Fallback chain: SharedWorker → DedicatedWorker → main thread
 *
 * SharedWorker: Multi-tab sync, model sharing (primary)
 * DedicatedWorker: Single-tab worker (fallback)
 * Main thread: Direct execution (last resort)
 */

import { requestPersistence } from './Persistence.js';
import type {
  InitStage,
  PortLike,
  ProgressCallback,
  WorkerConfig,
  WorkerType,
} from './types.js';
import type { PersistenceStatus } from './types.js';

/**
 * WorkerClient for communicating with the worker via PortLike
 */
class WorkerClient {
  private port: PortLike;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (reason: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  constructor(port: PortLike) {
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

  private handleMessage(event: MessageEvent) {
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

/**
 * WorkerManager handles worker detection, fallback chain, and lifecycle
 */
export class WorkerManager {
  private port: PortLike | null = null;
  private worker: SharedWorker | Worker | null = null;
  private workerType: WorkerType = 'main-thread';
  private persistenceStatus: PersistenceStatus | null = null;
  private isReady = false;
  private client: WorkerClient | null = null;

  /**
   * Initialize the worker with fallback chain
   *
   * @param config - Worker configuration
   * @param onProgress - Optional progress callback
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(
    config: WorkerConfig,
    onProgress?: ProgressCallback,
  ): Promise<void> {
    // Get port via fallback chain
    this.port = await this.doInitialize(config);

    // Create client for communication
    this.client = new WorkerClient(this.port);

    // Set up progress handling
    if (onProgress) {
      this.setupProgressHandling(onProgress);
    }

    // Send INIT request and wait for completion
    await this.sendInitRequest(config);

    this.isReady = true;
  }

  /**
   * Get the current worker type
   *
   * @returns 'shared' | 'dedicated' | 'main-thread'
   */
  getWorkerType(): WorkerType {
    return this.workerType;
  }

  /**
   * Get the current persistence status
   *
   * @returns PersistenceStatus or null if not requested
   */
  getPersistenceStatus(): PersistenceStatus | null {
    return this.persistenceStatus;
  }

  /**
   * Check if initialization is complete
   *
   * @returns true if ready
   */
  isInitialized(): boolean {
    return this.isReady;
  }

  /**
   * Get the worker client for making requests
   *
   * @returns WorkerClient or null if not initialized
   */
  getClient(): WorkerClient | null {
    return this.client;
  }

  /**
   * Terminate the worker and clean up resources
   */
  terminate(): void {
    if (this.worker) {
      if (this.worker instanceof SharedWorker) {
        this.worker.port.close?.();
      } else {
        this.worker.terminate();
      }
    }

    if (this.port?.close) {
      this.port.close();
    }

    this.port = null;
    this.worker = null;
    this.client = null;
    this.isReady = false;
    this.workerType = 'main-thread';
  }

  /**
   * Request storage persistence explicitly
   * Note: This is NOT auto-called during initialize() per Phase 2 decisions
   *
   * @returns PersistenceStatus with result
   */
  async persistStorage(): Promise<PersistenceStatus> {
    this.persistenceStatus = await requestPersistence();
    return this.persistenceStatus;
  }

  /**
   * Private: Execute the fallback chain to get a PortLike
   */
  private async doInitialize(config: WorkerConfig): Promise<PortLike> {
    const preferredType = config.workerType;

    // Try SharedWorker first
    if (preferredType === 'auto' || preferredType === 'shared') {
      try {
        const sharedWorker = new SharedWorker(config.workerUrl, {
          type: 'module',
          name: 'lokulmem-v1',
        });

        const port = sharedWorker.port as PortLike;
        port.start?.();

        this.worker = sharedWorker;
        this.workerType = 'shared';
        return port;
      } catch (e) {
        if (preferredType === 'shared') {
          throw e;
        }
        // Fall through to DedicatedWorker
      }
    }

    // Try DedicatedWorker
    if (preferredType === 'auto' || preferredType === 'dedicated') {
      try {
        const dedicatedWorker = new Worker(config.workerUrl, {
          type: 'module',
        });

        this.worker = dedicatedWorker;
        this.workerType = 'dedicated';
        return this.createDedicatedWorkerPort(dedicatedWorker);
      } catch (e) {
        if (preferredType === 'dedicated') {
          throw e;
        }
        // Fall through to main thread
      }
    }

    // Main thread fallback
    this.workerType = 'main-thread';
    return this.createMainThreadPort();
  }

  /**
   * Private: Wrap a DedicatedWorker in PortLike interface
   */
  private createDedicatedWorkerPort(worker: Worker): PortLike {
    return {
      postMessage: (data: unknown, transfer?: Transferable[]) => {
        if (transfer) {
          worker.postMessage(data, transfer);
        } else {
          worker.postMessage(data);
        }
      },
      get onmessage() {
        return worker.onmessage;
      },
      set onmessage(handler: ((event: MessageEvent) => void) | null) {
        worker.onmessage = handler;
      },
      get onmessageerror() {
        return worker.onmessageerror;
      },
      set onmessageerror(handler: ((event: MessageEvent) => void) | null) {
        worker.onmessageerror = handler;
      },
      close: () => {
        worker.terminate();
      },
    };
  }

  /**
   * Private: Create a PortLike for main thread execution
   * Placeholder - will be wired to in-memory worker handlers in Plan 03
   */
  private createMainThreadPort(): PortLike {
    // Placeholder implementation
    // Will be connected to in-memory worker handlers in a future plan
    return {
      postMessage: (_data: unknown, _transfer?: Transferable[]) => {
        console.warn('Main thread port not yet implemented');
      },
      onmessage: null,
      onmessageerror: null,
    };
  }

  /**
   * Private: Set up progress message handling
   */
  private setupProgressHandling(onProgress: ProgressCallback): void {
    if (!this.port) return;

    const originalOnMessage = this.port.onmessage;
    this.port.onmessage = (event: MessageEvent) => {
      // Call original handler if exists
      if (originalOnMessage) {
        originalOnMessage.call(this.port, event);
      }

      // Handle progress messages
      const { type, stage, stageProgress, overallProgress, message } =
        event.data;
      if (type === 'progress' && stage) {
        onProgress(stage as InitStage, stageProgress, overallProgress, message);
      }
    };
  }

  /**
   * Private: Send INIT request to worker
   */
  private async sendInitRequest(config: WorkerConfig): Promise<void> {
    if (!this.client) {
      throw new Error('Worker client not initialized');
    }

    const initPayload = {
      dbName: config.dbName,
      modelConfig: config.modelConfig,
      persistenceStatus: this.persistenceStatus,
    };

    await this.client.request('init', initPayload, config.initTimeoutMs);
  }
}

export { WorkerClient };
