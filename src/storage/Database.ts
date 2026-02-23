/**
 * LokulDatabase - Dexie.js database for LokulMem
 *
 * Defines the v1 schema with 4 stores:
 * - memories: Core memory storage with embeddings
 * - episodes: Grouped memory narratives
 * - edges: Memory relationship graph
 * - clusters: K-means cluster centroids
 *
 * Uses ArrayBuffer for embedding storage (Float32Array doesn't serialize to IndexedDB).
 * Uses multi-entry indexes (*types) for efficient array querying.
 * Uses compound indexes ([status+lastAccessedAt]) for optimized queries.
 */

import Dexie, { type Table } from 'dexie';
import type { EdgeInternal, EpisodeInternal } from '../internal/types.js';

/**
 * Database row format for memories
 * Embedding stored as ArrayBuffer for IndexedDB compatibility
 */
export interface DbMemoryRow {
  /** Unique identifier for the memory */
  id: string;

  /** Memory content (the actual information) */
  content: string;

  /** Memory types (can have multiple per schema) */
  types: string[];

  /** Current status in the lifecycle */
  status: 'active' | 'faded' | 'archived' | 'superseded';

  /** Creation timestamp (Unix ms) */
  createdAt: number;

  /** Last update timestamp (Unix ms) */
  updatedAt: number;

  /** When this memory becomes valid (Unix ms) */
  validFrom: number;

  /** When this memory expires, null if never (Unix ms) */
  validTo: number | null;

  /** Base importance/strength of the memory (0-1) */
  baseStrength: number;

  /** Current strength after decay (0-1) */
  currentStrength: number;

  /** Whether the memory is pinned as number (0 or 1) - IndexedDB doesn't index booleans reliably */
  pinnedInt: number;

  /** How many times this memory has been mentioned/accessed */
  mentionCount: number;

  /** Last access timestamp (Unix ms) */
  lastAccessedAt: number;

  /** Cluster ID for grouping related memories */
  clusterId: string | null;

  /** Named entities extracted from the content */
  entities: string[];

  /** Conversation IDs this memory belongs to */
  sourceConversationIds: string[];

  /** ID of the memory that superseded this one */
  supersededBy: string | null;

  /** When this memory was superseded (Unix ms) */
  supersededAt: number | null;

  /** When this memory faded (Unix ms) */
  fadedAt: number | null;

  /** Additional metadata */
  metadata: Record<string, unknown>;

  /** Embedding stored as ArrayBuffer for IndexedDB compatibility */
  embeddingBytes: ArrayBuffer;
}

/**
 * Database row format for clusters
 * Centroid embedding stored as ArrayBuffer
 */
export interface DbClusterRow {
  /** Unique identifier for the cluster */
  id: string;

  /** Centroid vector stored as raw bytes */
  embeddingBytes: ArrayBuffer;

  /** IDs of memories in this cluster */
  memoryIds: string[];

  /** Creation timestamp (Unix ms) */
  createdAt: number;
}

/**
 * LokulDatabase - Main database class extending Dexie
 *
 * Version 1 schema includes all 4 stores with optimized indexes:
 *
 * Memories indexes:
 * - Primary: id
 * - Multi-entry: *types (for array membership queries)
 * - Single: status, clusterId, lastAccessedAt, baseStrength, validFrom, pinnedInt, mentionCount
 * - Compound: [status+lastAccessedAt], [clusterId+status], [status+baseStrength]
 *
 * Note: No [types+status] compound index because *types is multiEntry
 * and incompatible with compound indexes in IndexedDB.
 *
 * Episodes indexes:
 * - Primary: id
 * - Single: startMemoryId, endMemoryId, createdAt
 *
 * Edges indexes:
 * - Primary: id
 * - Single: sourceMemoryId, targetMemoryId, similarity, createdAt
 *
 * Clusters indexes:
 * - Primary: id
 * - Single: createdAt
 */
export class LokulDatabase extends Dexie {
  /** Memories table with ArrayBuffer embeddings */
  memories!: Table<DbMemoryRow, string>;

  /** Episodes table */
  episodes!: Table<EpisodeInternal, string>;

  /** Edges table for memory relationships */
  edges!: Table<EdgeInternal, string>;

  /** Clusters table with centroid embeddings */
  clusters!: Table<DbClusterRow, string>;

  constructor() {
    super('LokulMemDB');

    // Version 1: Initial schema
    this.version(1)
      .stores({
        memories: `
          id,
          *types,
          status,
          clusterId,
          lastAccessedAt,
          baseStrength,
          validFrom,
          pinnedInt,
          mentionCount,
          [status+lastAccessedAt],
          [clusterId+status],
          [status+baseStrength]
        `,
        episodes: 'id, startMemoryId, endMemoryId, createdAt',
        edges: 'id, sourceMemoryId, targetMemoryId, similarity, createdAt',
        clusters: 'id, createdAt',
      })
      .upgrade(async () => {
        // v1 is initial creation - no data migration needed
        // Future versions will add upgrade logic here
      });

    // Future migrations follow this pattern:
    // this.version(2).stores({
    //   memories: '..., newField'
    // }).upgrade(async (trans) => {
    //   // Migration logic here
    // });
  }

  /**
   * Get the current database version number
   * Forces database open and returns the version
   */
  async getVersion(): Promise<number> {
    await this.open();
    return this.verno;
  }
}

/** Singleton database instance */
export const db = new LokulDatabase();
