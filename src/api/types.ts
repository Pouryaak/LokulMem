/**
 * Augment API types for LokulMem
 *
 * Provides types for the augment() API which retrieves relevant memories
 * and injects them into LLM context.
 */

import type { MemoryDTO } from '../types/memory.js';

/**
 * ChatMessage - Message in a conversation
 *
 * Used for augment() history parameter and return value.
 */
export interface ChatMessage {
  /** Message role: system, user, or assistant */
  role: 'system' | 'user' | 'assistant';

  /** Message content */
  content: string;

  /** Optional timestamp (used by learn(), not by augment) */
  timestamp?: number;
}

/**
 * AugmentOptions - Configuration options for augment()
 *
 * Controls memory retrieval, token budgeting, and debug output.
 */
export interface AugmentOptions {
  /**
   * LLM context window size in tokens
   *
   * NO default - user must specify this for accurate token budgeting.
   * Can be set globally in LokulMem config or per-call.
   *
   * @example 8192 for Claude 3, 128000 for GPT-4
   */
  contextWindowTokens?: number;

  /**
   * Tokens to reserve for LLM response
   *
   * @default 512
   */
  reservedForResponseTokens?: number;

  /**
   * Override max tokens directly (bypasses budget calculation)
   *
   * If set, skips contextWindowTokens calculation and uses this value
   * as the maximum tokens for memory injection.
   */
  maxTokens?: number;

  /**
   * Enable debug mode
   *
   * Debug object is LAZY-COMPUTED - only when debug=true.
   * Default: false (must be explicitly enabled for performance).
   *
   * @default false
   */
  debug?: boolean;
}

/**
 * AugmentResult - Result of augment() operation
 *
 * Returns LLM-ready messages with injected memories and metadata.
 */
export interface AugmentResult {
  /**
   * LLM-ready messages array with injected memories
   *
   * If memories were found, first message is a system message with
   * memory block prepended. Otherwise, returns original messages.
   */
  messages: ChatMessage[];

  /**
   * Metadata about the memory injection
   */
  metadata: {
    /** Number of memories injected */
    injectedCount: number;

    /**
     * Flag: no relevant memories found
     *
     * true if search returned no results or all memories were below
     * the relevance threshold.
     */
    noMemoriesFound: boolean;

    /**
     * Tokens used before injection
     *
     * Sum of system prompt + history + user message tokens.
     */
    usedTokensBeforeInjection: number;

    /**
     * Tokens used for injected memories
     *
     * Estimated tokens for the memory block that was injected.
     */
    injectionTokens: number;

    /**
     * Remaining tokens after injection
     *
     * Budget remaining after injecting memories (before LLM response).
     */
    remainingTokensAfterInjection: number;
  };

  /**
   * Debug object (only if options.debug = true)
   *
   * Undefined when debug=false (lazy computation for performance).
   */
  debug?: LokulMemDebug;
}

/**
 * LokulMemDebug - Debug information for augment()
 *
 * Provides detailed information about memory retrieval, scoring,
 * token usage, and performance. Only computed when debug=true.
 */
export interface LokulMemDebug {
  /**
   * Memories that were injected
   *
   * Full MemoryDTO objects with all metadata.
   */
  injectedMemories: MemoryDTO[];

  /**
   * Relevance scores with breakdowns
   *
   * Shows the composite score and individual components for each
   * injected memory.
   */
  scores: Array<{
    /** Memory ID */
    memoryId: string;

    /** Final composite relevance score (0-1) */
    relevance: number;

    /** Individual score components */
    breakdown: {
      /** Semantic similarity component */
      semantic: number;

      /** Recency decay component */
      recency: number;

      /** Memory strength component */
      strength: number;

      /** Session continuity component */
      continuity: number;
    };
  }>;

  /**
   * Candidates excluded and why
   *
   * Memories that were considered but excluded from injection,
   * with the reason for exclusion.
   */
  excludedCandidates: Array<{
    /** Memory ID */
    memoryId: string;

    /** Reason for exclusion */
    reason: 'low_relevance' | 'floor_threshold' | 'token_budget';
  }>;

  /**
   * Token usage breakdown
   *
   * Detailed token accounting for the entire operation.
   */
  tokenUsage: {
    /** Tokens used for prompt (messages + injected memories) */
    prompt: number;

    /** Tokens reserved for LLM completion */
    completion: number;

    /** Total tokens (prompt + completion) */
    total: number;
  };

  /**
   * Latency in milliseconds
   *
   * Total time for the augment() operation from start to finish.
   */
  latencyMs: number;
}
