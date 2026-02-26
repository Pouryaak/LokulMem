# P0 Technical Research: Hybrid Extraction, Canonicalization, Write Policy, and Eval Gates

Date: 2026-02-26

## Scope

This document is P0-only research for LokulMem, focused on:

1. Hybrid extraction (rules + model-assisted fallback)
2. Normalization and canonicalization
3. Write-policy classifier (`save/update/supersede/ignore`)
4. Evaluation harness and CI quality gates

The goal is a concrete technical roadmap with implementable algorithms and release gates.

## Current LokulMem Baseline (What We Have)

From code inspection:

- Extraction is currently deterministic and heuristic-heavy (`SpecificityNER`, `QualityScorer`), with weighted score:
  - `E(s) = novelty*0.35 + specificity*0.45 + recurrence*0.20`
- Learning path is synchronous and cleanly sequenced in `Learner.learn()`:
  - score -> threshold -> persist -> vector cache update -> contradiction/supersession -> optional maintenance
- Default extraction origin is now `user` (good, prevents assistant contamination by default)
- Type-specific thresholds already exist in worker init (`thresholdsByType` in `src/worker/index.ts`)

Primary P0 gap remains robustness for natural variation and cross-turn inference (especially noisy phrasing, casing, contractions, and relation carryover).

## Industry Patterns (What Strong Systems Actually Do)

Across LangGraph/LangMem, Mem0, CrewAI, Letta/MemGPT, AutoGen, and Semantic Kernel docs, recurring patterns are:

1. **Hybrid extraction, not regex-only**
   - Deterministic fast-path + model-based decision/extraction for ambiguous utterances
2. **Memory update is a policy problem**
   - Explicit `ADD/UPDATE/DELETE/NONE` decisions are common
3. **Schema-first memory records**
   - Structured memory payloads (type, entities, confidence, source metadata, timestamps)
4. **Scope-aware memory**
   - Conversation/session/user/org partitioning
5. **Continuous quality loops**
   - Automated eval datasets + thresholds + CI block on regression
6. **Operational safety defaults**
   - Conservative writes under uncertainty, explainable diagnostics, and easy override paths

## P0.1 Hybrid Extraction: Recommended Architecture

### Design Principle

Use deterministic extraction by default for speed and cost, but trigger a model-assisted pass when confidence is low, patterns are ambiguous, or relation inference is needed.

### Proposed Pipeline

1. **Pre-normalize text** (P0.2 layer)
2. **Rule extraction pass**
   - Existing `SpecificityNER` + pattern rules
3. **Ambiguity detector**
   - Trigger model fallback if any conditions true
4. **Model-assisted extraction (structured JSON)**
5. **Candidate fusion + confidence calibration**
6. **Write-policy classifier** (P0.3)
7. **Contradiction/supersession apply**

### Ambiguity Trigger Heuristics (for model fallback)

Trigger model extraction when one or more conditions hold:

- `score` in gray zone (example: `0.30 <= E(s) < threshold`)
- strong relational markers but weak entity capture:
  - pronouns (`she/he/they`), relation pivots (`my wife`, `my manager`, `my friend`)
- orthographic noise:
  - contractions missing apostrophes, lowercased proper nouns, mixed punctuation
- conflicting candidates in same turn
- temporal change markers (`used to`, `now`, `no longer`) without clear old/new slots

### Model Extraction Output Contract

Use strict JSON schema (inspired by Mem0 and LangMem structured extraction):

```json
{
  "candidates": [
    {
      "fact": "User lives in Australia",
      "type": "location",
      "entities": [{ "type": "place", "value": "Australia" }],
      "confidence": 0.0,
      "polarity": "affirmed",
      "temporal": { "kind": "current", "from": null, "to": null },
      "relation": { "subject": "user", "predicate": "lives_in", "object": "Australia" },
      "evidence_span": "..."
    }
  ]
}
```

### Fusion Strategy

- If rule and model agree semantically, increase confidence (e.g., +0.1 capped at 1.0)
- If they disagree:
  - prefer conservative action (`ignore` or `candidate-needs-more-evidence`) unless contradiction markers are strong
