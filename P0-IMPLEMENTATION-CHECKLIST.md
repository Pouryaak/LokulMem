# P0 Implementation Checklist

Date: 2026-02-26

This is the execution checklist derived from the P0 technical research doc.

## Phase 1: Normalization and Canonicalization

- [ ] Add `src/extraction/Normalizer.ts`
  - API: `normalizeForMatching(text: string): string`
  - API: `buildNormalizationMetadata(text: string): { normalized: string; operations: string[] }`
- [ ] Add `src/extraction/Canonicalizer.ts`
  - API: canonical entity/predicate/temporal mapping
  - API: canonical key builder
- [ ] Integrate in `src/api/Learner.ts` before scoring/extraction
  - preserve original text for storage
  - use normalized text for matching/classification
- [ ] Add unit tests for contractions/case/noise handling

Done criteria:

- equivalent variants (`im`, `i m`, `I'm`) produce same canonical fact
- lowercase proper nouns no longer miss extraction in benchmark fixtures

## Phase 2: Write Policy + Risk Validation

- [ ] Add `src/policy/WritePolicyEngine.ts`
  - output: `ADD | UPDATE | SUPERSEDE | IGNORE`
  - include `reasonCodes`
- [ ] Add `src/policy/RiskValidator.ts`
  - validate contradiction/temporal/polarity/subject ambiguity risk
  - override optimistic writes when high risk
- [ ] Add deterministic tie-break order to policy resolver
- [ ] Integrate in `src/api/Learner.ts` before persistence

Done criteria:

- duplicate insert rate reduced on replay set
- unstable policy outcomes are eliminated across repeated runs

## Phase 3: Hybrid Extraction (Rule + Fallback)

- [ ] Add fallback extraction interface in `src/extraction/`
  - provider contract: strict structured candidate JSON
- [ ] Add ambiguity trigger module
  - gray-zone score
  - pronoun/relation ambiguity
  - unresolved temporal shifts
- [ ] Add candidate fusion/calibration module
  - agreement boost
  - disagreement conservative fallback

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

- [ ] Add diagnostics fields to policy and extraction logs
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
