# Contributing to LokulMem 🤝

Thanks for taking the time to contribute! LokulMem is a **browser-native, zero-server, LLM-agnostic** memory layer. The project cares about **correctness, performance, transparency, and developer experience**.

---

## Ground rules (the non-negotiables)

When you contribute, please preserve these invariants:

1. **Local-first by default**
   - No hidden network calls for “core memory” behavior.
   - Remote model downloads are allowed only when explicitly configured (DX mode).

2. **LLM-agnostic API**
   - Public surfaces work with any chat-style `messages[]` format.
   - No provider-specific assumptions in core logic.

3. **Worker owns the heavy lifting**
   - Embeddings, vector search, and IndexedDB operations should run in the Worker when possible.
   - Main thread should stay responsive.

4. **DTO boundary is strict**
   - **Never** send embeddings over IPC by default.
   - Public API returns **MemoryDTO** (no `embedding`) unless explicitly requested.

5. **No silent fallbacks in airgap mode**
   - If `localModelBaseUrl` is set, missing assets must fail loudly with actionable errors.

If a change breaks an invariant, it needs a very strong justification and should be discussed first.

---

## Repo setup

### Requirements

- Node.js **18+** (20+ recommended)
- pnpm recommended (npm is OK)

### Install & build

```bash
pnpm install
pnpm build
```

### Run tests

```bash
pnpm test
```

### Run the demo (isolated workspace)

```bash
cd examples/react-app
pnpm install
pnpm dev
```

---

## Project structure (typical)

- `src/core/` – public API surface (`init`, `augment`, `learn`, `manage`)
- `src/ipc/` – MessageChannel RPC + event streaming
- `src/worker/` – worker entry, embedding runtime, storage, retrieval/extraction/lifecycle
- `src/utils/` – pure helpers (base64, math, etc.)
- `tests/` – unit + browser/integration tests
- `examples/` – isolated demo app(s)

---

## Development workflow

### 1) Create an issue first (recommended)

For bigger changes (API changes, schema changes, lifecycle scoring changes), open an issue describing:

- what you want to change
- why it improves correctness/DX/performance
- any risk to compatibility

### 2) Create a branch

```bash
git checkout -b feat/my-change
```

### 3) Make changes with tests

- Add unit tests for pure logic changes (math, scoring, serialization).
- Add browser/integration tests when behavior depends on workers, IndexedDB, or asset loading.

### 4) Validate packaging

Worker + ONNX assets are easy to accidentally drop from published builds. Before PR:

```bash
pnpm build
npm pack
tar -tf *.tgz | grep -E '(worker|ort-wasm)'
```

### 5) Submit a PR

Please include:

- a clear summary
- what changed and why
- screenshots for demo/UI changes
- perf notes if relevant (e.g. retrieval latency, memory footprint)

---

## Style & quality standards

### TypeScript

- `strict: true`
- Prefer explicit types for public APIs.
- Avoid `any`.
- DTOs should not include embeddings.

### Performance

- Hot loops (cosine similarity) should use `for` loops over `Float32Array`.
- Avoid repeated IndexedDB reads during retrieval; prefer a RAM cache where specified.

### Browser safety

- Don’t block the main thread with heavy work.
- Use Worker-side computation for embedding/vector search/maintenance.

---

## Tests

We aim for:

- High coverage on pure functions (decay, scoring, base64 encoding/decoding)
- Integration tests verifying:
  - init → learn → augment round-trip
  - data persistence across reload
  - worker instantiation and asset loading
  - airgap mode (local model path) behavior

If you add a new feature that touches Worker IPC, add an integration test for it.

---

## Versioning & compatibility

- Follow semver (`MAJOR.MINOR.PATCH`).
- Breaking public API changes must bump **major**.
- Export/import formats must be versioned and migration-safe.

---

## Security

If you believe you’ve found a security issue:

- Prefer creating a **private security advisory** on GitHub, if enabled.
- Otherwise, open an issue with minimal detail and ask maintainers for a private channel.

---

## License

By contributing, you agree that your contributions will be licensed under the project’s license (see `LICENSE`).

Thanks again — and welcome to LokulMem!
