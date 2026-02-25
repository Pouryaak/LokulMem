/**
 * MessagePort abstraction and WorkerClient for request/response handling
 * Provides consistent communication interface across SharedWorker, DedicatedWorker, and main thread
 */

import type {
  ProgressMessage,
  RequestMessage,
  ResponseMessage,
  WorkerMessage,
} from './Protocol.js';
import type { PortLike } from './types.js';

/**
 * Pending request tracking for request/response correlation
 */
interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * WorkerClient - handles request/response correlation with timeout support
 * Wraps a PortLike interface for consistent messaging across worker types
 */
export class WorkerClient {
  private port: PortLike;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private messageHandler: ((message: WorkerMessage) => void) | null = null;

  /**
   * Creates a WorkerClient wrapping the given port
   * @param port - The PortLike interface to wrap
   */
  constructor(port: PortLike) {
    this.port = port;
    this.handleMessage = this.handleMessage.bind(this);
    this.handleMessageError = this.handleMessageError.bind(this);

    this.port.onmessage = this.handleMessage;
    this.port.onmessageerror = this.handleMessageError;
  }

  /**
   * Send a request and wait for a correlated response
   * @param type - Message type for routing
   * @param payload - Request payload
   * @param timeoutMs - Timeout in milliseconds (required, no default)
   * @returns Promise that resolves with the response payload
   */
  request(type: string, payload: unknown, timeoutMs: number): Promise<unknown> {
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${type} after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      const message: RequestMessage = { id, type, payload };
      this.port.postMessage(message);
    });
  }

  /**
   * Set a handler for non-response messages (like progress updates)
   * @param handler - Callback for incoming messages without pending requests
   */
  onMessage(handler: (message: WorkerMessage) => void): void {
    this.messageHandler = handler;
  }

  /**
   * Terminate the client, cleaning up all pending requests
   */
  terminate(): void {
    // Reject all pending requests
    for (const [, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('WorkerClient terminated'));
    }
    this.pendingRequests.clear();

    // Remove event listeners
    this.port.onmessage = null;
    this.port.onmessageerror = null;

    // Close port if possible
    if (this.port.close) {
      this.port.close();
    }
  }

  /**
   * Handle incoming messages - resolve pending requests or forward to handler
   */
  private handleMessage(
    event: MessageEvent<ResponseMessage | ProgressMessage>,
  ): void {
    const message = event.data;

    if (!message || typeof message !== 'object') {
      return;
    }

    // Check if this is a response to a pending request
    if ('id' in message && this.pendingRequests.has(message.id)) {
      const request = this.pendingRequests.get(message.id);
      if (!request) return;
      clearTimeout(request.timeout);
      this.pendingRequests.delete(message.id);

      if ('error' in message && message.error) {
        const error = new Error(message.error.message);
        (error as Error & { code: string }).code = message.error.code;
        request.reject(error);
      } else {
        request.resolve(message.payload);
      }
      return;
    }

    // Forward to message handler if set
    if (this.messageHandler) {
      this.messageHandler(message as WorkerMessage);
    }
  }

  /**
   * Handle message deserialization errors
   */
  private handleMessageError(event: MessageEvent): void {
    console.error('Message deserialization error:', event);
  }
}

/**
 * In-memory message channel for main thread fallback
 * Simulates MessagePort behavior within the same thread
 */
class MainThreadChannel {
  port1: PortLike;
  port2: PortLike;
  private port1Handler: ((event: MessageEvent) => void) | null = null;
  private port2Handler: ((event: MessageEvent) => void) | null = null;

  constructor() {
    // Map of event listeners for each port
    const port1Listeners = new Map<string, Set<(event: Event) => void>>();
    const port2Listeners = new Map<string, Set<(event: Event) => void>>();

    this.port1 = {
      postMessage: (data: unknown, _transfer?: Transferable[]) => {
        if (this.port2Handler) {
          const event = new MessageEvent('message', { data });
          this.port2Handler(event);
        }
        // Also trigger addEventListener listeners
        const listeners = port2Listeners.get('message');
        if (listeners) {
          const event = new MessageEvent('message', { data });
          for (const listener of listeners) {
            listener(event);
          }
        }
      },
      onmessage: null,
      onmessageerror: null,
      addEventListener: (type: string, listener: (event: Event) => void) => {
        let listeners = port1Listeners.get(type);
        if (!listeners) {
          listeners = new Set();
          port1Listeners.set(type, listeners);
        }
        listeners.add(listener);
      },
      removeEventListener: (type: string, listener: (event: Event) => void) => {
        const listeners = port1Listeners.get(type);
        if (listeners) {
          listeners.delete(listener);
        }
      },
    };

    this.port2 = {
      postMessage: (data: unknown, _transfer?: Transferable[]) => {
        if (this.port1Handler) {
          const event = new MessageEvent('message', { data });
          this.port1Handler(event);
        }
        // Also trigger addEventListener listeners
        const listeners = port1Listeners.get('message');
        if (listeners) {
          const event = new MessageEvent('message', { data });
          for (const listener of listeners) {
            listener(event);
          }
        }
      },
      onmessage: null,
      onmessageerror: null,
      addEventListener: (type: string, listener: (event: Event) => void) => {
        let listeners = port2Listeners.get(type);
        if (!listeners) {
          listeners = new Set();
          port2Listeners.set(type, listeners);
        }
        listeners.add(listener);
      },
      removeEventListener: (type: string, listener: (event: Event) => void) => {
        const listeners = port2Listeners.get(type);
        if (listeners) {
          listeners.delete(listener);
        }
      },
    };

    // Set up handler proxies
    Object.defineProperty(this.port1, 'onmessage', {
      set: (handler: ((event: MessageEvent) => void) | null) => {
        this.port1Handler = handler;
      },
      get: () => this.port1Handler,
    });

    Object.defineProperty(this.port2, 'onmessage', {
      set: (handler: ((event: MessageEvent) => void) | null) => {
        this.port2Handler = handler;
      },
      get: () => this.port2Handler,
    });

    Object.defineProperty(this.port1, 'onmessageerror', {
      set: () => {},
      get: () => null,
    });

    Object.defineProperty(this.port2, 'onmessageerror', {
      set: () => {},
      get: () => null,
    });
  }
}

/**
 * Create a PortLike for main thread fallback
 * Creates an in-memory message channel that simulates worker communication
 * @returns PortLike for use in main thread mode
 */
export function createMainThreadPort(): PortLike {
  const channel = new MainThreadChannel();
  return channel.port1;
}
