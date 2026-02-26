# Memory Lifecycle

LokulMem processes each turn through a deterministic pipeline.

## Pipeline

1. Normalize and canonicalize candidate facts.
2. Extract via deterministic rules.
3. Trigger fallback extraction only for ambiguity cases.
4. Fuse candidates and score quality.
5. Decide action with write policy (`ADD`, `UPDATE`, `SUPERSEDE`, `IGNORE`).
6. Run risk validation before persistence.
7. Persist and update retrieval state.

## Why this matters

- Keeps writes conservative under uncertainty.
- Reduces duplicate or contradictory memory inserts.
- Produces explainable diagnostics for each decision.

## Policy and safety

- Default extraction origin is user-only to prevent assistant contamination.
- Contradiction and temporal transitions can route facts to `SUPERSEDE`.
- High-risk conflicts can be downgraded to safe actions before write.
