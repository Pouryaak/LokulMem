# P0 Implementation Checklist

Date: 2026-02-26

This is the execution checklist derived from the P0 technical research doc.

## Phase 1: Normalization and Canonicalization

- [x] Add `src/extraction/Normalizer.ts`
  - API: `normalizeForMatching(text: string): string`
  - API: `buildNormalizationMetadata(text: string): { normalized: string; operations: string[] }`
- [x] Add `src/extraction/Canonicalizer.ts`
  - API: canonical entity/predicate/temporal mapping
  - API: canonical key builder
- [x] Integrate in `src/api/Learner.ts` before scoring/extraction
  - preserve original text for storage
  - use normalized text for matching/classification
- [x] Add unit tests for contractions/case/noise handling

Done criteria:

- equivalent variants (`im`, `i m`, `I'm`) produce same canonical fact
- lowercase proper nouns no longer miss extraction in benchmark fixtures

## Phase 2: Write Policy + Risk Validation

- [x] Add `src/policy/WritePolicyEngine.ts`
  - output: `ADD | UPDATE | SUPERSEDE | IGNORE`
  - include `reasonCodes`
- [x] Add `src/policy/RiskValidator.ts`
  - validate contradiction/temporal/polarity/subject ambiguity risk
  - override optimistic writes when high risk
- [x] Add deterministic tie-break order to policy resolver
- [x] Integrate in `src/api/Learner.ts` before persistence

Done criteria:

- duplicate insert rate reduced on replay set
- unstable policy outcomes are eliminated across repeated runs

## Phase 3: Hybrid Extraction (Rule + Fallback)

- [x] Add fallback extraction interface in `src/extraction/`
  - provider contract: strict structured candidate JSON
- [x] Add ambiguity trigger module
  - gray-zone score
  - pronoun/relation ambiguity
  - unresolved temporal shifts
- [x] Add candidate fusion/calibration module
  - agreement boost
  - disagreement conservative fallback

### Mem0-inspired implementation notes (for Phase 3)

Source files reviewed:

- `mem0-main/mem0/memory/main.py`
- `mem0-main/mem0/configs/prompts.py`
- `mem0-main/mem0/memory/utils.py`

Borrow these proven patterns instead of reinventing:

1. **Two-stage extraction flow**
   - Stage A: extract `facts[]` from conversation with strict JSON output.
   - Stage B: compare new facts to top-K existing memories and output action plan.
   - Mem0 shape: `ADD | UPDATE | DELETE | NONE`; map to LokulMem as `ADD | UPDATE | SUPERSEDE | IGNORE`.

2. **Strict role scoping in prompts**
   - Keep user-only extraction default and explicit penalties for assistant/system contamination.
   - Preserve our default `extractFrom='user'` behavior and add this rule to fallback prompt contract.

3. **Robust JSON handling for fallback model output**
   - Keep strict response format, but add tolerant parser fallback:
     - strip fenced code blocks
     - extract embedded JSON if wrapper text leaks
   - Avoid hard failures on minor format drift.

4. **Candidate retrieval + bounded compare set before update decision**
   - For each extracted fact, retrieve small top-K (Mem0 uses 5) similar existing items.
   - Deduplicate by memory ID before update-policy call.
   - Keep compare-set bounded for latency stability.

5. **ID-safety for model action responses**
   - Mem0 remaps IDs to temporary integers to reduce hallucinated IDs.
   - In LokulMem, keep our canonical/UUID IDs internal and validate any fallback target IDs against known candidate map before applying action.

6. **Skip second-stage decision when no facts were extracted**
   - Do not invoke policy/fallback update stage if Stage A yields no facts.
   - Saves latency and avoids noisy writes.

7. **Keep infer toggle semantics**
   - Mem0 supports `infer=False` direct write path.
   - For LokulMem Phase 3, keep deterministic-first path and only trigger LLM fallback on explicit ambiguity/risk gates.

P0 scope guardrails while borrowing from Mem0:

- Do not import full Mem0 delete semantics directly; prefer `SUPERSEDE` over hard delete for contradictory facts.
- Keep fallback contract narrow (facts + action suggestions), then run through local `WritePolicyEngine` + `RiskValidator` before persistence.
- Maintain deterministic ordering and reason codes as source of truth.

### Phase 3.1 (LLM fallback integration) status

- [x] Added WebLLM-compatible fallback extractor implementation under `src/extraction/FallbackExtractor.ts`
- [x] Added fallback extraction prompts under `src/extraction/FallbackPrompts.ts`
- [x] Added robust JSON parsing (code fence stripping + embedded JSON extraction)
- [x] Added config plumbing (`fallbackLLM`) from `LokulMemConfig` through worker init
- [x] Kept deterministic-first gating + ambiguity trigger + fusion + policy/risk validation in control

Done criteria:

- prior known failure conversations are captured without ad hoc regex additions
- default mode keeps assistant contamination at zero

## Phase 4: Eval Harness + CI Gates

- [ ] Add `tests/evals/memory/fixtures/*.json`
  - clean facts
  - noisy variants
  - chatty noise
  - mixed turns
  - cross-turn linking
  - temporal transitions
  - supersession and implicit updates
- [ ] Add `tests/evals/memory/runner.ts`
  - computes recall, noise FP, contamination, policy accuracy, link accuracy, temporal accuracy, stability
- [ ] Add `npm run eval:memory` script in `package.json`
- [ ] Add CI job for staged gates (A/B/C)

Done criteria:

- deterministic local and CI eval results
- regression budget enforcement active

## Cross-cutting

- [x] Add diagnostics fields to policy and extraction logs
- [ ] Keep defaults plug-and-play (no required user config)
- [ ] Document behavior and thresholds in README or docs

## Initial Threshold Targets

- meaningful recall >= 0.90
- noise false positive <= 0.05
- assistant contamination == 0
- supersession correctness >= 0.90
- canonicalization accuracy >= 0.95
- entity-link accuracy >= 0.85 (initial)
- temporal state accuracy >= 0.90
- policy decision accuracy >= 0.88 (initial)