- Deduplicate by canonical key (from P0.2)

## P0.2 Normalization and Canonicalization: Recommended Architecture

### Why This Is P0-Critical

Most recall misses in real conversations are not conceptual failures but normalization failures.

### Normalization Stages

1. **Unicode normalization**: NFKC
2. **Whitespace/punctuation normalization**
3. **Contraction normalization**
   - `im`, `i m` -> `i'm`
   - `dont` -> `don't`
4. **Case handling split**
   - Keep original text for storage/audit
   - Use normalized lowercase for matching/classification
5. **Lexical typo smoothing** (lightweight, high-confidence only)
   - Avoid aggressive autocorrect that changes meaning

### Storage vs Matching Normalization (P0 decision)

Use split normalization paths:

- **Storage path (conservative)**
  - preserve original text verbatim for audit/debug
  - attach normalized derivatives as metadata only
- **Matching path (aggressive within bounds)**
  - lowercase, contractions, punctuation cleanup, controlled typo smoothing
  - used for extraction/classification/similarity, never as user-visible source of truth

This avoids losing fidelity while still improving recall.

### Canonicalization Targets

1. **Entity canonicalization**
   - Places: `australia` -> `Australia`
   - Organizations/roles: normalize spacing/case
2. **Predicate canonicalization**
   - `likes`, `loves`, `prefers` -> normalized preference predicates where appropriate
3. **Temporal canonicalization**
   - relative markers (`now`, `used to`) become structured temporal state
4. **Relation carryover canonicalization**
   - map cross-turn pronouns to latest known entity in conversation context

### Canonical Memory Key

Create deterministic key for dedupe/update routing:

`key = hash(scope + subject_canonical + predicate_canonical + object_canonical + temporal_bucket)`

This is the anchor for update/supersede operations.

## P0.3 Write-Policy Classifier: Recommended Architecture

### Required Output

`ADD | UPDATE | SUPERSEDE | DELETE | IGNORE`

(`DELETE` can remain internal and emitted mostly through contradiction/supersession; user-facing policy can stay `ADD/UPDATE/SUPERSEDE/IGNORE`.)

### Features

- extraction confidence (rule/model/fused)
- quality score components (novelty/specificity/recurrence)
- similarity to nearest existing memories (top-k)
- contradiction signal strength
- temporal change signal
- entity and relation completeness
- source quality flags (noisy text, ambiguous pronouns)

### Policy v1 (Practical P0)

Implement as deterministic scored policy first (faster and explainable), with optional learned model in P1:

- `IGNORE` if confidence low OR novelty below floor
- `UPDATE` if high similarity + same canonical key + new detail adds specificity
- `SUPERSEDE` if same domain/key but temporal/contradiction marker indicates replacement
- `ADD` if high confidence + sufficiently novel + non-conflicting

### Example Decision Rules

- `if confidence < 0.45 -> IGNORE`
- `if sim > 0.90 and adds_detail -> UPDATE`
- `if contradiction && temporal_shift -> SUPERSEDE`
- `if novelty > 0.35 && confidence > 0.60 -> ADD`

### Explainability Requirement

Return decision metadata for diagnostics:

```ts
{
  action: 'UPDATE',
  reasonCodes: ['HIGH_SIMILARITY', 'DETAIL_ENRICHMENT'],
  matchedMemoryId: '...',
  confidence: 0.81
}
```

### Post-policy Risk Validator (P0 decision)

Add a `RiskValidator` after policy decision and before persistence.

- Inputs: candidate + policy action + nearest-memory context + temporal/polarity signals
- If high-risk contradiction is detected, override optimistic action to conservative action:
  - `ADD/UPDATE -> IGNORE` or `REVIEW_NEEDED` internal state
- High-risk signals:
  - polarity mismatch with high similarity (`likes` vs `hates`)
  - temporal conflict (`used to` vs `currently`) with unresolved time window
  - subject-identity ambiguity in pronoun-heavy turns

This keeps deterministic policy explainable while reducing unsafe writes.

### Deterministic Conflict Tie-breakers (P0 decision)

When multiple candidate actions are plausible, enforce deterministic precedence:

