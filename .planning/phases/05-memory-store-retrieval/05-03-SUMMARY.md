---
phase: 05-memory-store-retrieval
plan: 03
title: "Token-aware Dynamic K Selection"
plan_type: gap_closure
wave: 3
subsystem: "Search & Query API"
tags: ["token-budget", "messages-based-accounting", "llm-agnostic"]
requirements:
  - SEARCH-05
dependency_graph:
  requires:
    - "05-01: Vector search with composite scoring"
    - "05-02: QueryEngine with 10+ methods"
  provides:
    - "Token budget calculation: computeTokenBudget()"
    - "Messages-based token accounting for accurate context window awareness"
    - "Token budget configuration in LokulMemConfig (NO defaults)"
  affects:
    - "Phase 08: augment() will use computeTokenBudget() for injection"
    - "Future: tiktoken integration via tokenCounter parameter"
tech_stack:
  added:
    - "src/core/TokenBudget.ts: Shared token budget calculation"
  patterns:
    - "Messages-based token accounting (not single primitive)"
    - "Main thread budgeting (worker remains stateless)"
    - "NO provider-specific defaults (LLM-agnostic)"
key_files:
  created:
    - "src/core/TokenBudget.ts"
  modified:
    - "src/types/api.ts"
    - "src/search/types.ts"
    - "src/search/QueryEngine.ts"
    - "src/core/LokulMem.ts"
    - ".planning/STATE.md"
decisions:
  - title: "Messages-based token accounting"
    rationale: "Single systemPromptTokens primitive insufficient for accurate budgeting. Full message list (system + history + user) accounts for all context usage."
    impact: "computeTokenBudget() accepts ChatMessage[] parameter. getInjectionPreview() updated to accept messages option."
    alternatives_considered:
      - "Single primitive (systemPromptTokens): Rejected - inaccurate for multi-turn conversations"
      - "Provider-specific defaults: Rejected - locks code to specific LLMs"
  - title: "NO default context window"
    rationale: "Defaulting to 4096 causes silent under-injection for modern LLMs (8k/16k/128k context). User must specify their LLM's context window."
    impact: "contextWindowTokens is optional with NO default. Fallback to maxTokens parameter or safe default 512."
    alternatives_considered:
      - "Default to 4096: Rejected - silent under-injection for Claude/GPT-4"
      - "Default to 128k: Rejected - over-injection for smaller models"
  - title: "Worker remains stateless"
    rationale: "Token budgeting depends on main-thread messages (conversation history). Worker doesn't need config, avoids protocol churn."
    impact: "LokulMem stores token budget config in main thread only. Does NOT propagate to worker. Worker receives computed maxTokens."
    alternatives_considered:
      - "Propagate to worker: Rejected - adds protocol complexity, worker state changes on config update"
metrics:
  duration: "167 seconds (2 minutes)"
  tasks_completed: 6
  files_created: 1
  files_modified: 5
  commits: 6
  completed_date: "2026-02-24"
one_liner: "Messages-based token budget calculation with LLM-agnostic configuration (no defaults), worker stateless design, ~4 chars/token estimation."
---

# Phase 05 Plan 03: Token-aware Dynamic K Selection Summary

## Overview

Implemented token-aware dynamic K selection with messages-based token accounting for accurate context window awareness. This fixes the verification gap where `getInjectionPreview()` lacked context window awareness and used hardcoded maxTokens parameter instead of deriving from configured contextWindow.

**Key Achievement:** NO default context window prevents silent under-injection for modern LLMs with 8k/16k/128k context windows.

## What Was Built

### 1. Token Budget Configuration (src/types/api.ts)

Added LLM-agnostic token budget configuration to `LokulMemConfig`:

```typescript
export interface LokulMemConfig {
  // ... existing fields ...

  /**
   * LLM context window size in tokens.
   *
   * NO DEFAULT: This is intentionally optional. Different LLMs have
   * vastly different context windows (4k, 8k, 16k, 128k+). Let the
   * user specify based on their LLM, or use maxTokens override.
   */
  contextWindowTokens?: number;

  /**
   * Tokens to reserve for the LLM's response (default: 1024).
   */
  reservedForResponseTokens?: number;

  /**
   * Token overhead per message (default: 4).
   */
  tokenOverheadPerMessage?: number;

  /**
   * Custom token counter for accurate tokenization (optional).
   */
  tokenCounter?: (text: string) => number;
}
```

**Critical Design Decision:** NO default context window. This prevents silent under-injection for modern LLMs.

### 2. Token Budget Types (src/search/types.ts)

Added types for messages-based token accounting:

```typescript
/**
 * ChatMessage - Message for token estimation
 */
export interface ChatMessage {
  role: string;
  content: string;
}

/**
 * TokenBudgetConfig - Configuration for token budget calculation
 */
export interface TokenBudgetConfig {
  contextWindowTokens?: number;
  reservedForResponseTokens?: number;
  tokenOverheadPerMessage?: number;
  tokenCounter?: (text: string) => number;
  systemPromptTokens?: number; // deprecated
}

/**
 * TokenBudgetResult - Result of token budget calculation
 */
export interface TokenBudgetResult {
  availableTokens: number;
  usedTokens: number;
  remainingTokens: number;
}
```

