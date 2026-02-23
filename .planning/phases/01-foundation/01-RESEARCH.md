# Phase 1: Foundation - Research

**Researched:** 2026-02-23
**Domain:** TypeScript, Vite Library Mode, Build Systems
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundational build system and project structure for LokulMem, a browser-native LLM memory management library. The research focuses on TypeScript configuration with maximum strictness, Vite library mode for dual ESM/CJS output, worker bundling strategies, and modern tooling with Biome for linting/formatting.

The foundation phase is critical as all downstream phases depend on these build configurations. Key decisions include: using Vite's library mode with multiple entry points (main + worker), generating TypeScript declarations via vite-plugin-dts, enforcing strict type checking with no `any` types allowed, and setting up Biome as a fast alternative to ESLint + Prettier.

**Primary recommendation:** Use Vite 6+ with library mode, configure dual ESM/CJS output with separate worker chunk, enable all strict TypeScript flags, and use Biome for tooling speed.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Source organization: moderate nesting with logical folders (src/types/, src/core/, src/worker/, src/utils/)
- Types in dedicated src/types/ folder, organized by domain
- Worker code in src/worker/ folder with index.ts entry point
- Utilities in src/utils/ folder organized by purpose
- Internal-only modules in src/internal/ (not exported publicly)
- File naming: kebab-case (my-file.ts)
- Named exports only — no default export
- Main entry: src/index.ts re-exports everything public
- Sub-exports: 'lokulmem/react' for React integration
- Types are re-exported from main entry (import { MemoryDTO } from 'lokulmem')
- Worker can be imported directly for advanced use cases ('lokulmem/worker')
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
- NPM scripts: build, test, lint, clean, dev, watch, format, typecheck, ci
- Maximum strictness: all strict flags enabled
- No `any` type allowed at all
- Explicit type imports required (verbatimModuleSyntax)
- Only public API exports need explicit return types
- No TypeScript path mapping — use relative imports only
- Standard number type (not bigint) for timestamps
- Worker import syntax: Use ?worker&url for bundler compatibility
- URL approach for broader bundler support
- Only use libraries with built-in TypeScript types
- Avoid dependencies without type definitions

### Claude's Discretion
None specified — all major decisions locked by user.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TS-01 | 100% TypeScript coverage for public API | Strict mode configuration, verbatimModuleSyntax, explicit return types on exports |
| TS-02 | Tree-shakeable ESM bundle output | Vite library mode with ESM format, preserveModules option, sideEffects: false in package.json |
| TS-03 | Type declarations (.d.ts) generated | vite-plugin-dts configuration, include: ['src'] option, rollupTypes for single file |
| TS-04 | Worker compiled as separate chunk | Vite worker.plugins configuration, ?worker&url import syntax, separate entry point |
| TS-05 | DTO pattern: embeddings excluded from public API responses | Type definitions with Omit<>, internal vs public type separation, src/internal/ folder pattern |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.6+ | Type-safe development | Maximum strictness catches errors early, excellent IDE support |
| Vite | 6.0+ | Build tool and dev server | Native ESM, fast HMR, library mode with Rollup integration |
| vite-plugin-dts | 4.0+ | TypeScript declaration generation | Automatic .d.ts generation, supports multiple entry points |
| Biome | 1.9+ | Linting and formatting | 10-100x faster than ESLint + Prettier, unified toolchain |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 2.0+ | Unit testing | Vite-native testing, happy-dom environment for DOM mocking |
| Playwright | 1.40+ | Integration testing | Real browser testing for worker and storage APIs |
| lint-staged | 15.0+ | Pre-commit hooks | Run Biome only on staged files |
| simple-git-hooks | 2.0+ | Git hooks management | Lightweight alternative to husky |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Biome | ESLint + Prettier | ESLint has more rules but slower; Prettier has wider adoption but conflicts with ESLint |
| Vite | Rollup directly | Rollup more configurable but requires manual setup for dev server and HMR |
| vite-plugin-dts | tsc --declaration | tsc slower, doesn't integrate with Vite build pipeline |
| simple-git-hooks | husky | husky more popular but heavier, more complex configuration |

**Installation:**
```bash
npm install -D typescript@^5.6.0 vite@^6.0.0 vite-plugin-dts@^4.0.0 biome@^1.9.0 vitest@^2.0.0 @types/node
npm install -D happy-dom@^15.0.0 playwright@^1.40.0 lint-staged@^15.0.0 simple-git-hooks@^2.0.0
```

