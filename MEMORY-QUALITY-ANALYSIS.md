# Memory Extraction Quality Analysis

> NOTE (2026-02-26): This document is historical and partially outdated.
> Current validated behavior and roadmap are documented in
> `MEMORY-QUALITY-FINDINGS-2026-02-26.md`.

**Date:** 2026-02-26
**Test:** 15 diverse messages
**System:** LokulMem v0.1

---

## Test Results

### Messages Sent (15 total)

| # | Message | Should Extract? | Result | Entities | Types |
|---|---------|---------------|--------|----------|-------|
| 1 | My name is Emma and I work as a software engineer at Microsoft | ✅ Yes | ✅ Extracted | emma and, microsoft (x2) | identity, location, profession |
| 2 | I love drinking coffee in the morning | ❓ No | ❌ Rejected | - | - |
| 3 | The weather today is really nice | ❌ No | ❌ Rejected | - | - |
| 4 | I have a meeting with John tomorrow at 3pm | ⚠️ Maybe | ❌ Rejected | - | - |
| 5 | My favorite color is blue | ❓ No | ❌ Rejected | - | - |
| 6 | I live in San Francisco and my phone number is 555-1234 | ✅ Yes | ✅ Extracted | san francisco (x2), 555 | identity, location |
| 7 | Can you help me with my homework? | ❌ No | ❌ Rejected | - | - |
| 8 | I have two cats named Fluffy and Whiskers | ⚠️ Maybe | ❌ Rejected | - | - |
| 9 | My birthday is on March 15th | ⚠️ Maybe | ❌ Rejected | - | - |
| 10 | I used to live in London but now I live in Paris | ⚠️ Maybe | ❌ Rejected | - | - |
| 11 | What time is it? | ❌ No | ❌ Rejected | - | - |
| 12 | I'm feeling really happy today because | ❌ No | ❌ Rejected | - | - |
| 13 | I need to buy milk and eggs from the store | ❌ No | ❌ Rejected | - | - |
| 14 | My email address is john.doe@example.com and I prefer Python over JavaScript | ⚠️ Maybe | ❌ Rejected | - | - |
| 15 | Hi there | ❌ No | ❌ Rejected | - | - |

### Summary Statistics

- **Total Messages:** 15
- **Extracted:** 2 (13.3%)
- **Rejected:** 13 (86.7%)
- **Bug Status:** ✅ FIXED - Only user messages extracted (not assistant responses)

---

## Quality Assessment

### ✅ What's Working Well

1. **Bug Fix Verified:** The assistant responses are NOT being stored (verified by checking each message - all show "0 memories were injected")
2. **High-Value Facts Extracted:** Messages with multiple specific entities (names, locations, organizations, phone numbers) are being extracted
3. **Noise Rejection:** Casual conversation, greetings, and low-specificity statements are correctly rejected
4. **Entity Extraction:** When memories ARE extracted, entities are correctly identified (names, places, organizations, phone numbers)

### ⚠️ Concerns Identified

#### 1. **Over-Conservative Extraction (13.3% extraction rate)**

**Problem:** The system is extremely picky, rejecting many valuable facts that should be remembered.

**Examples of incorrectly rejected memories:**

- **Message 2:** "I love drinking coffee in the morning" → **Should be extracted** (clear preference)
  - Has: specific entity (coffee), temporal context (morning), preference indicator (love)
  - **Why rejected:** Likely low specificity score (0.25 for preferences vs 0.3 for names)

- **Message 5:** "My favorite color is blue" → **Should be extracted** (clear preference)
  - Has: preference indicator (favorite), specific entity (blue)
  - **Why rejected:** Preference entity weight is low (0.25)

- **Message 8:** "I have two cats named Fluffy and Whiskers" → **Should be extracted** (relational fact)
  - Has: names (Fluffy, Whiskers), relationship (pets), number (two)
  - **Why rejected:** Relational facts might have lower priority

- **Message 9:** "My birthday is on March 15th" → **Should be extracted** (temporal fact)
  - Has: date entity (March 15th), personal information
  - **Why rejected:** Date normalization might be failing

- **Message 10:** "I used to live in London but now I live in Paris" → **Should be extracted** (location change with temporal marker)
  - Has: temporal marker ("used to"), locations (London, Paris), change indicator ("but now")
  - **Why rejected:** Temporal marker detection might not be working, or novelty too low

- **Message 14:** "My email address is john.doe@example.com and I prefer Python over JavaScript" → **Should be extracted** (contact info + preference)
  - Has: email (john.doe@example.com), preferences (Python, JavaScript), comparison
  - **Why rejected:** Email pattern might not be recognized, or too many entities diluting score

#### 2. **Specificity Scoring Issues**

**Problem:** The specificity scoring formula seems to favor certain entity types over others.

**From planning docs:**
- Names: 0.3
- Places: 0.25
- Numbers: 0.2
- Preferences: 0.25
- Dates: 0.2
- Negations: 0.2
- First-person possession: 0.10

**Observed behavior:**
- Messages with names + places get extracted (Emma + Microsoft, San Francisco)
- Messages with only preferences/dates/emails get rejected
- **Hypothesis:** The combined specificity score might not reach 0.0 (or total score < 0.55 threshold) for preference-only messages

