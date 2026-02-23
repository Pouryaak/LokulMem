/**
 * Embedding storage utilities for LokulMem
 *
 * Handles conversion between Float32Array (runtime format) and ArrayBuffer
 * (IndexedDB storage format). This is necessary because:
 *
 * 1. Float32Array is a view onto an underlying ArrayBuffer
 * 2. The underlying buffer may be larger than the view (e.g., from .slice())
 * 3. IndexedDB stores the entire underlying buffer, not just the viewed portion
 * 4. This can cause data corruption or storage of extra unintended data
 *
 * Solution: Always use explicit .slice() to create a standalone ArrayBuffer
 * containing exactly the embedding data, with no extra bytes.
 */

import type { MemoryInternal } from '../internal/types.js';
import type { DbClusterRow, DbMemoryRow } from './Database.js';

/**
 * Expected embedding dimension for MiniLM-L6-v2 model
 * All embeddings must be exactly this length
 */
export const EXPECTED_EMBEDDING_DIM = 384;

/**
 * Convert Float32Array embedding to ArrayBuffer for IndexedDB storage
 *
 * CRITICAL: Uses explicit slice to avoid the TypedArray view footgun.
 * When you access .buffer on a Float32Array, you get the ENTIRE underlying
 * ArrayBuffer, which may be larger than the viewed portion. This happens
 * when arrays are created via .slice() or .subarray().
 *
 * By using .slice(byteOffset, byteOffset + byteLength), we create a NEW
 * ArrayBuffer containing ONLY the embedding data, ensuring clean storage
 * and retrieval.
 *
 * @param embedding - Float32Array embedding vector
 * @returns ArrayBuffer containing exactly the embedding bytes
 */
export function toDbFormat(embedding: Float32Array): ArrayBuffer {
  return embedding.buffer.slice(
    embedding.byteOffset,
    embedding.byteOffset + embedding.byteLength,
  ) as ArrayBuffer;
}

/**
 * Convert ArrayBuffer from IndexedDB back to Float32Array
 *
 * Validates that the buffer length matches the expected embedding dimension.
 * This catches data corruption or dimension mismatches early.
 *
 * @param buffer - ArrayBuffer from IndexedDB
 * @returns Float32Array embedding vector
 * @throws Error if buffer size doesn't match expected dimension
 */
export function fromDbFormat(buffer: ArrayBuffer): Float32Array {
  const embedding = new Float32Array(buffer);

  if (embedding.length !== EXPECTED_EMBEDDING_DIM) {
    throw new Error(
      `Embedding dimension mismatch: expected ${EXPECTED_EMBEDDING_DIM}, got ${embedding.length}`,
    );
  }

  return embedding;
}

/**
 * ClusterInternal - Internal representation of a memory cluster
 * Clusters group related memories using K-means clustering
 */
export interface ClusterInternal {
  /** Unique identifier for the cluster */
  id: string;

  /** Centroid vector for the cluster (average of member embeddings) */
  embedding: Float32Array;

  /** IDs of memories in this cluster */
  memoryIds: string[];

  /** Creation timestamp (Unix ms) */
  createdAt: number;
}

/**
 * Convert MemoryInternal to DbMemoryRow for storage
 *
 * Transforms:
 * - embedding (Float32Array) -> embeddingBytes (ArrayBuffer)
 * - pinned (boolean) -> pinnedInt (number: 1 or 0)
 *
 * @param memory - Internal memory representation
 * @returns Database row format
 */
export function memoryToDb(memory: MemoryInternal): DbMemoryRow {
  const { embedding, pinned, metadata, ...rest } = memory;

  return {
    ...rest,
    embeddingBytes: toDbFormat(embedding),
    pinnedInt: pinned ? 1 : 0,
    metadata,
  };
}

/**
 * Convert DbMemoryRow back to MemoryInternal
 *
 * Transforms:
 * - embeddingBytes (ArrayBuffer) -> embedding (Float32Array)
 * - pinnedInt (number) -> pinned (boolean)
 *
 * @param row - Database row format
 * @returns Internal memory representation
 * @throws Error if embedding dimension is invalid
 */
export function memoryFromDb(row: DbMemoryRow): MemoryInternal {
  const { embeddingBytes, pinnedInt, ...rest } = row;

  return {
    ...rest,
    embedding: fromDbFormat(embeddingBytes),
    pinned: pinnedInt === 1,
  } as MemoryInternal;
}

/**
 * Convert ClusterInternal to DbClusterRow for storage
 *
 * Transforms embedding (Float32Array) -> embeddingBytes (ArrayBuffer)
 *
 * @param cluster - Internal cluster representation
 * @returns Database row format
 */
export function clusterToDb(cluster: ClusterInternal): DbClusterRow {
  return {
    id: cluster.id,
    embeddingBytes: toDbFormat(cluster.embedding),
    memoryIds: cluster.memoryIds,
    createdAt: cluster.createdAt,
  };
}

/**
 * Convert DbClusterRow back to ClusterInternal
 *
 * Transforms embeddingBytes (ArrayBuffer) -> embedding (Float32Array)
 *
 * @param row - Database row format
 * @returns Internal cluster representation
 * @throws Error if embedding dimension is invalid
 */
export function clusterFromDb(row: DbClusterRow): ClusterInternal {
  return {
    id: row.id,
    embedding: fromDbFormat(row.embeddingBytes),
    memoryIds: row.memoryIds,
    createdAt: row.createdAt,
  };
}
