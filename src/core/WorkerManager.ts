/**
 * WorkerManager - Manages worker lifecycle with three-tier fallback
 *
 * Fallback chain: SharedWorker → DedicatedWorker → main thread
 *
 * SharedWorker: Multi-tab sync, model sharing (primary)
 * DedicatedWorker: Single-tab worker (fallback)
 * Main thread: Direct execution (last resort)
 */

import { WorkerClient, createMainThreadPort } from './MessagePort.js';
import { requestPersistence } from './Persistence.js';
import type { InitPayload, ProgressMessage } from './Protocol.js';
import type {
  InitStage,
  PortLike,
  ProgressCallback,
  WorkerConfig,
  WorkerType,
} from './types.js';
import type { PersistenceStatus } from './types.js';

/**
 * Queued message for buffering during initialization
 */
interface QueuedMessage {
  type: string;
  payload: unknown;
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
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
  private messageQueue: QueuedMessage[] = [];

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

    // Set up progress handling using client.onMessage
    if (onProgress) {
      this.client.onMessage((message) => {
        if (message && typeof message === 'object' && 'type' in message) {
          const progressMsg = message as ProgressMessage;
          if (progressMsg.type === 'progress' && progressMsg.stage) {
            onProgress(
              progressMsg.stage as InitStage,
              progressMsg.stageProgress,
              progressMsg.overallProgress,
              progressMsg.message,
            );
          }
        }
      });
    }

    // Send INIT request and wait for completion
    await this.sendInitRequest(config);

    this.isReady = true;

    // Flush any queued messages
    this.flushMessageQueue();
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
   * Queue a message to be sent once the worker is ready
   * If already ready, sends immediately
   *
   * @param type - Message type
   * @param payload - Message payload
   * @returns Promise that resolves with the response
   */
  queueMessage(type: string, payload: unknown): Promise<unknown> {
    if (this.isReady && this.client) {
      return this.client.request(type, payload, 5000);
    }

    // Queue the message for later
    return new Promise((resolve, reject) => {
      this.messageQueue.push({ type, payload, resolve, reject });
    });
  }

  /**
   * Flush all queued messages after initialization completes
   */
  private flushMessageQueue(): void {
    if (!this.client) return;

    for (const queued of this.messageQueue) {
      this.client
        .request(queued.type, queued.payload, 5000)
        .then(queued.resolve)
        .catch(queued.reject);
    }

    this.messageQueue = [];
  }

  /**
   * Terminate the worker and clean up resources
   */
  terminate(): void {
    // Terminate client first to clean up pending requests
    if (this.client) {
      this.client.terminate();
    }

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

    // Reject any queued messages
    for (const queued of this.messageQueue) {
      queued.reject(
        new Error('Worker terminated before message could be sent'),
      );
    }
    this.messageQueue = [];

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
   * Private: Validate workerUrl with permissive rules
   * Accepts: relative paths, absolute URLs, blob:, data:, extensionless URLs
   */
  private validateWorkerUrl(url: string): void {
    // Permissive validation - accept almost any string
    // Only warn if it looks completely invalid
    const looksLikeUrl =
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('blob:') ||
      url.startsWith('data:') ||
      url.startsWith('/') ||
      url.startsWith('./') ||
      url.startsWith('../') ||
      url.includes('/'); // extensionless URLs like /api/worker

    if (
      !looksLikeUrl &&
      !url.endsWith('.js') &&
      !url.endsWith('.mjs') &&
      !url.endsWith('.ts')
    ) {
      console.warn(
        `[LokulMem] workerUrl "${url}" may not be a valid URL. Expected: relative path, absolute URL, blob:, or data: URL`,
      );
    }
  }

  /**
   * Private: Execute the fallback chain to get a PortLike
   */
  private async doInitialize(config: WorkerConfig): Promise<PortLike> {
    const preferredType = config.workerType;

    // Validate workerUrl (permissive - only warns)
    this.validateWorkerUrl(config.workerUrl);

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
   * Uses createMainThreadPort from MessagePort.ts for in-memory communication
   */
  private createMainThreadPort(): PortLike {
    return createMainThreadPort();
  }

  /**
   * Private: Send INIT request to worker
   */
  private async sendInitRequest(config: WorkerConfig): Promise<void> {
    if (!this.client) {
      throw new Error('Worker client not initialized');
    }

    const initPayload: InitPayload = {
      dbName: config.dbName,
      modelConfig: config.modelConfig,
      persistenceGranted: this.persistenceStatus?.persisted ?? false,
      workerUrl: config.workerUrl,
    };

    await this.client.request('init', initPayload, config.initTimeoutMs);
  }

  /**
   * Register an event handler for specific message types
   * Used for lifecycle events that are sent asynchronously from the worker
   *
   * @param messageType - The message type to listen for (e.g., 'MEMORY_FADED', 'MEMORY_DELETED')
   * @param handler - Callback function that receives the event payload
   * @returns Unsubscribe function to remove the handler
   */
  on(messageType: string, handler: (payload: unknown) => void): () => void {
    if (!this.port) {
      throw new Error('Worker not initialized');
    }

    // Create a wrapper that only handles messages of the specified type
    const eventHandler = (event: MessageEvent): void => {
      const message = event.data;
      if (
        message &&
        typeof message === 'object' &&
        'type' in message &&
        message.type === messageType
      ) {
        handler(message.payload);
      }
    };

    // Add the event listener
    this.port.addEventListener('message', eventHandler);
    if (this.port.start) {
      this.port.start();
    }

    // Return unsubscribe function
    return () => {
      this.port?.removeEventListener('message', eventHandler);
    };
  }
}
