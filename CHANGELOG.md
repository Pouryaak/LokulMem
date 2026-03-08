# Changelog

## 0.1.2

### Patch Changes

- 046cc56: Fix worker-side memory events not reaching main thread and add bare age identity pattern

## 0.1.1

### Patch Changes

- Reduce published package footprint by removing sourcemaps/public artifacts from npm tarballs and aligning worker URL export with runtime worker resolution.

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [0.1.0] - 2026-02-27

### Added

- Memory extraction hardening with modular specificity packs for education, preference, routine, temporal, health, contact, and scoped negation handling.
- Deterministic memory eval harness with fixture suites, baseline snapshot, and staged gates `A/B/C`.
- CI quality pipeline with Node version matrix checks, memory eval gates, package integrity validation, and nightly integration smoke workflow.
- Security and maintenance automation with CodeQL, Dependabot grouping policy, and dependency review workflow.
- GitHub Pages documentation site with dedicated docs structure and custom dark theme.

### Changed

- Upgraded core dev toolchain (Biome v2, Vite 7, Vitest 4, happy-dom 20) and aligned configuration.
- Updated lint and formatting behavior for modern Biome schema and stricter checks.
- Improved README quality/CI guidance and linked hosted documentation entry point.

### Fixed

- Reduced extraction false positives in conversational/noise phrases and improved policy consistency.
- Removed known npm audit vulnerabilities in the core dependency graph used by the library pipeline.
