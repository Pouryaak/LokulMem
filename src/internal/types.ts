/**
 * Internal types for LokulMem
 * These types are NOT exported publicly and contain implementation details
 * like Float32Array embeddings that don't serialize well over IPC
 */

import type { MemoryDTO } from '../types/memory.js';

/**
 * MemoryInternal - Internal representation with embedding
 * Extends MemoryDTO with Float32Array embedding (internal use only)
 */
export interface MemoryInternal extends Omit<MemoryDTO, 'metadata'> {
  /** Vector embedding for similarity search (internal only) */
  embedding: Float32Array;

  /** Metadata with internal fields allowed */
  metadata: Record<string, unknown>;
}

/**
 * EpisodeInternal - Internal representation of an episode
 * Episodes group related memories into coherent narratives
 */
export interface EpisodeInternal {
  /** Unique identifier for the episode */
  id: string;

  /** Human-readable summary of the episode */
  summary: string;

  /** ID of the first memory in the episode */
  startMemoryId: string;

  /** ID of the last memory in the episode */
  endMemoryId: string;

  /** Creation timestamp (Unix ms) */
  createdAt: number;
}

/**
 * EdgeInternal - Internal representation of a memory graph edge
 * Edges connect related memories with similarity scores
 */
export interface EdgeInternal {
  /** Unique identifier for the edge */
  id: string;

  /** Source memory ID */
  sourceMemoryId: string;

  /** Target memory ID */
  targetMemoryId: string;

  /** Similarity score between memories (0-1) */
  similarity: number;

  /** Creation timestamp (Unix ms) */
  createdAt: number;
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
