# Eval Gates & CI

LokulMem includes deterministic memory-quality evals and CI gates to prevent regressions.

## Run locally

```bash
npm run eval:memory:A
npm run eval:memory:B
npm run eval:memory:C
```

## Gate model

- **A:** bring-up metrics, hard fail only assistant contamination.
- **B:** regression-budget checks against baseline.
- **C:** absolute thresholds + regression checks.

Baseline file:

- `tests/evals/memory/baseline.json`

## CI checks

Main CI enforces:

- lint, typecheck, unit tests, build
- memory eval gates A/B/C
- package integrity validation
- dependency/security workflows

## Why this is important

Memory systems fail silently without quality gates. This setup catches drift early and keeps behavior stable across releases.
