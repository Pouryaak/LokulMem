# Phase 1: Foundation - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Project scaffolding, TypeScript build system, and core type definitions ready for downstream phases. This phase sets up the foundation that all other phases depend on — the build system, project structure, and TypeScript configuration.

</domain>

<decisions>
## Implementation Decisions

### Source organization
- Moderate nesting with logical folders (src/types/, src/core/, src/worker/, src/utils/)
- Types in dedicated src/types/ folder, organized by domain
- Worker code in src/worker/ folder with index.ts entry point
- Utilities in src/utils/ folder organized by purpose
- Internal-only modules in src/internal/ (not exported publicly)
- File naming: kebab-case (my-file.ts)

### Package exports
- Named exports only — no default export
- Main entry: src/index.ts re-exports everything public
- Sub-exports: 'lokulmem/react' for React integration
- Types are re-exported from main entry (import { MemoryDTO } from 'lokulmem')
- Worker can be imported directly for advanced use cases ('lokulmem/worker')

### Development workflow
- Full example app in examples/ folder for development testing
- Examples have their own dev servers (isolated package.json)
- Testing: Unit + integration + type tests
- Output format: Dual ESM + CJS for broad compatibility
- Source maps: Yes, separate files (not inline)
- Linting: Biome for speed (instead of ESLint + Prettier)
- Git hooks: Pre-commit hook that runs checks (blocking)
- No separate playground — rely on examples/ and tests
- Build output: Both bundled and ESM preserving source structure
- Test environments: Unit tests in Node.js (happy-dom), integration in real browser (Playwright)
- Bundle size: Check with warnings but don't fail builds

### NPM scripts (professional set)
- build, test, lint, clean, dev, watch, format, typecheck, ci

### Type strictness level
- Maximum strictness: all strict flags enabled
- No `any` type allowed at all
- Explicit type imports required (verbatimModuleSyntax)
- Only public API exports need explicit return types
- No TypeScript path mapping — use relative imports only
- Standard number type (not bigint) for timestamps

### Worker import syntax
- Use ?worker&url for bundler compatibility
- URL approach for broader bundler support

### Third-party libraries
- Only use libraries with built-in TypeScript types
- Avoid dependencies without type definitions

</decisions>

<specifics>
## Specific Ideas

- "Examples should have their own dev servers so they can test the library in isolation"
- "Use Biome for linting — it's faster than ESLint + Prettier"
- "Maximum TypeScript strictness — catch errors at compile time"
- "No `any` types anywhere — if we can't type it, we shouldn't ship it"
- "Dual ESM + CJS output for maximum compatibility"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-02-23*
