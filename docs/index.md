---
layout: home

hero:
  name: LokulMem
  text: Memory that stays sharp in production
  tagline: Local-first, policy-driven memory for AI products that care about correctness, privacy, and repeatability.
  actions:
    - theme: brand
      text: Read the Docs
      link: /guide/
    - theme: alt
      text: GitHub
      link: https://github.com/Pouryaak/LokulMem

features:
  - title: Local by default
    details: Memory persists on-device with IndexedDB and workers. No mandatory external memory service.
  - title: Reliable memory decisions
    details: Deterministic extraction, canonicalization, and policy actions with risk validation before writes.
  - title: Quality-gated in CI
    details: Staged eval gates (A/B/C), regression budgets, and package integrity checks stop drift early.
  - title: LLM agnostic
    details: Works with any provider that accepts message arrays, including hosted and local models.
---

## Build memory systems users can trust

LokulMem is built for teams that want memory quality without black-box behavior.

- **Predictable:** deterministic-first flow with explicit action reasons.
- **Safe by default:** user-origin extraction and contamination guard rails.
- **Debuggable:** rich diagnostics for add/update/supersede/ignore decisions.
- **Maintainable:** modular extraction packs and hard CI quality gates.

## What to read next

Use this path for the fastest onboarding:

1. [Getting Started](/guide/getting-started)
2. [Core API](/guide/core-api)
3. [Configuration](/guide/configuration)
4. [Eval Gates & CI](/guide/evals-and-ci)
