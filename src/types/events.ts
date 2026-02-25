/**
 * Event and callback types for LokulMem
 */

import type { MemoryDTO } from './memory.js';

/**
 * Statistics about the memory store
 */
export interface MemoryStats {
  /** Total number of memories */
  totalMemories: number;

  /** Number of active memories */
  activeMemories: number;

  /** Number of faded memories */
  fadedMemories: number;

  /** Number of pinned memories */
  pinnedMemories: number;

  /** Average strength across all memories (0-1) */
  averageStrength: number;

  /** Timestamp of oldest memory (Unix ms), null if no memories */
  oldestMemoryAt: number | null;

  /** Timestamp of newest memory (Unix ms), null if no memories */
  newestMemoryAt: number | null;
}

/**
 * Callback for memory-related events
 */
export type MemoryCallback = (memory: MemoryDTO) => void;

/**
 * Callback for memory ID events (e.g., deletion)
 */
export type MemoryIdCallback = (id: string) => void;

/**
 * Callback for stats updates
 */
export type StatsCallback = (stats: MemoryStats) => void;

/**
 * Contradiction event payload
 *
 * CRITICAL: Per CONTEXT decision, events contain IDs and metadata only.
 * Full content retrievable via manage().get() if needed.
 * DTO violation: Do NOT include full MemoryDTO with content field.
 */
export interface ContradictionEvent {
  /** New memory ID that triggered contradiction */
  newMemoryId: string;

  /** Conflicting existing memory ID */
  conflictingMemoryId: string;

  /** Similarity score */
  similarity: number;

  /** Whether temporal marker detected in NEW message text */
  hasTemporalMarker: boolean;

  /** Resolution mode applied */
  resolution: 'supersede' | 'parallel' | 'pending';

  /** Timestamps for both memories */
  newMemoryCreatedAt: number;
  conflictingMemoryCreatedAt: number;

  /** Memory types for domain context */
  newMemoryTypes: string[];
  conflictingMemoryTypes: string[];

  /** Conflict domain */
  conflictDomain: string;
}

/**
 * Supersession event payload
 */
export interface SupersessionEvent {
  /** ID of superseded memory */
  oldMemoryId: string;

  /** ID of new memory */
  newMemoryId: string;

  /** Timestamp of supersession */
  timestamp: number;
}

/**
 * Callback for contradiction detection events
 */
export type ContradictionCallback = (event: ContradictionEvent) => void;

/**
 * Callback for supersession events
 */
export type SupersessionCallback = (event: SupersessionEvent) => void;

/**
 * Unsubscribe function returned by event subscriptions
 */
export type Unsubscribe = () => void;
