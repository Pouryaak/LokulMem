# LokulMem 🧠⚡

<p align="center">
  <img alt="LokulMem banner" src="https://capsule-render.vercel.app/api?type=waving&color=gradient&height=220&section=header&text=LokulMem&fontSize=62&fontAlignY=38&desc=Browser-native%20AI%20memory%20layer%20%E2%80%94%20zero-server%20%E2%80%94%20LLM-agnostic&descAlignY=60&fontColor=fff" />
</p>

<p align="center">
  <b>Browser-native</b> • <b>Zero-server</b> • <b>LLM-agnostic</b> memory management for web AI
</p>

<p align="center">
  <a href="#-quickstart">Quickstart</a> •
  <a href="#-why-lokulmem">Why</a> •
  <a href="#-api">API</a> •
  <a href="#-configuration">Config</a> •
  <a href="#-airgap--offline">Airgap</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-export--import">Export/Import</a>
</p>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Strict-3178c6" />
  <img alt="Browser Native" src="https://img.shields.io/badge/Browser-Native-22c55e" />
  <img alt="Zero Server" src="https://img.shields.io/badge/Zero%20Server-Yes-22c55e" />
  <img alt="LLM Agnostic" src="https://img.shields.io/badge/LLM-Agnostic-f97316" />
  <img alt="IndexedDB" src="https://img.shields.io/badge/Storage-IndexedDB%20%2B%20Dexie-6366f1" />
  <img alt="Workers" src="https://img.shields.io/badge/Workers-MessageChannel-8b5cf6" />
  <img alt="Embeddings" src="https://img.shields.io/badge/Embeddings-MiniLM%20384d-0ea5e9" />
  <img alt="PRs Welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-16a34a.svg" />
</p>

---

## What is LokulMem?

**LokulMem** is a **local-first memory layer** you can drop into any browser AI:

- it **learns** durable facts from conversation turns,
- stores them in the browser (**IndexedDB**),
- **retrieves** the right memories on each prompt,
- and **injects** them into context within a token budget.

No backend. No vendor lock-in. Works with any LLM that accepts a `messages[]` array.

> It’s “RAG-like recall” + “memory lifecycle” (decay, pinning, contradiction history) + **transparent debugging**.

---

## ✨ Highlights

- **Runs entirely in the browser**: IndexedDB + Worker(s).
- **LLM-agnostic**: OpenAI / Anthropic / local WebLLM / anything with chat messages.
- **Memory lifecycle**: extract → store → decay/reinforce → retrieve → inspect/edit.
- **Contradiction resolution**: temporal updates vs conflicts, preserving lineage.
- **Token-aware injection**: uses your tokenizer (or a sensible fallback).
- **Inspectable by design**: optional debug output explains _why_ each memory was used.
- **DX-first defaults**: “fetch once, cache forever” model loading.
- **Airgap-ready**: strict local model loading via `localModelBaseUrl`.

---

## 🚀 Quickstart

### Install

```bash
npm i lokulmem
# or
pnpm add lokulmem
```

### Drop it into your chat loop

```ts
import { createLokulMem } from 'lokulmem';

// 1) Init once
const lokul = await createLokulMem({
  dbName: 'my-chat-app',
  extractionThreshold: 0.45,
});

// 2) Before calling your LLM
const { messages, debug } = await lokul.augment(
  "Hey, I'm Alex. I prefer dark mode.",
  history, // your existing ChatMessage[]
  {
    contextWindowTokens: 8192,
    reservedForResponseTokens: 1024,
    debug: true,
  },
);

// 3) Call any model/provider
const assistantText = await myLLM(messages);

// 4) After the response: learn from the turn
await lokul.learn(
  { role: 'user', content: "Hey, I'm Alex. I prefer dark mode." },
  { role: 'assistant', content: assistantText },
);

// Optional: inspect why memories were injected
console.log(debug);
```

---

## 🧩 Why LokulMem?

Most “memory layers” are server-first, framework-bound, or opaque.

LokulMem is for you if you want:

- **Privacy by architecture** (data stays on-device)
- **No backend** to deploy or secure
- A clean, library-shaped API that works with **any** model
- A memory system that users can **inspect, correct, pin, export, and delete**

---

## 🔧 API

LokulMem has three core surfaces:

### 1) `augment()` — retrieve + inject

Returns a new `messages[]` array plus optional debug metadata.

```ts
const { messages, debug } = await lokul.augment(userMessage, history, {
  contextWindowTokens: 8192,
  reservedForResponseTokens: 1024,
  debug: true,
});
```

### 2) `learn()` — extract + store

Extracts candidate memories from the last turn and writes them to IndexedDB.

```ts
const result = await lokul.learn(
  { role: 'user', content: userMessage },
  { role: 'assistant', content: assistantMessage },
);

console.log(result.extracted);
console.log(result.contradictions);
```

### 3) `manage()` — list/search/edit/pin/export

For UI panels and power users.

```ts
const m = lokul.manage();

const items = await m.list({ status: "active" }); // returns MemoryDTO (no embeddings)
await m.pin(items[0].id);

const exported = await m.export('json');
await m.clear();
await m.import(exported, 'merge');
```

---