---

## Architecture Patterns

### Recommended Project Structure
```
project-root/
├── src/
│   ├── index.ts              # Main public API entry
│   ├── types/                # Public type definitions
│   │   ├── index.ts          # Re-exports all types
│   │   ├── memory.ts         # Memory-related types
│   │   ├── api.ts            # Public API interfaces
│   │   └── events.ts         # Event/callback types
│   ├── core/                 # Core library logic
│   │   ├── client.ts         # Main MemoryClient class
│   │   └── config.ts         # Configuration handling
│   ├── worker/               # Web Worker code
│   │   ├── index.ts          # Worker entry point
│   │   ├── embedding.ts      # Embedding engine
│   │   ├── storage.ts        # Storage adapter
│   │   └── search.ts         # Vector search
│   ├── utils/                # Utility functions
│   │   ├── vectors.ts        # Vector math utilities
│   │   ├── decay.ts          # Decay calculations
│   │   └── validation.ts     # Input validation
│   └── internal/             # Internal-only modules
│       ├── types.ts          # Internal type extensions
│       └── helpers.ts        # Internal utilities
├── examples/                 # Example applications
│   └── react-app/            # React example with isolated deps
│       ├── package.json      # Own dependencies
│       └── vite.config.ts    # Own build config
├── dist/                     # Build output (gitignored)
├── tests/                    # Test suites
│   ├── unit/                 # Unit tests
│   └── integration/          # Integration tests
├── package.json              # Main package config
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite build configuration
├── biome.json                # Biome linting/formatting config
└── vitest.config.ts          # Vitest test configuration
```

### Pattern 1: Library Mode with Dual Output
**What:** Configure Vite to build both ESM and CJS formats for maximum compatibility
**When to use:** Publishing libraries for npm that need to support both modern (ESM) and legacy (CJS) consumers
**Example:**
```typescript
// Source: https://github.com/vitejs/vite/blob/main/docs/guide/build.md
// vite.config.ts
import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      include: ['src'],
      rollupTypes: true  // Single .d.ts file
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'LokulMem',
      formats: ['es', 'cjs'],  // Dual output
      fileName: (format) => `lokulmem.${format}.js`,
    },
    rollupOptions: {
      external: [],  // No external deps for browser library
      output: {
        sourcemap: true,
        preserveModules: false,  // Bundle for smaller size
      },
    },
    sourcemap: true,
    minify: 'terser',
  },
})
```

### Pattern 2: Worker as Separate Entry Point
**What:** Configure Vite to bundle worker code as a separate chunk that can be imported via ?worker&url
**When to use:** When worker code needs to be loaded dynamically and must be a separate file
**Example:**
```typescript
// Source: https://github.com/vitejs/vite/blob/main/docs/guide/features.md
// vite.config.ts
export default defineConfig({
  build: {
    lib: {
      entry: {
        main: resolve(__dirname, 'src/index.ts'),
        worker: resolve(__dirname, 'src/worker/index.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format}.js`,
    },
  },
  worker: {
    plugins: [],  // Plugins specific to worker builds
    format: 'es',  // Workers as ES modules
  },
})

// Usage in client code
import WorkerUrl from './worker/index.ts?worker&url'
const worker = new Worker(WorkerUrl, { type: 'module' })
```

### Pattern 3: Strict TypeScript Configuration
**What:** Maximum strictness with no implicit any, strict null checks, and explicit return types
**When to use:** Libraries where type safety is critical and public API must be fully typed
**Example:**
```typescript
// Source: https://github.com/microsoft/typescript/blob/main/tests/baselines/reference/tsconfigExtendsPackageJsonExportsWildcard.errors.txt
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "WebWorker"],

    // Maximum strictness
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,

    // Additional strictness
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,

    // Module handling
    "verbatimModuleSyntax": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,

    // Output
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "examples"]
}
```

### Pattern 4: DTO Pattern for Public API
**What:** Separate internal types from public DTOs, excluding implementation details like embeddings
**When to use:** When internal data structures contain non-serializable data (Float32Array) that shouldn't leak to consumers
**Example:**
```typescript
// src/internal/types.ts (internal only)
export interface MemoryInternal {
  id: string
  content: string
  embedding: Float32Array  // Internal only
  metadata: Record<string, unknown>
}

