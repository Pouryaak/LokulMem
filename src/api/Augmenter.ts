/**
 * Augmenter - Memory retrieval and injection for LLM context
 *
 * Implements the augment() API which retrieves relevant memories
 * and injects them into chat messages for LLM context.
 */

import { computeTokenBudget } from '../core/TokenBudget.js';
import type { QueryEngine } from '../search/QueryEngine.js';
import type { TokenBudgetResult } from '../search/types.js';
import type { MemoryDTO } from '../types/memory.js';
import type { EventManager } from './EventManager.js';
import type {
  AugmentOptions,
  AugmentResult,
  ChatMessage,
  LokulMemDebug,
} from './types.js';

/**
 * Augmenter class for memory augmentation
 *
 * Handles token budget computation, memory retrieval, formatting,
 * and injection into message arrays.
 */
export class Augmenter {
  /**
   * Create a new Augmenter instance
   * @param queryEngine - Query engine for semantic search
   * @param _eventManager - Event manager for future reinforcement writes (not used during augment)
   * @param config - Augmenter configuration
   */
  constructor(
    private queryEngine: QueryEngine,
    _eventManager: EventManager, // Not stored - reserved for future use
    private config: {
      /** Custom token counter function */
      tokenCounter?: (text: string) => number;
      /** Default context window size (can be overridden per-call) */
      contextWindowTokens?: number;
      /** Default tokens to reserve for response */
      reservedForResponseTokens?: number;
    } = {},
  ) {
    // Set default context window if not provided
    // 8192 is a reasonable default that works well for GPT-4 and most modern LLMs
    if (this.config.contextWindowTokens === undefined) {
      this.config.contextWindowTokens = 8192;
    }
    // Note: Augmenter does NOT emit events during augment()
    // Events are emitted at point of mutation (reinforcement writes from Phase 6)
    // This eventManager reference is for future use
  }

  /**
   * Augment user message with relevant memories
   *
   * @param userMessage - Current user message
   * @param history - Conversation history (optional)
   * @param options - Augment options
   * @returns Augmented messages with metadata
   */
  async augment(
    userMessage: string,
    history: ChatMessage[] = [],
    options: AugmentOptions = {},
  ): Promise<AugmentResult> {
    const startTime = performance.now();

    // Step 1: Build messages array
    const messages: ChatMessage[] = [
      ...history,
      { role: 'user' as const, content: userMessage },
    ];

    // Step 2: Compute token budget
    const reservedForResponseTokens =
      options.reservedForResponseTokens ??
      this.config.reservedForResponseTokens ??
      1024;

    const budgetConfig: {
      contextWindowTokens?: number;
      reservedForResponseTokens: number;
      tokenCounter?: (text: string) => number;
    } = {
      reservedForResponseTokens,
    };

    const contextWindow =
      options.contextWindowTokens ?? this.config.contextWindowTokens;
    if (contextWindow !== undefined) {
      budgetConfig.contextWindowTokens = contextWindow;
    }

    if (this.config.tokenCounter) {
      budgetConfig.tokenCounter = this.config.tokenCounter;
    }

    const budget = computeTokenBudget(messages, budgetConfig);

    // Step 3: Determine max tokens
    const effectiveMaxTokens = options.maxTokens ?? budget.availableTokens;

    // Step 4: Get injection preview for token-aware K
    const injectionPreview = await this.queryEngine.getInjectionPreview(
      userMessage,
      {
        messages,
        maxTokens: effectiveMaxTokens,
      },
    );

    // Step 5: Retrieve memories with composite scoring
    // Use getInjectionPreview's results which already account for token budget
    const searchResults = injectionPreview.memories;

    // Step 6: Format memory block
    const memoryBlock = this.formatMemories(searchResults);

    // Step 7: Inject as system message (prepend format)
    const augmentedMessages = this.injectSystemMessage(messages, memoryBlock);

    // Step 8: Compute metadata
    const injectionTokens = this.estimateTokens(memoryBlock);
    const metadata = {
      injectedCount: searchResults.length,
      noMemoriesFound: searchResults.length === 0,
      usedTokensBeforeInjection: budget.usedTokens,
      injectionTokens,
      remainingTokensAfterInjection: budget.availableTokens - injectionTokens,
    };

    const totalLatencyMs = performance.now() - startTime;

    // Step 9: Lazy debug computation
    let debugObj: LokulMemDebug | undefined;
    if (options.debug) {
      // For debug, we need full search results with scores
      // Query again with composite scoring to get score breakdowns
      const debugSearchResults = await this.queryEngine.semanticSearch(
        userMessage,
        {
          k: 50,
          useCompositeScoring: true,
        },
      );

      // Build injected set for quick lookup
      const injectedIds = new Set(searchResults.map((m) => m.id));

      // Track actual exclusion reasons:
      // - Memories in debug results but NOT in injected → excluded by token_budget
      //   (they passed relevance/threshold but didn't fit in the budget)
      // - Memories not in debug results at all would be low_relevance/floor_threshold
      //   (but we can only see what semanticSearch returned)
      const allCandidates: Array<{
        memory: MemoryDTO;
        score: number;
        reason?: string;
      }> = debugSearchResults.map((memory) => {
        const candidate: { memory: MemoryDTO; score: number; reason?: string } =
          {
            memory,
            score: 0,
          };
        if (!injectedIds.has(memory.id)) {
          candidate.reason = 'token_budget';
        }
        return candidate;
      });

      debugObj = await this.computeDebug(
        searchResults as Array<
          MemoryDTO & {
            scores?: import('../search/types.js').ScoreBreakdown;
          }
        >,
        budget,
        { injectionTokens },
        allCandidates,
        totalLatencyMs,
        reservedForResponseTokens,
      );
    }

    // Step 10: Return result
    const result: AugmentResult = {
      messages: augmentedMessages,
      metadata,
    };

    if (debugObj !== undefined) {
      result.debug = debugObj;
    }

    return result;
  }