1. `SUPERSEDE` (only with strong contradiction+temporal evidence)
2. `UPDATE`
3. `ADD`
4. `IGNORE`

If evidence is insufficient for top action, fall through to next action. This guarantees run-to-run stability.

## P0.4 Evaluation Harness + CI Gates: Recommended Architecture

### Dataset Design

Create gold datasets grouped by failure type:

1. **Meaningful facts (clean)**
2. **Meaningful facts (noisy variants)**
   - contractions, lowercase entities, typos
3. **Chatty/non-memory messages**
4. **Mixed conversations** (meaningful + chatty)
5. **Cross-turn relation chains**
6. **Supersession/contradiction scenarios**
7. **Temporal correctness suites** (`current`, `past`, `transition`)
8. **Cross-turn entity-linking suites** (pronouns, relation carryover)
9. **Implicit update progression suites** (fact evolves over turns)

Each sample should define:

- input turns
- expected memory actions
- expected persisted facts (canonical)
- expected non-persisted noise

### Core Metrics

- **Meaningful Recall**: expected facts captured / total expected facts
- **Noise Precision**: 1 - false-positive rate on chatty/noise turns
- **Assistant Contamination Rate**
- **Update/Supersession Accuracy**
- **Canonicalization Accuracy** (normalized form correctness)
- **Decision Stability** (same output across repeated runs)
- **Entity-Link Accuracy** (correct referent resolution across turns)
- **Temporal State Accuracy** (current/past/transition labeling correctness)
- **Policy Decision Accuracy** (`ADD/UPDATE/SUPERSEDE/IGNORE` exact-match on gold)

### Suggested Initial Release Gates (P0)

- meaningful recall >= 0.90
- noise false positive <= 0.05
- assistant contamination == 0 (default mode)
- supersession correctness >= 0.90
- canonicalization accuracy >= 0.95 on targeted normalization suite
- entity-link accuracy >= 0.85 (initial), then ratchet upward
- temporal state accuracy >= 0.90 on temporal suite
- policy decision accuracy >= 0.88 (initial), then ratchet upward

Use staged gates to avoid blocking early integration:

- **Stage A (bring-up):** compute metrics, no hard fail except contamination
- **Stage B (soft gate):** fail if regression > budget relative to baseline
- **Stage C (hard gate):** enforce absolute thresholds above

### CI Integration

Add eval script as part of CI pipeline before `build` pass gate:

- `npm run test`
- `npm run eval:memory` (new)
- fail PR if any gate breaches baseline

Use baseline snapshot file committed in repo to compare regressions over time.

## How Others Map to P0 Decisions

### Mem0

- Clear two-step memory update process with action taxonomy (`ADD/UPDATE/DELETE/NONE`)
- Strong evidence for explicit memory update prompts and conflict resolution
- Supports metadata/rerank and graph extensions; validates policy-driven persistence design

### LangMem / LangGraph

- Recommends both hot-path and background memory formation
- Distinguishes profile vs collection memory forms (useful for future P1 scope)
- Structured manager pattern aligns with candidate extraction + memory update pipeline

### CrewAI

- Composite scoring and consolidation thresholds
- Async write flow with read barrier pattern
- Demonstrates practical architecture for non-blocking writes and deterministic reads

### Letta / MemGPT

- Multi-tier memory model and emphasis on stateful agent behavior over long context horizons
- Letta Evals confirms best practice: explicit gates, multi-turn test suites, and CI-friendly pass/fail

### AutoGen / Semantic Kernel

- Strong abstraction boundaries (`add/query/update_context` and vector-store interface)
- Reinforces keeping LokulMem policy and storage concerns modular

## Concrete P0 Implementation Plan (Recommended Order)

1. **Normalization + canonical key layer**
   - Add `Normalizer` and `Canonicalizer` modules
   - Insert before `QualityScorer` and `SpecificityNER` usage in `Learner`

2. **Hybrid extraction with fallback trigger**
   - Keep current rule pipeline
   - Add fallback extraction interface (pluggable provider)
   - Add candidate fusion + confidence calibration

