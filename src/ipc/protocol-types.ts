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