// src/types/memory.ts (public)
export interface MemoryDTO {
  id: string
  content: string
  metadata: Record<string, unknown>
  // Note: embedding excluded - internal implementation detail
}

// Conversion function (internal)
export function toDTO(internal: MemoryInternal): MemoryDTO {
  const { embedding, ...dto } = internal
  return dto
}
```

### Pattern 5: Package.json Exports Map
**What:** Modern package.json exports for clean subpath imports and type resolution
**When to use:** When library has multiple entry points (main, types, worker, react)
**Example:**
```json
{
  "name": "lokulmem",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/lokulmem.cjs.js",
  "module": "./dist/lokulmem.es.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/lokulmem.es.js"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/lokulmem.cjs.js"
      }
    },
    "./worker": {
      "import": "./dist/worker.es.js",
      "require": "./dist/worker.cjs.js"
    },
    "./react": {
      "import": {
        "types": "./dist/react/index.d.ts",
        "default": "./dist/react.es.js"
      },
      "require": {
        "types": "./dist/react/index.d.ts",
        "default": "./dist/react.cjs.js"
      }
    },
    "./package.json": "./package.json"
  },
  "sideEffects": false,
  "files": ["dist"]
}
```

### Anti-Patterns to Avoid
- **Default exports:** Use named exports only for better tree-shaking and IDE autocomplete
- **Barrel files with side effects:** Keep index.ts files pure, no initialization code
- **TypeScript path mapping:** Use relative imports to avoid resolution issues in built code
- **Implicit any:** Enable noImplicitAny and fix all implicit any types
- **Synchronous file operations:** Use async/await for all file system operations
- **Global type declarations:** Prefer explicit imports over global types

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type declaration generation | Custom tsc scripts | vite-plugin-dts | Integrates with Vite pipeline, handles watch mode, rollup support |
| Worker bundling | Manual worker string injection | Vite ?worker&url | Handles TypeScript transpilation, code splitting, source maps |
| Linting + formatting | Custom ESLint config | Biome | Unified toolchain, 10x faster, no config conflicts |
| Git hooks | Custom shell scripts | simple-git-hooks | Cross-platform, version controlled, lightweight |
| Type testing | Custom type assertion scripts | Vitest type testing | Built-in expectTypeOf and assertType utilities |
| Package exports | Single main field | Conditional exports | Clean subpath imports, ESM/CJS dual mode, type resolution |
| Build orchestration | Custom build scripts | Vite library mode | Optimized for libraries, handles externals, source maps |

**Key insight:** Build tooling has matured significantly. Custom scripts for type generation, worker bundling, or format conversion are error-prone and miss edge cases that dedicated tools handle automatically.

---

## Common Pitfalls

### Pitfall 1: Worker Bundling in Library Mode
**What goes wrong:** Workers fail to load in production because they're not properly externalized or bundled as separate chunks
**Why it happens:** Vite's development server handles workers differently than production builds; library mode changes chunking behavior
**How to avoid:**
- Use explicit worker entry point in build.lib.entry
- Configure worker.plugins separately from main plugins
- Test worker loading in both dev and production builds
- Use ?worker&url import syntax for explicit URL handling

**Warning signs:** Workers work in dev but 404 in production; worker code appears in main bundle; source maps don't resolve in worker

### Pitfall 2: Type Declaration Mismatches
**What goes wrong:** Consumers get "Cannot find module" or type resolution errors despite successful build
**Why it happens:** package.json exports don't align with actual file paths; declaration maps point to source that isn't published
**How to avoid:**
- Use vite-plugin-dts with rollupTypes: true for single declaration file
- Verify exports.import.types and exports.require.types point to same file
- Include declaration files in package.json files array
- Test with `npm pack` and install in fresh project

**Warning signs:** Types work in repo but fail in published package; IDE shows "any" for imports; declaration maps reference src/ folder

### Pitfall 3: ESM/CJS Interoperability
**What goes wrong:** Library works in ESM projects but fails in CJS with "require() of ES modules" error
**Why it happens:** Dual mode requires careful handling of default vs named exports; __esModule interop issues
**How to avoid:**
- Use named exports only (no default export)
- Set "type": "module" in package.json
- Provide both ESM and CJS builds with proper exports map
- Avoid mixing require and import in source

**Warning signs:** "Cannot require() ES Module" error; undefined default import in CJS; dual package hazard warnings

### Pitfall 4: TypeScript Path Mapping Resolution
**What goes wrong:** Builds succeed but runtime fails with "Cannot find module" for path aliases
**Why it happens:** TypeScript path mapping is compile-time only; bundler may not resolve the same way
**How to avoid:**
- Don't use path mapping (baseUrl/paths) in library projects
- Use relative imports exclusively
- If needed, use Vite resolve.alias for build-time resolution

**Warning signs:** Module resolution works in IDE but fails at runtime; "Cannot find module '@/types'" errors

### Pitfall 5: Verbatim Module Syntax Confusion
**What goes wrong:** Type error "cannot be compiled under '--isolatedModules'" or unexpected runtime behavior with imports
**Why it happens:** TypeScript elides type imports by default; verbatimModuleSyntax requires explicit type imports
**How to avoid:**
- Enable verbatimModuleSyntax in tsconfig.json
- Use `import type { Foo } from './types'` for type-only imports
- Use `import { type Foo, bar } from './module'` for mixed imports
- Configure Biome to enforce consistent type imports

**Warning signs:** Runtime errors about missing exports; type-only imports appearing in bundle; "cannot be compiled under '--isolatedModules'" errors

### Pitfall 6: Float32Array Serialization in Workers
**What goes wrong:** Embedding vectors fail to serialize when passing between main thread and worker
**Why it happens:** Float32Array doesn't serialize through structured clone in some contexts; DTO pattern not applied
**How to avoid:**
- Exclude Float32Array from public DTOs
- Convert to regular arrays for IPC
- Use DTO pattern consistently for all worker communication

**Warning signs:** DataCloneError when posting to worker; embeddings appear as empty objects after transfer; memory leaks from detached ArrayBuffers

---

## Code Examples

### Vite Configuration for Library with Worker
```typescript
// Source: https://github.com/vitejs/vite/blob/main/docs/guide/build.md
// Source: https://github.com/vitejs/vite/blob/main/docs/config/worker-options.md
// vite.config.ts
import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      include: ['src'],
      rollupTypes: true,
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: {
        main: resolve(__dirname, 'src/index.ts'),
        worker: resolve(__dirname, 'src/worker/index.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format}.js`,
    },
    rollupOptions: {
      external: [],
      output: {
        sourcemap: true,
        globals: {},
      },
    },
    sourcemap: true,
    minify: 'terser',
    target: 'es2020',
  },
  worker: {
    format: 'es',
    plugins: [],
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
})
```

### Biome Configuration
```typescript
// Source: https://context7.com/biomejs/biome/llms.txt
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "root": true,
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true,
    "defaultBranch": "main"
  },
  "files": {
    "includes": ["src/**/*.ts", "tests/**/*.ts"],
    "ignore": ["**/dist/**", "**/node_modules/**", "**/*.d.ts"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 80,
    "lineEnding": "lf"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "suspicious": {
        "noExplicitAny": "error"
      },
      "style": {
        "useConst": "warn",
        "useNamingConvention": {
          "level": "warn",
          "options": {
            "strictCase": false,
            "conventions": [
              {
                "selector": { "kind": "typeLike" },
                "formats": ["PascalCase"]
              },
              {
                "selector": { "kind": "function" },
                "formats": ["camelCase"]
              }
            ]
          }
        }
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": true
    }
  }
}
```

### Package.json with Exports
```json
{
  "name": "lokulmem",
  "version": "0.1.0",
  "description": "Browser-native LLM memory management library",
  "type": "module",
  "main": "./dist/main.cjs.js",
  "module": "./dist/main.es.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/main.es.js"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/main.cjs.js"
      }
    },
    "./worker": {
      "import": "./dist/worker.es.js",
      "require": "./dist/worker.cjs.js"
    },
    "./package.json": "./package.json"
  },
  "sideEffects": false,
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch",
    "watch": "vite build --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "clean": "rm -rf dist",
    "ci": "biome ci . && npm run typecheck && npm run test && npm run build"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "@types/node": "^20.0.0",
    "happy-dom": "^15.0.0",
    "lint-staged": "^15.0.0",
    "playwright": "^1.40.0",
    "simple-git-hooks": "^2.0.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vite-plugin-dts": "^4.0.0",
    "vitest": "^2.0.0"
  },
  "simple-git-hooks": {
    "pre-commit": "npx lint-staged"
  },
  "lint-staged": {
    "*.{js,ts,json,css}": [
      "biome check --write --no-errors-on-unmatched"
    ]
  }
}
```

### DTO Pattern Implementation
```typescript
// src/internal/types.ts
export interface MemoryInternal {
  id: string
  content: string
  embedding: Float32Array
  createdAt: number
  updatedAt: number
}