3. **Write-policy classifier**
   - Introduce `WritePolicyEngine` between candidate generation and persistence
   - Log `reasonCodes` for diagnostics

4. **Eval harness + CI gates**
   - Add dedicated eval dataset files + runner
   - Add `eval:memory` script and CI blocking thresholds

## Feedback-adjusted Scope Control (Accepted vs Deferred)

### Accepted into P0

- split storage vs matching normalization
- deterministic `WritePolicyEngine` with reason codes
- post-policy `RiskValidator`
- deterministic conflict tie-breakers
- explicit entity-linking component (lightweight resolver)
- expanded eval suites (temporal, cross-turn link, policy accuracy)
- minimal implicit-update lifecycle state (`current`, `superseded`, `uncertain`)

### Deferred to P1+

- full graph clustering / transitive closure entity graph
- heavy global optimization passes over entire memory store
- strict global p95 under 200ms including all fallback model calls

Rationale: these are valuable, but increase complexity and delivery risk beyond P0 quality target.

## Acceptance Criteria by P0 Item

### Hybrid extraction

- captures prior 5-message failure cases without manual pattern tweaks
- does not increase assistant contamination in default mode

### Normalization/canonicalization

- `im`/`i m`/`I'm` variants map to equivalent extracted facts
- lowercase proper nouns in common entities no longer miss core extraction

### Write policy

- duplicate inserts on same fact class reduced measurably
- contradiction/supersession correctness improved on benchmark suite

### Eval harness

- deterministic local run and CI run
- baseline JSON artifact and trend-safe regression checks in place

## Risks and Mitigations

- **Overfitting to benchmark phrasing**
  - mitigation: generate paraphrase/noise variants and keep holdout suites
- **Model fallback latency/cost increase**
  - mitigation: strict ambiguity trigger + caching + only-on-fail fallback
- **False supersession due to aggressive policy**
  - mitigation: require contradiction + temporal marker + high similarity concurrence
- **Rule/model disagreement complexity**
  - mitigation: conservative default action with reason code logging

## Recommended Immediate Next Step

Implement P0 in this exact sequence:

1. `Normalizer` + `Canonicalizer` (no model dependency)
2. `WritePolicyEngine` (deterministic v1)
3. hybrid model fallback interface and trigger logic
4. eval harness and CI gating

This order gives fastest quality gains with lowest risk and creates measurement before broader tuning.

## References

- LangGraph memory overview: https://docs.langchain.com/oss/javascript/langgraph/memory
- LangMem docs: https://langchain-ai.github.io/langmem/
- LangMem semantic extraction guide: https://langchain-ai.github.io/langmem/guides/extract_semantic_memories/
- Mem0 memory types: https://docs.mem0.ai/core-concepts/memory-types
- Mem0 add/search/update/delete docs: https://docs.mem0.ai/core-concepts/memory-operations/add
- Mem0 advanced memory operations: https://docs.mem0.ai/platform/advanced-memory-operations
- Mem0 OSS code (memory pipeline): https://raw.githubusercontent.com/mem0ai/mem0/main/mem0/memory/main.py
- Mem0 prompts (fact extraction/update policy): https://raw.githubusercontent.com/mem0ai/mem0/main/mem0/configs/prompts.py
- CrewAI memory concepts: https://docs.crewai.com/en/concepts/memory
- AutoGen memory and RAG: https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/memory.html
- Semantic Kernel vector store concepts: https://learn.microsoft.com/en-us/semantic-kernel/concepts/vector-store-connectors/
- Letta evals overview: https://docs.letta.com/guides/evals/overview/index.md
- Letta eval gates: https://docs.letta.com/guides/evals/concepts/gates/index.md
- Letta multi-turn evals: https://docs.letta.com/guides/evals/advanced/multi-turn-conversations/index.md
- MemGPT paper: https://arxiv.org/abs/2310.08560
- CoALA paper: https://arxiv.org/abs/2309.02427
- Mem0 paper: https://arxiv.org/abs/2504.19413
- RAG eval patterns (LangSmith): https://docs.langchain.com/langsmith/evaluate-rag-tutorial
- Ragas metrics overview: https://docs.ragas.io/en/stable/
