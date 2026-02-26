/**
 * RPC payload types for worker communication
 *
 * These types define the request/response payloads for specific message types.
 * Separated from Protocol.ts to keep message envelope constants distinct from
 * RPC operation payloads.
 *
 * All payloads reference public DTO types (MemoryDTO, not MemoryInternal) to
 * maintain the DTO pattern across the IPC boundary.
 */

import type {
  FullTextSearchOptions,
  PaginatedResult,
  QueryOptions,
  SemanticSearchOptions,
} from '../search/types.js';
import type { ChatMessage, LokulMemDebug } from '../types/api.js';
import type { ContradictionEvent } from '../types/events.js';
import type { MemoryDTO } from '../types/memory.js';

/**
 * Payload for LIST message type
 * Lists memories with optional filtering, sorting, and pagination
 */
export interface ListPayload {
  options?: QueryOptions;
}

/**
 * Response payload for LIST message type
 * Returns paginated list of memories
 */
export interface ListResponsePayload {
  result: PaginatedResult<MemoryDTO>;
}

/**
 * Payload for GET message type
 * Gets a single memory by ID
 */
export interface GetPayload {
  id: string;
  includeEmbedding?: boolean;
}

/**
 * Response payload for GET message type
 * Returns a single memory or null if not found
 */
export interface GetResponsePayload {
  memory: MemoryDTO | null;
}

/**
 * Payload for SEARCH message type
 * Performs full-text search on memory content
 */
export interface SearchPayload {
  query: string;
  options?: FullTextSearchOptions;
}

/**
 * Response payload for SEARCH message type
 * Returns paginated list of matching memories
 */
export interface SearchResponsePayload {
  result: PaginatedResult<MemoryDTO>;
}

/**
 * Payload for SEMANTIC_SEARCH message type
 * Performs semantic vector search with optional composite scoring
 */
export interface SemanticSearchPayload {
  query: string;
  options?: SemanticSearchOptions;
}

/**
 * Response payload for SEMANTIC_SEARCH message type
 * Returns array of memories ranked by relevance
 */
export interface SemanticSearchResponsePayload {
  memories: MemoryDTO[];
}

/**
 * Payload for MEMORY_FADED event message type
 * Emitted when a memory's strength drops below the faded threshold
 */
export interface MemoryFadedEvent {
  type: 'MEMORY_FADED';
  payload: MemoryDTO;
}

/**
 * Payload for MEMORY_DELETED event message type
 * Emitted when a memory is permanently deleted from storage
 */
export interface MemoryDeletedEvent {
  type: 'MEMORY_DELETED';
  payload: { memoryId: string };
}

/**
 * Payload for AUGMENT message type
 * Augments user message with relevant memories
 */
export interface AugmentPayload {
  /** User message to augment */
  userMessage: string;
  /** Conversation history */
  history: ChatMessage[];
  /** Augment options */
  options: {
    contextWindowTokens?: number;
    reservedForResponseTokens?: number;
    maxTokens?: number;
    debug?: boolean;
  };
}

/**
 * Response payload for AUGMENT message type
 * Returns augmented messages with metadata
 */
export interface AugmentResponsePayload {
  /** Augmented messages array */
  messages: ChatMessage[];
  /** Augmentation metadata */
  metadata: {
    injectedCount: number;
    noMemoriesFound: boolean;
    usedTokensBeforeInjection: number;
    injectionTokens: number;
    remainingTokensAfterInjection: number;
  };
  /** Debug info (only if options.debug = true) */
  debug?: LokulMemDebug;
}

/**
 * Payload for LEARN message type
 * Extracts memories from conversation
 */
export interface LearnPayload {
  /** User message */
  userMessage: ChatMessage;
  /** Assistant response */
  assistantResponse: ChatMessage;
  /** Learn options */
  options: {
    conversationId?: string;
    extractFrom?: 'user' | 'assistant' | 'both';
    runMaintenance?: boolean;
    learnThreshold?: number;
    autoAssociate?: boolean;
    storeResponse?: boolean;
    verbose?: boolean;
  };
}

/**
 * Response payload for LEARN message type
 * Returns extraction results
 */
export interface LearnResponsePayload {
  /** Extracted memories */
  extracted: MemoryDTO[];
  /** Contradictions detected */
  contradictions: ContradictionEvent[];
  /** Maintenance results */
  maintenance: {
    faded: number;
    deleted: number;
  };
  /** Conversation ID */
  conversationId: string;
}