  /**
   * Inject system message with memory block
   *
   * Prepends system message with memories to the messages array.
   * If first message is already system, merges content instead of duplicating.
   *
   * @param messages - Original messages array
   * @param memoryBlock - Formatted memory block to inject
   * @returns Messages array with system message prepended
   */
  private injectSystemMessage(
    messages: ChatMessage[],
    memoryBlock: string,
  ): ChatMessage[] {
    if (!memoryBlock) {
      return messages;
    }

    const firstMessage = messages[0];
    if (firstMessage?.role === 'system') {
      // Merge with existing system message (don't duplicate)
      return [
        {
          ...firstMessage,
          content: `${memoryBlock}\n\n${firstMessage.content}`,
        },
        ...messages.slice(1),
      ];
    }

    // Insert new system message at index 0
    return [{ role: 'system', content: memoryBlock }, ...messages];
  }

  /**
   * Format memories into summarized blocks
   *
   * Converts MemoryDTO array into structured text blocks for LLM context.
   *
   * @param memories - Memories to format
   * @returns Formatted memory block string
   */
  private formatMemories(memories: MemoryDTO[]): string {
    if (memories.length === 0) {
      return '';
    }

    const blocks = memories.map((m) => {
      const confidence =
        m.currentStrength >= 0.8
          ? 'high'
          : m.currentStrength >= 0.5
            ? 'medium'
            : 'low';
      const pinned = m.pinned ? ' (pinned)' : '';
      return `- ${m.content} (confidence: ${confidence}${pinned})`;
    });

    return `[Memory Context — what you know about this user]\n${blocks.join('\n')}\n[End Memory Context]`;
  }

  /**
   * Estimate tokens for text
   *
   * Rough estimation: ~4 characters per token.
   * Uses custom token counter if provided in config.
   *
   * @param text - Text to estimate tokens for
   * @returns Estimated token count
   */
  private estimateTokens(text: string): number {
    const counter =
      this.config.tokenCounter ?? ((t: string) => Math.ceil(t.length / 4));
    return counter(text);
  }

  /**
   * Compute debug object with full details
   *
   * LAZY COMPUTATION: Only called when options.debug === true.
   * Builds comprehensive debug information about the augmentation.
   *
   * @param searchResults - Memories that were injected
   * @param budget - Token budget calculation result
   * @param metadata - Augmentation metadata
   * @param allCandidates - All candidates considered (for excluded tracking)
   * @returns Complete debug object
   */
  private async computeDebug(
    searchResults: Array<
      MemoryDTO & {
        scores?: import('../search/types.js').ScoreBreakdown;
      }
    >,
    budget: TokenBudgetResult,
    metadata: { injectionTokens: number },
    allCandidates: Array<{
      memory: MemoryDTO;
      score: number;
      reason?: string;
    }>,
    totalLatencyMs: number,
    reservedForResponseTokens: number,
  ): Promise<LokulMemDebug> {
    // Note: QueryEngine.semanticSearch() returns MemoryDTO without scores attached
    // For debugging, we'll create minimal score information
    const injected = searchResults.map((m) => ({
      memoryId: m.id,
      relevance: m.scores?.total ?? 0.5,
      breakdown: {
        semantic: m.scores?.semantic ?? 0.5,
        recency: m.scores?.recency ?? 0.5,
        strength: m.scores?.strength ?? m.currentStrength,
        continuity: m.scores?.continuity ?? 0,
      },
    }));

    // Track excluded candidates with reasons
    const excludedCandidates = allCandidates
      .filter((c) => !searchResults.find((s) => s.id === c.memory.id))
      .map((c) => ({
        memoryId: c.memory.id,
        reason: (c.reason ?? 'token_budget') as
          | 'low_relevance'
          | 'floor_threshold'
          | 'token_budget',
      }));

    return {
      injectedMemories: searchResults,
      scores: injected,
      excludedCandidates,
      tokenUsage: {
        prompt: budget.usedTokens + metadata.injectionTokens,
        completion: reservedForResponseTokens,
        total:
          budget.usedTokens +
          metadata.injectionTokens +
          reservedForResponseTokens,
      },
      latencyMs: totalLatencyMs,
    };
  }
}