// src/types/memory.ts
export interface MemoryDTO {
  id: string
  content: string
  createdAt: number
  updatedAt: number
}

// src/internal/dto.ts
import type { MemoryInternal } from './types'
import type { MemoryDTO } from '../types/memory'

export function toMemoryDTO(internal: MemoryInternal): MemoryDTO {
  const { embedding, ...dto } = internal
  return dto
}

export function toMemoryDTOs(internals: MemoryInternal[]): MemoryDTO[] {
  return internals.map(toMemoryDTO)
}
```

### Worker Import Pattern
```typescript
// src/core/client.ts
// Import worker as URL for maximum bundler compatibility
import WorkerUrl from '../worker/index.ts?worker&url'

export class MemoryClient {
  private worker: Worker

  constructor() {
    this.worker = new Worker(WorkerUrl, { type: 'module' })
    this.worker.onmessage = this.handleMessage.bind(this)
  }

  private handleMessage(event: MessageEvent): void {
    // Handle worker messages
  }

  terminate(): void {
    this.worker.terminate()
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TSLint | Biome/ESLint | 2019-2023 | TSLint deprecated, Biome offers 10x speed |
| Rollup directly | Vite library mode | 2022+ | Vite uses Rollup for production, adds dev server |
| tsc --declaration | vite-plugin-dts | 2022+ | Integrated with Vite build pipeline, faster |
| Husky | simple-git-hooks | 2023+ | Lighter weight, simpler configuration |
| Jest | Vitest | 2021+ | Native ESM/TypeScript support, Vite integration |
| ESLint + Prettier | Biome | 2023+ | Unified toolchain, no config conflicts |

**Deprecated/outdated:**
- TSLint: Officially deprecated in 2019, use Biome or ESLint
- @rollup/plugin-typescript: Use vite-plugin-dts instead for Vite projects
- ts-node: Use Vitest for testing, Vite for builds
- Default exports: Use named exports for better tree-shaking

---

## Open Questions

1. **Bundle size vs. preserveModules**
   - What we know: preserveModules: true helps tree-shaking but increases file count
   - What's unclear: Optimal balance for this library's distribution
   - Recommendation: Start with bundled (preserveModules: false), measure impact

2. **Worker chunk naming in production**
   - What we know: Vite hashes worker chunks for cache busting
   - What's unclear: Whether static names are needed for certain deployment scenarios
   - Recommendation: Use default hashed names, document for consumers

3. **Type declaration rollup**
   - What we know: rollupTypes: true creates single .d.ts file
   - What's unclear: Whether this affects IDE autocomplete performance
   - Recommendation: Use rollupTypes for simplicity, test in VS Code

---

## Sources

### Primary (HIGH confidence)
- /vitejs/vite (Context7) - Library mode configuration, worker bundling, build options
- /microsoft/typescript (Context7) - Strict mode compiler options, tsconfig.json patterns
- /biomejs/biome (Context7) - Configuration schema, linting rules, formatter options
- https://github.com/vitejs/vite/blob/main/docs/guide/build.md - Official Vite library mode documentation
- https://github.com/vitejs/vite/blob/main/docs/guide/features.md - Worker import patterns
- https://github.com/vitejs/vite/blob/main/docs/config/worker-options.md - Worker configuration

### Secondary (MEDIUM confidence)
- /qmhc/unplugin-dts (Context7) - Alternative declaration generation approach
- Project skills: /Users/poak/Documents/personal-project/lokul-mind/.claude/skills/typescript/SKILL.md - Code style guidelines
- Project skills: /Users/poak/Documents/personal-project/lokul-mind/.claude/skills/vitest/SKILL.md - Testing patterns

### Tertiary (LOW confidence)
- None - all findings verified with Context7 or official documentation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified with Context7 and official docs
- Architecture: HIGH - Based on Vite official documentation and established patterns
- Pitfalls: HIGH - Documented in official Vite/TypeScript docs and project STATE.md

**Research date:** 2026-02-23
**Valid until:** 2026-05-23 (90 days for stable tooling)