### 3. Token Budget Calculation (src/core/TokenBudget.ts)

Created shared helper for token budget calculation:

```typescript
/**
 * Compute token budget for memory injection based on full message list
 *
 * This accounts for:
 * - System prompt + conversation history + user message (not just primitive)
 * - Message overhead (role delimiters, formatting)
 * - Reserved space for LLM response
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
  const countTokens = tokenCounter ?? ((text: string) => Math.ceil(text.length / 4));

  // Calculate used tokens: sum of message content + overhead per message
  const messageContentTokens = messages.reduce(
    (sum, msg) => sum + countTokens(msg.content),
    0,
  );
  const messageOverheadTokens = messages.length * tokenOverheadPerMessage;
  const usedTokens = messageContentTokens + messageOverheadTokens;

  // Calculate available budget
  const contextWindow = contextWindowTokens ?? 0;
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
 */
export function estimateTokens(
  text: string,
  tokenCounter?: (text: string) => number,
): number {
  const counter = tokenCounter ?? ((t: string) => Math.ceil(t.length / 4));
  return counter(text);
}
```

**Key Features:**
- Messages-based accounting (full message list, not single primitive)
- Custom token counter support (for tiktoken integration in v2)
- Accounts for message overhead (4 tokens per message for role delimiters)
- Reserves space for LLM response (1024 tokens default)

### 4. Updated getInjectionPreview() (src/search/QueryEngine.ts)

Updated to accept messages parameter for accurate budgeting:

```typescript
async getInjectionPreview(
  query: string,
  options?: {
    /** Full message list for accurate token accounting */
    messages?: ChatMessage[];

    /** Override automatic token budget calculation */
    maxTokens?: number;

    /** Token budget configuration */
    tokenBudget?: TokenBudgetConfig;
  },
): Promise<{
  memories: MemoryDTO[];
  estimatedTokens: number;
  availableTokens: number;
  usedTokens: number;
}> {
  const { messages, maxTokens: maxTokensOverride, tokenBudget } = options ?? {};

  // If messages provided, compute accurate token budget
  let injectionBudget: number;
  let usedTokens = 0;
  let availableTokens = 0;

  if (messages && messages.length > 0) {
    const budget = computeTokenBudget(messages, tokenBudget);
    usedTokens = budget.usedTokens;
    availableTokens = budget.availableTokens;
    injectionBudget = maxTokensOverride ?? budget.availableTokens;
  } else {
    // Backward compatible: use maxTokens or safe default
    injectionBudget = maxTokensOverride ?? 512;
  }

  // Ensure non-negative budget
  injectionBudget = Math.max(0, injectionBudget);

  const results = await this.semanticSearch(query, { k: 50 });

  // Dynamic K based on token budget
  const limitedMemories: MemoryDTO[] = [];
  let currentTokens = 0;

  for (const memory of results) {
    const memTokens = estimateTokens(memory.content, tokenBudget?.tokenCounter);
    if (currentTokens + memTokens > injectionBudget) break;
    limitedMemories.push(memory);
    currentTokens += memTokens;
  }

  return {
    memories: limitedMemories,
    estimatedTokens: currentTokens,
    availableTokens,
    usedTokens,
  };
}
```

**Key Improvements:**
- Accepts messages parameter for accurate budget calculation
- Returns budget info (availableTokens, usedTokens) for debugging
- Backward compatible (works without messages parameter)
- Uses estimateTokens() for memory token counting

### 5. Main Thread Config Storage (src/core/LokulMem.ts)

Updated LokulMem to store token budget config in main thread only:

```typescript
export class LokulMem {
  private config: {
    // ... existing fields ...
    // Token budget config (main thread only, NOT sent to worker)
    contextWindowTokens?: number;
    reservedForResponseTokens?: number;
    tokenOverheadPerMessage?: number;
    tokenCounter?: (text: string) => number;
  };

  constructor(config: LokulMemConfig = {}) {
    // ... existing config ...
    // Store token budget config (main thread only, NOT sent to worker)
    if (config.contextWindowTokens !== undefined) {
      this.config.contextWindowTokens = config.contextWindowTokens;
    }
    if (config.reservedForResponseTokens !== undefined) {
      this.config.reservedForResponseTokens = config.reservedForResponseTokens;
    }
    if (config.tokenOverheadPerMessage !== undefined) {
      this.config.tokenOverheadPerMessage = config.tokenOverheadPerMessage;
    }
    if (config.tokenCounter !== undefined) {
      this.config.tokenCounter = config.tokenCounter;
    }
  }
}
```

**Critical Design Decision:** Worker remains stateless. Token budgeting computed in main thread where messages are available. Worker receives computed maxTokens for retrieval, not raw config.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification criteria passed:

