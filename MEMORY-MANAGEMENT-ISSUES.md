# Memory Management Issues Analysis

> NOTE (2026-02-26): This document is historical and partially outdated.
> Current validated behavior and improvement plan are in
> `MEMORY-QUALITY-FINDINGS-2026-02-26.md`.

**Date:** 2026-02-26
**Priority:** HIGH
**Status:** Analysis Complete

---

## Issues Identified

### 1. **Over-Conservative Extraction (13.3% rate)**

**Problem:** Only 2 out of 15 legitimate facts are being extracted.

**Root Cause:**
- Extraction threshold too high (0.55)
- Entity weights favor names/places over preferences/dates
- Many valuable facts rejected (preferences, dates, contact info, relational facts)

**Examples of incorrectly rejected:**
- "I love drinking coffee in the morning" (clear preference)
- "My favorite color is blue" (clear preference)
- "I have two cats named Fluffy and Whiskers" (relational fact)
- "My birthday is on March 15th" (temporal fact)
- "My email address is john.doe@example.com" (contact info)

**Impact:** Users can't store important personal information, making the memory system unreliable.

**Fix:** See MEMORY-QUALITY-ANALYSIS.md recommendations 1-5

---

### 2. **Default Context Window Too Small (4096 tokens)**

**Problem:** Default contextWindow of 4096 tokens is appropriate for GPT-3.5 but severely limits memory injection for modern LLMs.

**Evidence:**
```typescript
// src/api/Augmenter.ts line 47
if (this.config.contextWindowTokens === undefined) {
  this.config.contextWindowTokens = 4096;
}
```

**Impact:**
- With 4096 context window, 1024 reserved for response, 500 tokens for messages
- Only ~2500 tokens available for memory injection
- With ~50 tokens per memory, only ~50 memories can be injected
- If user has 100+ memories, most will be excluded

**Modern LLM Context Windows:**
- GPT-4: 8192 tokens
- GPT-4 Turbo: 128,000 tokens
- Claude 3: 200,000 tokens
- GPT-3.5: 4096 tokens (smallest)

**Fix:** Increase default to 8192 tokens (covers GPT-4 and better than GPT-3.5)

---

### 3. **Inconsistent Reserved Token Defaults**

**Problem:** Two different default values for `reservedForResponseTokens`

**Evidence:**
```typescript
// src/core/TokenBudget.ts line 29
reservedForResponseTokens = 1024,

// src/api/Augmenter.ts line 80
this.config.reservedForResponseTokens ?? 512;
```

**Impact:** Confusing behavior, unpredictable token budget calculation

**Fix:** Standardize on 1024 tokens (more conservative, safer)

---

### 4. **Misleading Debug Output**

**Problem:** All excluded memories marked as "token_budget" regardless of actual reason

**Evidence:**
```typescript
// src/api/Augmenter.ts line 309
reason: (c.reason ?? 'token_budget') as
  | 'low_relevance'
  | 'floor_threshold'
  | 'token_budget',
```

**Root Cause:**
- `allCandidates` created without reason field (line 150-158)
- No tracking of WHY memories were excluded
- Default to 'token_budget' makes it appear that token budget is the only issue

**Impact:**
- Users see "token_budget" exclusions everywhere
- Can't distinguish between relevance issues vs. budget issues
- Misleading debugging information

**Fix:** Track actual exclusion reasons in `getInjectionPreview()`

---

### 5. **No Warning for Small Context Windows**

**Problem:** System silently uses small context window without warning users

**Evidence:**
- Demo app uses default 4096 tokens
- No warning when context is too small for available memories
- Users don't know they're missing important context

**Impact:** Poor user experience, confusion about why memories aren't being used

**Fix:** Add warning when available tokens < estimated memory needs

---

## Impact Assessment

### User Experience Issues

1. **Unreliable Storage:** 86.7% of legitimate facts rejected
2. **Limited Retrieval:** Only ~50 memories can be injected with default config
3. **Confusing Debug:** All exclusions show "token_budget" regardless of cause
4. **No Feedback:** Silent failures, no warnings about configuration issues

### System Reliability Issues

1. **Inconsistent Behavior:** Different defaults in different parts of code
2. **Poor Scalability:** Can't handle users with 100+ memories
3. **Misleading Metrics:** Debug output doesn't reflect reality
4. **Configuration Burden:** Users must manually configure context window

---

## Fix Priority

### HIGH PRIORITY (Immediate)

1. **Lower extraction threshold** (0.55 → 0.45-0.50)
   - File: `src/core/LokulMem.ts` line 56
   - Impact: 3-4x more memories extracted

2. **Increase default context window** (4096 → 8192)
   - File: `src/api/Augmenter.ts` line 47
   - Impact: 2x more memories can be injected

3. **Standardize reserved tokens** (512/1024 → 1024)
   - Files: `src/api/Augmenter.ts` line 80, `src/core/TokenBudget.ts` line 29
   - Impact: Consistent behavior

### MEDIUM PRIORITY (Soon)

4. **Fix debug exclusion reasons**
   - File: `src/api/Augmenter.ts` lines 150-313
   - Track actual reasons in getInjectionPreview()
   - Impact: Accurate debugging

5. **Adjust entity weights**
   - Increase preference weight: 0.25 → 0.30
   - Increase date weight: 0.2 → 0.25
   - Impact: More preferences/dates extracted

### LOW PRIORITY (Nice to Have)

6. **Add configuration warnings**
   - Warn when context window too small
   - Warn when many memories excluded
   - Impact: Better user feedback

7. **Add email pattern recognition**
   - Add email regex to SpecificityNER
   - Impact: Contact info extracted

---

## Recommended Immediate Actions

### Action 1: Lower Extraction Threshold

```typescript
// In src/core/LokulMem.ts line 56
extractionThreshold: 0.45, // Changed from 0.50
```

### Action 2: Increase Default Context Window

```typescript
// In src/api/Augmenter.ts line 47
if (this.config.contextWindowTokens === undefined) {
  this.config.contextWindowTokens = 8192; // Changed from 4096
}
```

### Action 3: Standardize Reserved Tokens

```typescript
// In src/api/Augmenter.ts line 80
const reservedForResponseTokens =
  options.reservedForResponseTokens ??
  this.config.reservedForResponseTokens ??
  1024; // Changed from 512
```

---

## Expected Results After Fixes

### Extraction Rate
- **Before:** 13.3% (2/15 messages)
- **After:** ~40-50% (6-8/15 messages)

### Memory Injection Capacity
- **Before:** ~50 memories (4096 context)
- **After:** ~100 memories (8192 context)

### Debug Accuracy
- **Before:** All exclusions marked "token_budget"
- **After:** Accurate exclusion reasons (relevance, threshold, budget)

---

## Testing Plan

1. Apply extraction threshold fix
2. Apply context window fix
3. Apply reserved tokens fix
4. Re-test with 15-message dataset
5. Verify improved extraction rate
6. Verify more memories injected
7. Verify accurate debug output

---

## Conclusion

The memory management system has **multiple compounding issues**:

1. **Over-conservative extraction** (13.3% rate)
2. **Insufficient context window** (4096 tokens)
3. **Inconsistent defaults** (512 vs 1024 reserved)
4. **Misleading debug output** (all "token_budget")

**These issues combine to create a system that:**
- Stores too few memories
- Injects too few memories
- Provides misleading feedback

**The fixes are straightforward and low-risk:**
- Adjust thresholds and defaults
- Fix debug tracking
- No architectural changes needed

**Expected improvement:**
- 3-4x more memories extracted
- 2x more memories injected
- Accurate debugging information
