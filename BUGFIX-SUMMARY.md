# Bug Fix Summary: Assistant Messages Being Extracted

**Date:** 2026-02-26
**Bug:** AI assistant messages were being extracted and stored as memories
**Status:** ✅ FIXED

## Problem

When users called `lokul.learn()` without specifying the `extractFrom` option, both user messages AND assistant responses were being extracted and stored as memories. This was incorrect because:

1. Assistant responses are typically NOT information sources
2. The default behavior should extract only from user messages
3. This caused noise in the memory store (e.g., "I received your message..." stored as a memory)

## Root Cause

**File:** `src/core/LokulMem.ts`, line 462

```typescript
// BEFORE (BUGGY):
extractFrom: options.extractFrom ?? 'both',  // ❌ Wrong default
```

When `options.extractFrom` was `undefined`, the code incorrectly defaulted to `'both'` instead of letting the `Learner` class use its own default of `'user'`.

## The Fix

```typescript
// AFTER (FIXED):
extractFrom: options.extractFrom,  // ✅ Let Learner class handle its own default of 'user'
```

The fix removes the incorrect default override, allowing the `Learner` class (line 89) to use its intended default:

```typescript
// In src/api/Learner.ts line 89
extractFrom = 'user', // Default to user messages only (assistant responses are usually not information sources)
```

## Testing

### Before Fix
- User message: "My name is Alice and I live in New York"
- Assistant response: "I received your message..."
- **Result:** 2 memories extracted (including the assistant response) ❌

### After Fix
- User message: "My name is David and I live in Seattle"
- Assistant response: "I received your message..."
- **Result:** 1 memory extracted (user message only) ✅

## Verification

1. ✅ Built successfully with `npm run build`
2. ✅ All existing tests pass (36 tests)
3. ✅ Manual testing in React demo app confirms correct behavior
4. ✅ Only user messages are extracted by default
5. ✅ Assistant responses are no longer stored as memories

## Files Changed

- `src/core/LokulMem.ts` - Line 462 (removed incorrect default)

## Impact

- **Breaking Change:** No - this fixes incorrect behavior to match the documented intent
- **API Change:** No - the API signature remains the same
- **Behavior Change:** Yes - now only extracts from user messages by default (as intended)