## 🧾 Record vs DTO (performance boundary)

LokulMem uses a strict data boundary:

- **`MemoryRecord` (internal)** includes `embedding: Float32Array`.
- **`MemoryDTO` (public API)** omits embeddings entirely.

Why? Because typed arrays are expensive to structured-clone across IPC.

If you explicitly need embeddings (advanced), call APIs with `includeEmbedding: true` where supported.

---

## ⚙️ Configuration

```ts
const lokul = await createLokulMem({
  dbName: 'my-chat-app',
  workerUrl: undefined,
  onnxPaths: '/lokulmem/onnx/',
  localModelBaseUrl: undefined,
  extractionThreshold: 0.45,
  contextWindowTokens: 8192,
  reservedForResponseTokens: 1024,
  onProgress: (stage, progress) => console.log(stage, progress),
});
```

### Options

| Option                       |                              Type | Default | Notes |
| ---------------------------- | --------------------------------: | ------: | ----- |
| `dbName`                     |                          `string` | `lokulmem-default` | IndexedDB namespace |
| `workerType`                 |   `'auto'|'shared'|'dedicated'|'main'` | `auto` | Worker selection strategy |
| `workerUrl`                  |                          `string` | auto | Override worker script URL |
| `onnxPaths`                  | `string \| Record<string,string>` | — | Custom ONNX WASM asset paths |
| `localModelBaseUrl`          |                          `string` | — | Airgap/local model base path |
| `extractionThreshold`        |                          `number` | `0.45` | Global extraction floor |
| `contextWindowTokens`        |                          `number` | — | LLM context size for augment budget |
| `reservedForResponseTokens`  |                          `number` | `1024` | Response token reserve |
| `tokenCounter`               |                 `(text)=>number` | heuristic | Custom token counting |
| `onProgress`                 |      `(stage, progress)=>void` | — | Init progress callback |

---

## 🧊 Airgap / Offline

Default mode is **DX-first**: download the embedding model once and cache it.

To run in strict airgapped mode:

1. Host the model assets locally (mirroring the expected model layout)
2. Point LokulMem at your local base URL

```ts
const lokul = await createLokulMem({
  localModelBaseUrl: "/models/",
});
```

If assets are missing, LokulMem should fail loudly with an actionable error.

---

## 🏗️ Architecture

```mermaid
sequenceDiagram
  participant App as App (Main Thread)
  participant LM as LokulMem API
  participant W as Worker
  participant DB as IndexedDB (Dexie)

  App->>LM: augment(userMessage, history)
  LM->>W: RPC.retrieve(query)
  W->>DB: read active memories
  W-->>LM: formatted memory block + debug
  LM-->>App: new messages[]

  App->>LM: learn(userMessage, assistantMessage)
  LM->>W: RPC.extractAndStore(turn)
  W->>DB: write memories / update lineage
  W-->>LM: LearnResult
  LM-->>App: result
```

### Stores

- `memories` — durable facts (with embeddings)
- `episodes` — optional conversation segments
- `clusters` — k-means centroids (v0.1)
- `edges` — optional relationship links

---

## 🔍 Debug output

When `debug: true`, `augment()` returns:

- timings (embedding, retrieval, formatting)
- candidate list with score breakdown
- excluded reasons (low score, token budget, status)
- final injected memories with human-readable reasons

This is intentionally built so you can ship a **Memory Inspector** UI.

---

## 📦 Export / Import

- JSON export includes embeddings as **Base64** to survive JSON.stringify.
- Export metadata includes `version`, `schemaVersion`, `modelName`, `embeddingDims`.

```ts
const json = await lokul.manage().export('json');
await lokul.manage().clear();
await lokul.manage().import(json, 'merge');
```

---

## 🛠️ Development

```bash
pnpm install
pnpm build
pnpm test
```

### Memory eval gates (P0)

Run deterministic memory-quality evals locally:

```bash
npm run eval:memory:A
npm run eval:memory:B
npm run eval:memory:C
```

Gate policy:

- `A`: bring-up metrics, hard-fail only assistant contamination
- `B`: regression budget checks against `tests/evals/memory/baseline.json`
- `C`: absolute quality thresholds + regression checks

Current threshold targets:

- meaningful recall >= 0.90
- noise false positive <= 0.05
- assistant contamination == 0
- supersession correctness >= 0.90
- canonicalization accuracy >= 0.95
- entity-link accuracy >= 0.85
- temporal state accuracy >= 0.90
- policy decision accuracy >= 0.88

### Demo app (isolated workspace)

```bash
cd examples/react-app
pnpm install
pnpm dev
```

---

## 🧯 Troubleshooting

**Worker fails to load**

- Set `workerUrl` explicitly.
- Confirm the published package includes the worker chunk.

**ONNX WASM 404 / CSP blocked**

- Set `onnxPaths` to a valid local or hosted ORT asset path.
- Confirm `ort-wasm*.wasm` and `ort-wasm*.mjs` are being served.

**Airgap mode can’t find model**

- Confirm `localModelBaseUrl` is reachable.
- Confirm model files exist under that path.

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, development setup, and release checks.

---

## 📄 License

MIT — see [LICENSE](LICENSE).