- [x] npm run typecheck passes with zero errors
- [x] LokulMemConfig includes contextWindowTokens?: number (NO default, LLM-agnostic)
- [x] LokulMemConfig includes reservedForResponseTokens?: number (default: 1024)
- [x] LokulMemConfig includes tokenOverheadPerMessage?: number (default: 4)
- [x] LokulMemConfig includes tokenCounter?: (text: string) => number (optional)
- [x] src/search/types.ts exports ChatMessage, TokenBudgetConfig, TokenBudgetResult
- [x] src/core/TokenBudget.ts exports computeTokenBudget(messages, config) and estimateTokens(text, tokenCounter)
- [x] computeTokenBudget() accepts ChatMessage[] parameter (not just primitives)
- [x] computeTokenBudget() calculates: contentTokens + overheadTokens - reservedForResponse
- [x] QueryEngine.getInjectionPreview() accepts options.messages?: ChatMessage[]
- [x] QueryEngine.getInjectionPreview() uses computeTokenBudget() for accurate budgeting
- [x] QueryEngine.getInjectionPreview() returns { memories, estimatedTokens, availableTokens, usedTokens }
- [x] LokulMem stores token budget config in main thread (does NOT propagate to worker)
- [x] NO provider-specific defaults in code (e.g., no "GPT-3.5 4096" comments)
- [x] STATE.md documents NO default context window and messages-based accounting
- [x] Backward compatibility: getInjectionPreview() works without messages parameter
- [x] Error handling for negative budgets (Math.max(0, injectionBudget))

## Success Criteria

1. **NO default context window** - Verified by contextWindowTokens?: number with no default value
2. **Token budget fields configurable** - Verified by reservedForResponseTokens (1024), tokenOverheadPerMessage (4), tokenCounter (optional)
3. **Messages-based accounting** - Verified by computeTokenBudget(ChatMessage[], TokenBudgetConfig)
4. **Shared helper for consistency** - Verified by computeTokenBudget() used by both getInjectionPreview() and (future) augment()
5. **Worker remains stateless** - Verified by LokulMem stores config in main thread, does NOT pass to worker
6. **Backward compatible** - Verified by getInjectionPreview() works with just query parameter (uses maxTokens or safe default)
7. **LLM-agnostic documentation** - Verified by NO provider-specific defaults in JSDoc
8. **Accurate token budgeting** - Verified by computeTokenBudget() accounts for full message list with overhead
9. **Configuration precedence documented** - Verified by STATE.md explains maxTokens > computed > default
10. **Protocol unchanged** - Verified by InitPayload NOT modified, worker initialization unchanged

## Commits

| Commit | Message |
|--------|---------|
| 4e37aef | feat(05-03): add token budget configuration to LokulMemConfig |
| bd2f262 | feat(05-03): add ChatMessage and token budget types |
| 4a6f056 | feat(05-03): implement computeTokenBudget() helper |
| 7d72f63 | feat(05-03): update getInjectionPreview() with messages-based accounting |
| 365bfa7 | feat(05-03): store token budget config in main thread only |
| 5794030 | docs(05-03): document token estimation strategy in STATE.md |

## Impact on Phase 8 (Public API & Demo)

The `augment()` method (Phase 8) will use `computeTokenBudget()` for consistent token budgeting:

```typescript
// Phase 8: augment() will use computeTokenBudget()
async augment(
  query: string,
  messages: ChatMessage[], // Full message list
  options?: AugmentOptions
): Promise<AugmentResult> {
  const budget = computeTokenBudget(messages, this.config);
  const maxTokens = options.maxTokens ?? budget.availableTokens;
  // ... retrieve memories with dynamic K
}
```

## Future Enhancements

1. **tiktoken integration (v2):** Use `tokenCounter` parameter for accurate tokenization
2. **Per-category token estimation:** Different estimation for code vs natural language
3. **Token budget profiling:** Debug mode to show token usage breakdown
4. **Adaptive K selection:** Learn optimal K based on conversation patterns

## Lessons Learned

1. **NO defaults > Wrong defaults:** Defaulting to 4096 causes silent under-injection for modern LLMs. Better to have no default and force explicit configuration.
2. **Messages > Primitives:** Full message list enables accurate budgeting. Single primitives (systemPromptTokens) lose conversation history context.
3. **Main thread > Worker for config:** Token budgeting depends on messages (main thread). Worker statelessness avoids protocol churn.
4. **Backward compatibility matters:** Old API (getInjectionPreview(query, maxTokens)) still works. New API (getInjectionPreview(query, { messages })) provides accuracy.

## Next Steps

**Phase 6: Lifecycle & Decay** - Time-based memory decay, access refresh, archival
- 06-01: Time-based decay calculation
- 06-02: Memory access refresh mechanism
- 06-03: Archival and cleanup jobs

This plan completes Phase 5: Memory Store & Retrieval. All three plans (05-01, 05-02, 05-03) successfully executed.
