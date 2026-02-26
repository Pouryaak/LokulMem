/**
 * API types for LokulMem public interface
 */

import type { ContradictionEvent } from '../types/events.js';
import type { MemoryDTO } from '../types/memory.js';

/**
 * Chat message representation for augment/learn operations
 */
export interface ChatMessage {
  /** Message role */
  role: 'user' | 'assistant' | 'system';

  /** Message content */
  content: string;

  /** Optional timestamp (Unix ms) */
  timestamp?: number;
}

/**
 * Options for learn() operation
 */
export interface LearnOptions {
  /** Conversation ID for tracking (auto-generated if not provided) */
  conversationId?: string;

  /** Which messages to extract from (default: 'both') */
  extractFrom?: 'user' | 'assistant' | 'both';

  /** Run maintenance sweep after extraction (default: false) */
  runMaintenance?: boolean;

  /** Override extraction threshold (default: 0.55) */
  learnThreshold?: number;

  /** Auto-associate with previous augment() results (default: false) */
  autoAssociate?: boolean;

  /** Store assistant response in episode (default: false) */
  storeResponse?: boolean;

  /** Return full memory details (default: false - IDs only) */
  verbose?: boolean;
}

/**
 * Result from learn() operation
 */
export interface LearnResult {
  /** Memories extracted from conversation */
  extracted: MemoryDTO[];

  /** Contradictions detected and resolved */
  contradictions: ContradictionEvent[];

  /** Maintenance sweep results (if runMaintenance=true) */
  maintenance: {
    faded: number;
    deleted: number;
  };

  /** Conversation ID (provided or auto-generated) */
  conversationId: string;
}

/**
 * Options for augment() operation
 */
export interface AugmentOptions {
  /** Maximum number of memories to inject (default: 10) */
  maxMemories?: number;

  /** Minimum relevance threshold (default: 0.6) */
  minScore?: number;

  /** Token budget for memory injection (default: from config) */
  contextWindowTokens?: number;

  /** Reserved tokens for response (default: from config) */
  reservedForResponseTokens?: number;

  /** Whether to include debug information (default: false) */
  debug?: boolean;

  /** Session memory IDs for continuity scoring */
  sessionMemoryIds?: Set<string>;
}

/**
 * Result from augment() operation
 */
export interface AugmentResult {
  /** Augmented messages array ready for LLM */
  messages: ChatMessage[];

  /** Metadata about the augmentation */
  metadata: {
    /** Number of memories injected */
    injectedCount: number;

    /** Total tokens used for memory injection */
    injectionTokens: number;

    /** Remaining tokens after injection */
    remainingTokens: number;

    /** Whether any relevant memories were found */
    foundMemories: boolean;

    /** Debug information (if debug=true) */
    debug?: LokulMemDebug;
  };
}

/**
 * Debug information for augment/learn operations
 */
export interface LokulMemDebug {
  /** All retrieved memories with scores */
  retrieved: Array<{
    memory: MemoryDTO;
    score: number;
    reason?: string;
  }>;

  /** Memories excluded from injection */
  excluded: Array<{
    memory: MemoryDTO;
    reason: string;
  }>;

  /** Token usage breakdown */
  tokens: {
    usedBeforeInjection: number;
    injectionCost: number;
    remainingAfterInjection: number;
  };

  /** Timing information (ms) */
  timing: {
    search: number;
    scoring: number;
    injection: number;
    total: number;
  };
}