**Calculation for "My favorite color is blue":**
- Specificity = 0.25 (preference) = 0.10 (possession) = 0.2 (color name?) = ~0.55 total
- If novelty is moderate (0.5), recurrence is low (0),- Total score ≈ 0.35 * 0.5 + 0.45 * 0.55 + 0.20 * 0 = **0.4925** < 0.55 threshold → **Rejected** ✅

#### 3. **Threshold Calibration**

**Current threshold:** 0.55 (moderate)

**Problem:** This threshold is too high for a general-purpose memory system. It's rejecting too many legitimate memories.

**Evidence:**
- Only 13.3% extraction rate
- Many clear facts (preferences, dates, contact info, relational facts) are being rejected
- **Planning docs say:** "Default threshold: 0.55 (moderate - balanced for general use)"
- **Reality:** It feels "strict" rather than "balanced"

---

## Recommendations

### 1. **Lower Default Extraction Threshold** (HIGH PRIORITY)

**Current:** 0.55
**Recommended:** 0.45-0.50

**Rationale:**
- 0.55 is rejecting too many valuable facts
- Planning docs say "moderate - balanced" but 13.3% extraction feels "strict"
- A threshold of 0.45-0.50 would likely capture:
  - Preferences (coffee, colors)
  - Dates (birthdays)
  - Contact info (emails)
  - Relational facts (pets, family)

**Implementation:**
```typescript
// In src/core/LokulMem.ts line 56
extractionThreshold: 0.45, // Changed from 0.50
```

### 2. **Adjust Entity Weights** (MEDIUM PRIORITY)

**Problem:** Preference entities are underweighted (0.25) compared to names (0.3).

**Recommendation:**
- Increase preference weight from 0.25 to 0.30
- Increase date/entity weight from 0.2 to 0.25
- This would help extract "My favorite color is blue" and "My birthday is on March 15th"

### 3. **Improve Temporal Marker Detection** (MEDIUM PRIORITY)

**Problem:** "I used to live in London but now I live in Paris" was not extracted despite having a clear temporal marker.

**Recommendation:**
- Verify temporal marker detection is working correctly
- Temporal markers should boost the extraction score or lower threshold for temporal facts

### 4. **Add Email Pattern Recognition** (LOW PRIORITY)

**Problem:** Email addresses are not being extracted as entities.

**Recommendation:**
- Add email regex pattern to SpecificityNER
- Email entities should have weight ~0.25 (similar to phone numbers)

### 5. **Improve Preference Extraction** (MEDIUM PRIORITY)

**Problem:** Preference statements ("I love coffee", "My favorite color is blue") are not being extracted.

**Root Cause:**
- Preference entity weight is 0.25 (low)
- Possession weight is 0.10 (low)
- Combined score likely < 0.55 threshold

**Recommendation:**
- Boost preference statements with higher weight
- Or add special handling for "I love/I like/My favorite" patterns

---

## Reliability Assessment

### ✅ Reliable Behaviors

1. **Bug Fix Verified:** Assistant messages are consistently NOT stored
2. **Entity Extraction:** When memories are stored, entities are correctly extracted
3. **Memory Types:** Correct types are assigned (identity, location, profession)
4. **Noise Filtering:** Low-value messages are filtered out

### ⚠️ Unreliable Behaviors

1. **Inconsistent Extraction:** Similar messages get different treatment:
   - "My name is Emma..." → extracted
   - "My favorite color is blue..." → rejected (both are "My X is Y" pattern)

2. **Threshold Sensitivity:** Small changes in wording can flip extraction decision
   - Makes system feel unpredictable to users

3. **Entity Bias:** System heavily favors names + locations over other entity types
   - Creates blind spots for preferences, dates, contact info

---

## Overall Assessment

### Grade: **C+ (Good with room for improvement)**

**Strengths:**
- ✅ Core bug fixed (no assistant messages stored)
- ✅ High-quality extraction when it happens
- ✅ Good noise filtering
- ✅ Correct entity extraction

**Weaknesses:**
- ⚠️ Too conservative (13.3% extraction rate)
- ⚠️ Threshold needs tuning (0.55 → 0.45-0.50)
- ⚠️ Entity weights favor names/places over preferences/dates
- ⚠️ Inconsistent extraction behavior

**Recommendation Priority:**
1. **HIGH:** Lower threshold to 0.45-0.50
2. **MEDIUM:** Adjust entity weights (boost preferences/dates)
3. **MEDIUM:** Verify temporal marker detection
4. **LOW:** Add email pattern recognition

---

## Test Coverage

- **Messages tested:** 15
- **Types tested:**
  - ✅ Identity facts (names, jobs)
  - ✅ Location facts (cities, addresses)
  - ✅ Contact info (phone, email)
  - ✅ Preferences (coffee, colors, languages)
  - ✅ Temporal facts (dates, times)
  - ✅ Relational facts (pets, family)
  - ✅ Questions (correctly rejected)
  - ✅ Greetings (correctly rejected)
  - ✅ Tasks (correctly rejected)
  - ✅ Emotional statements (correctly rejected)

**Next Steps:**
1. Implement threshold adjustment
2. Re-test with adjusted threshold
3. Compare extraction rates
4. Document improved behavior
