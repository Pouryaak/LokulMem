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
 */
export interface ContradictionEvent {
  /** The memory being replaced/superseded */
  oldMemory: MemoryDTO;

  /** The new memory that contradicts it */
  newMemory: MemoryDTO;

  /** How the contradiction was resolved */
  resolution: string;
}

/**
 * Callback for contradiction detection events
 */
export type ContradictionCallback = (event: ContradictionEvent) => void;

/**
 * Unsubscribe function returned by event subscriptions
 */
export type Unsubscribe = () => void;
