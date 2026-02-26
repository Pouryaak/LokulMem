/**
 * TokenBudget - Shared token budget calculation for memory injection
 *
 * Provides messages-based token accounting for accurate context window awareness.
 * Used by both getInjectionPreview() and augment() for consistent behavior.
 */

import type {
  ChatMessage,
  TokenBudgetConfig,
  TokenBudgetResult,
} from '../search/types.js';

/**
 * Compute token budget for memory injection based on full message list
 *
 * This accounts for:
 * - System prompt + conversation history + user message (not just primitive)
 * - Message overhead (role delimiters, formatting)
 * - Reserved space for LLM response
 *
 * @param messages - Full message list (system + history + user)
 * @param config - Token budget configuration
 * @returns Token budget calculation result
 */
export function computeTokenBudget(
  messages: ChatMessage[],
  config: TokenBudgetConfig = {},
): TokenBudgetResult {
  const {
    contextWindowTokens,
    reservedForResponseTokens = 1024,
    tokenOverheadPerMessage = 4,
    tokenCounter,
  } = config;

  // Use custom token counter if provided, otherwise default ~4 chars/token
  const countTokens =
    tokenCounter ?? ((text: string) => Math.ceil(text.length / 4));

  // Calculate used tokens: sum of message content + overhead per message
  const messageContentTokens = messages.reduce(
    (sum, msg) => sum + countTokens(msg.content),
    0,
  );
  const messageOverheadTokens = messages.length * tokenOverheadPerMessage;
  const usedTokens = messageContentTokens + messageOverheadTokens;

  // Calculate available budget
  // If contextWindow not provided, behave like today (use maxTokens override or safe default)
  const contextWindow = contextWindowTokens ?? 0;

  // Calculate remaining: context - used - reserved
  // If no context window, return 0 (caller must use maxTokens override)
  const remainingTokens = Math.max(
    0,
    contextWindow - usedTokens - reservedForResponseTokens,
  );

  return {
    availableTokens: remainingTokens,
    usedTokens,
    remainingTokens,
  };
}

/**
 * Estimate tokens for text (default ~4 chars/token)
 *
 * @param text - Text to estimate tokens for
 * @param tokenCounter - Optional custom token counter
 * @returns Estimated token count
 */
export function estimateTokens(
  text: string,
  tokenCounter?: (text: string) => number,
): number {
  const counter = tokenCounter ?? ((t: string) => Math.ceil(t.length / 4));
  return counter(text);
}
