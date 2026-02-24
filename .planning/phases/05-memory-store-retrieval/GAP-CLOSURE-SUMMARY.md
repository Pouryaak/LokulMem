# Phase 5 Gap Closure: Token-aware Dynamic K

**Gap ID:** SEARCH-05
**Gap Closure Plan:** 05-03-PLAN.md
**Created:** 2026-02-24
**Status:** Ready for Execution

---

## Gap Summary

### What's Missing

The `getInjectionPreview()` method in `src/search/QueryEngine.ts` implements token estimation and budget limiting, but lacks **context window awareness**:

1. **No context window configuration** - `LokulMemConfig` lacks a `contextWindow` field to specify the LLM's context limit (e.g., 4096 for GPT-3.5, 8192 for GPT-4)
2. **Hardcoded maxTokens** - Method uses `maxTokens = 1000` parameter instead of deriving from actual context window
3. **No system prompt accounting** - Does not subtract system prompt tokens from available budget
4. **No user message accounting** - Does not estimate or subtract user message tokens from budget
5. **Not truly "token-aware"** - Cannot automatically adjust K based on remaining context window

### What Exists

- Token estimation: `Math.ceil(memory.content.length / 4)` (~4 chars/token)
- Budget limiting loop that stops when `currentTokens + memTokens > maxTokens`
- Dynamic K selection based on token budget
- Returns `estimatedTokens` count

### The Fix

Add context window configuration and calculate remaining tokens automatically:

```typescript
remainingTokens = contextWindow - systemPromptTokens - userMessageTokens
maxTokens = maxTokensOverride ?? Math.max(0, remainingTokens)
```

---

## Implementation Plan

### Task 1: Add Configuration Fields (src/types/api.ts)

Add to `LokulMemConfig`:
```typescript
/** LLM context window size in tokens (default: 4096 for GPT-3.5) */
contextWindow?: number;

/** Estimated token count for system prompt (default: 0) */
systemPromptTokens?: number;
```

Add to `AugmentOptions`:
```typescript
/** System prompt token count (overrides config) */
systemPromptTokens?: number;
```

### Task 2: Update Worker Protocol (src/ipc/protocol-types.ts)

Add to `InitPayload`:
```typescript
contextWindow?: number;
systemPromptTokens?: number;
```

### Task 3: Update QueryEngine (src/search/types.ts, src/search/QueryEngine.ts)

Add `QueryEngineConfig` interface:
```typescript
export interface QueryEngineConfig {
  contextWindow?: number;
  systemPromptTokens?: number;
}
```

Update `QueryEngine` constructor to accept config and store fields:
```typescript
private contextWindow: number;
private systemPromptTokens: number;
```

Add `estimateTokens()` helper:
```typescript
private estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  // TODO: Integrate tiktoken in v2 for accurate tokenization
  return Math.ceil(text.length / 4);
}
```

Update `getInjectionPreview()`:
```typescript
async getInjectionPreview(
  query: string,
  options?: {
    maxTokens?: number; // Override automatic calculation
    systemPromptTokens?: number; // Override config
    userMessage?: string; // For accurate token estimation
  }
): Promise<{
  memories: MemoryDTO[];
  estimatedTokens: number;
  remainingTokens: number; // New: tokens left after injection
}>
```

Calculate remaining tokens:
```typescript
const systemPromptTokens = options.systemPromptTokens ?? this.systemPromptTokens;
const userMessageTokens = options.userMessage
  ? this.estimateTokens(options.userMessage)
  : this.estimateTokens(query);
const remainingTokens = this.contextWindow - systemPromptTokens - userMessageTokens;
const maxTokens = options.maxTokens ?? Math.max(0, remainingTokens);
```

Return remaining tokens in result:
```typescript
return {
  memories: limitedMemories,
  estimatedTokens: currentTokens,
  remainingTokens: remainingTokens - currentTokens
};
```

### Task 4: Update LokulMem (src/core/LokulMem.ts)

Pass config to worker:
```typescript
const initPayload: InitPayload = {
  // ... existing fields ...
  contextWindow: contextWindow ?? 4096,
  systemPromptTokens: systemPromptTokens ?? 0
};
```

### Task 5: Document Strategy (.planning/STATE.md)

Add token estimation strategy documentation:
- Current: ~4 characters per token (rough estimate)
- Reasoning: Fast, no dependencies, works in browser
- Limitations: Inaccurate for code, numbers, non-English text
- Future (v2): Integrate tiktoken for accurate tokenization
- Context windows: GPT-3.5 (4096), GPT-4 (8192), Claude (100000+)

---

## Verification Checklist

After execution, verify:

- [ ] LokulMemConfig has `contextWindow?: number` (default: 4096)
- [ ] LokulMemConfig has `systemPromptTokens?: number` (default: 0)
- [ ] InitPayload includes context window fields
- [ ] QueryEngine stores `contextWindow` and `systemPromptTokens`
- [ ] `estimateTokens(text: string)` helper exists (~4 chars/token)
- [ ] `getInjectionPreview()` calculates `remainingTokens` correctly
- [ ] `getInjectionPreview()` returns `{ memories, estimatedTokens, remainingTokens }`
- [ ] Manual `maxTokens` override still works (backward compatibility)
- [ ] Config propagates: LokulMem → WorkerClient → Worker → QueryEngine
- [ ] JSDoc comments document token estimation and tiktoken v2 plan
- [ ] `npm run typecheck` passes with zero errors

---

## Usage Example

After implementation, users can configure context window:

```typescript
const lokulmem = new LokulMem({
  // For GPT-3.5 (default)
  contextWindow: 4096,

  // For GPT-4
  // contextWindow: 8192,

  // For Claude with large context
  // contextWindow: 100000,

  // If using custom system prompt
  systemPromptTokens: 500
});

// Automatic token budget calculation
const preview = await lokulmem.manage().getInjectionPreview(
  "What do you know about the user?",
  {
    userMessage: "Tell me about their preferences and history",
    // maxTokens: 1000 // Optional: override automatic calculation
  }
);

console.log(`Injected ${preview.memories.length} memories`);
console.log(`Estimated tokens: ${preview.estimatedTokens}`);
console.log(`Remaining tokens: ${preview.remainingTokens}`);
```

---

## Dependencies

- **Phase 4 Complete:** EmbeddingEngine must be initialized
- **Plan 05-01 Complete:** VectorSearch with composite scoring
- **Plan 05-02 Complete:** QueryEngine with getInjectionPreview()

---

## Risk Assessment

**Low Risk** - Gap closure is additive and backward compatible:

- New config fields are optional with sensible defaults
- Existing `maxTokens` parameter still works as override
- No breaking changes to public API
- Pure additive feature (context window awareness)

**Testing Considerations:**

- Verify default values (4096 context window, 0 system prompt tokens)
- Test manual override via `maxTokens` parameter
- Test system prompt tokens override via options
- Test user message token estimation accuracy
- Verify remaining tokens is never negative (Math.max(0, remainingTokens))
- Test with different context window sizes (4096, 8192, 100000+)

---

## Future Enhancements (v2)

- **Accurate tokenization:** Integrate tiktoken for precise token counts
- **Model-specific defaults:** Auto-detect context window from model name
- **System prompt detection:** Auto-estimate system prompt tokens
- **Token budget feedback:** Warn users when approaching context limit
- **Memory compression:** Summarize old memories to free token space

---

*Gap closure plan created: 2026-02-24*
*Ready for execution via /gsd:execute-phase*
