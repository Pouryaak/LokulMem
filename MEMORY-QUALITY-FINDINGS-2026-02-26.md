# Memory Quality Findings and Improvement Plan (2026-02-26)

## Executive Summary

- We validated memory quality with a mixed chat workload (15 messages: 10 meaningful + 5 chatty).
- Final tuned behavior stores **10/10 meaningful** messages and **0/5 chatty** messages.
- Assistant responses are not persisted as memories by default (`extractFrom: 'user'`).
- Current quality is strong for v0.1 rule-based extraction, but still below state-of-the-art adaptive memory systems in evaluation depth and long-horizon adaptation.

## Scope and Method

- Test surface: `examples/react-app` chat flow using `augment()` + `learn()`.
- Validation channels:
  - per-turn extraction outputs logged by `examples/react-app/src/components/ChatView.tsx`
  - persisted memories read directly from browser IndexedDB (`LokulMemDB`, `memories` store)
- Message mix:
  - meaningful: identity, profession, preference, habit, relational, temporal update, email, project intent
  - chatty/random: greetings, small talk, casual acknowledgment

## Observed Results

### Before tuning pass

- meaningful retained: 9/10
- chatty retained: 0/5
- assistant-message retention: 0
- known miss: comparative preference phrase (`I prefer Vim over VS Code`)

### After tuning pass

- meaningful retained: 10/10
- chatty retained: 0/5
- assistant-message retention: 0
- persisted memory list matched only meaningful user content

## Root Causes Identified

1. Comparative preference language was under-scored.
2. First-detected memory type overly influenced acceptance threshold.
3. Some high-value user facts (habits/temporal-change style statements) needed stronger rule-level support.

## Code and Behavior Changes Applied

- `src/extraction/QualityScorer.ts`
  - threshold selection now uses the minimum applicable type threshold across detected types.
- `src/extraction/SpecificityNER.ts`
  - added richer heuristics for routines/habits and temporal-change cues.
  - strengthened email signal.
  - added comparative preference extraction (`prefer X over Y`).
  - avoided weekday-as-place false positives.
- `src/worker/index.ts`
  - tuned type-specific thresholds for better precision/recall balance.
- `src/api/Learner.ts`, `src/api/types.ts`, `src/types/memory.ts`
  - added optional verbose diagnostics support in `learn()` results for extraction transparency.
- `tests/unit/extraction-heuristics.test.ts`
  - added quality regression tests for habit, temporal change, email, weekday disambiguation, comparative preference.

## Validation Evidence

- Unit tests: pass (`41/41`).
- Library build: pass.
- React demo build: pass.
- Mixed 15-message scenario: pass against target behavior.

## Comparison to Modern Memory Patterns (Web Research)

### What modern systems consistently emphasize

- Separation of memory types: semantic, episodic, procedural.
- Explicit short-term vs long-term memory boundaries.
- Strong write policies: what to remember, when to write, and how to forget.
- Continuous evaluation loops (precision/recall drift, memory utility, personalization outcomes).
- Observability: explainability of why memories were created/recalled.

### How LokulMem currently compares

- Strengths:
  - local-first persistence and retrieval
  - clear extraction pipeline and contradiction handling
  - explicit lifecycle operations and management APIs
  - improved extraction quality on meaningful-vs-chatty discrimination
- Gaps:
  - no standardized benchmark harness for continuous memory-quality tracking
  - limited episodic/procedural memory treatment vs modern agent stacks
  - no background memory consolidation/reflection pipeline
  - limited multilingual/paraphrase robustness evaluation coverage

## Reliability Assessment

- Current reliability: **good for v0.1 production pilots** where semantic user-memory retention is primary.
- Not yet complete for “best-in-class memory platform” due to eval rigor and adaptation breadth gaps.

## Detailed Future Improvement Plan

### Phase A: Measurement and Guardrails (high priority)

1. Add benchmark corpus and scoring harness:
   - precision/recall on meaningful extraction
   - false-positive rate on chatty/noise
   - contradiction/supersession correctness
2. Add CI quality gates with minimum acceptance thresholds.
3. Add regression datasets for paraphrases, temporal updates, and preference comparisons.

### Phase B: Memory Policy Maturity (high priority)

1. Introduce explicit memory classes for semantic vs episodic writes.
2. Add configurable write policy profiles (strict, balanced, adaptive).
3. Improve duplicate/similarity handling for near-paraphrase statements.

### Phase C: Adaptive Learning Loops (medium priority)

1. Add background consolidation jobs (merge, summarize, prune).
2. Add decayed confidence and reinforcement by retrieval utility.
3. Add user-correction feedback loops to reweight future extraction decisions.

### Phase D: Real-world robustness (medium priority)

1. Expand language coverage and domain-specific entity dictionaries.
2. Evaluate over longer, multi-session user trajectories.
3. Track downstream impact on response quality, not just extraction counts.

## Recommended Quality KPIs

- Meaningful extraction recall (% meaningful facts stored)
- Noise precision (% stored memories that are truly meaningful)
- Assistant contamination rate (must remain 0 by default)
- Supersession correctness rate
- Retrieval utility score (how often injected memory improves answer quality)

## Notes on Historical Docs

- Some planning artifacts in `.planning/` reflect historical design points (for example earlier threshold defaults).
- Treat runtime code and this report as the current source of behavior truth.
