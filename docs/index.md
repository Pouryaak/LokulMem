---
layout: home

hero:
  name: LokulMem
  text: Browser-native memory for AI apps
  tagline: Local-first, explainable, and CI-guarded memory management for modern assistants.
  actions:
    - theme: brand
      text: Read the Docs
      link: /guide/
    - theme: alt
      text: GitHub
      link: https://github.com/Pouryaak/LokulMem

features:
  - title: Local by default
    details: Keeps memory on-device with IndexedDB and worker-based architecture. No mandatory backend.
  - title: Reliable memory decisions
    details: Deterministic extraction, canonicalization, policy actions, and risk validation before persistence.
  - title: Quality-gated in CI
    details: Staged eval gates (A/B/C), regression budgets, and package integrity checks stop quality drift.
  - title: LLM agnostic
    details: Works with providers that accept messages arrays, including hosted and local model setups.
---

## Why teams pick LokulMem

LokulMem is designed for product teams that need memory quality and developer control, without shipping user data to a separate memory backend.

- **Predictable behavior:** deterministic-first pipeline with explicit action reasons.
- **Operational safety:** default user-only extraction and contamination guard rails.
- **Inspectable outputs:** debugging metadata for why something was saved, updated, superseded, or ignored.
- **Open-source friendly:** testable architecture, clear CI gates, and practical migration paths.

## Ready to start?

Jump into the docs section for installation, API usage, architecture, and quality operations.

- [Open documentation](/guide/)
