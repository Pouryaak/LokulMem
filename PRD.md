# LokulMem — Product Requirements Document

**Version:** 0.4 (Final — Approved for Build)
**Status:** Green Light — Start with v0.1
**Author:** Lokul Core Team
**Last Updated:** February 2026

**Changelog from v0.3:**

- `augment()` now returns optional debug object: injected memories, R scores, reasoning — the single highest-leverage addition for developer trust and memory panel transparency
- `manage()` API substantially expanded: event subscriptions, bulk operations, timeline, lineage, semantic search, related facts, pinning, conversation-source queries
- `pinned` field added to memory schema with retrieval priority and decay immunity
- `sourceConversationIds` added to memory schema — tracks all conversations that contributed to a memory
- `archived` surfaced explicitly as a status in manage() bulk operations
- `exportToMarkdown()` added alongside existing JSON export
- Rejection rationale documented for: reextractAll(), compact/merge, setRetentionPolicy, suggestCategory/Merge, validateFact, format helpers, importFromMarkdown, application-level useMemoryPanel hook
- Math tuning note added to implementation guidance — Ebbinghaus λ constants and extraction thresholds must be treated as empirically tunable, not fixed

---

## Table of Contents

1. [What Is LokulMem](#1-what-is-lokulmem)
2. [The Problem It Solves](#2-the-problem-it-solves)
3. [Non-Goals — Explicit Scope Boundaries](#3-non-goals--explicit-scope-boundaries)
4. [Design Philosophy](#4-design-philosophy)
5. [Architecture Overview](#5-architecture-overview)
6. [The Three Algorithmic Layers](#6-the-three-algorithmic-layers)
7. [Memory Types](#7-memory-types)
8. [The Public API](#8-the-public-api)
9. [Storage Schema](#9-storage-schema)
10. [Enhanced Features](#10-enhanced-features)
11. [Libraries — What to Use, What to Build, What to Skip](#11-libraries--what-to-use-what-to-build-what-to-skip)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Success Metrics](#13-success-metrics)
14. [Appendix — Mathematical Reference](#14-appendix--mathematical-reference)

---

## 1. What Is LokulMem

LokulMem is a **browser-native, zero-server, LLM-agnostic memory management library** for AI applications. It gives any LLM — running locally via WebGPU/WebLLM, or remotely via API — the ability to remember users across conversations, extract structured knowledge from dialogue, and retrieve contextually relevant memories at inference time.

LokulMem has no backend. It requires no API key. Everything — extraction scoring, embedding, storage, retrieval, decay — happens on the user's device, persisted to IndexedDB via Dexie.js, with embeddings computed by a quantised MiniLM model running in a SharedWorker (with automatic fallback) via Transformers.js.

**One sentence:** LokulMem is what memory would look like if it were built as an architectural property of the client rather than a feature of the server.

---

## 2. The Problem It Solves

### The Core Problem

Every LLM has a context window — a finite working memory it attends to at inference time. When a conversation ends, that window is gone. The next conversation starts from zero. This is not a model limitation. It is an infrastructure limitation. The model could use prior knowledge about the user if that knowledge existed in its context.

Standard RAG makes this worse, not better. It dumps text into a vector database and blindly retrieves based on similarity — no lifecycle, no decay, no contradiction handling, no understanding of time. Facts from two years ago score identically to facts from yesterday. Contradictions are silently overwritten. There is no way to inspect or trust what the system believes.

LokulMem solves the infrastructure problem correctly: persistent, queryable user knowledge with a full lifecycle — extracted, stored with decay, retrieved with composite relevance scoring, correctable by the user, and fully inspectable.

### Competitive Landscape

| Library         | Server Required | Cloud LLM Required | Browser Native | Full Lifecycle | Status   |
| --------------- | --------------- | ------------------ | -------------- | -------------- | -------- |
| Mem0            | ✓               | ✓ (OpenAI default) | ✗              | Partial        | Active   |
| LangMem         | ✓               | ✓ (LangGraph)      | ✗              | Partial        | Active   |
| A-MEM           | ✓               | ✓ (ChromaDB)       | ✗              | ✗              | Research |
| MemOS           | ✓               | ✓ (Redis)          | ✗              | ✗              | Active   |
| railroad-memory | ✗               | ✗                  | Partial        | ✗              | Active   |
| EntityDB        | ✗               | ✗                  | ✓              | ✗              | Active   |
| **LokulMem**    | **✗**           | **✗**              | **✓**          | **✓**          | Building |

**railroad-memory** is the closest conceptual neighbour — a client-side context memory library with hierarchical tiers, pruning, and custom storage adapters. It does not implement browser-native embeddings, has no decay model, no contradiction resolution, no episodic or proactive memory. It manages context window selection; LokulMem manages the full lifecycle of persistent user knowledge.

**EntityDB** is browser-native vector storage — good plumbing, not a memory management system. No extraction, no decay, no contradiction handling.

The full browser-native LLM memory lifecycle layer — typed extraction, mathematical decay, contradiction audit trail, episodic memory, proactive injection, user-inspectable and correctable — is unoccupied.

---

## 3. Non-Goals — Explicit Scope Boundaries

The following are explicitly out of scope at all versions unless a separate PRD is written. Contributors and developers should treat this list as immovable without a new PRD.

**Cross-device sync** — Intentionally device-local. If a user wants memories on two devices, they export from one and import to the other.

**Multi-user or shared memory** — One user per store instance. No collaborative or team memory.

**Server replication or backup** — No cloud backup, no remote copy. The user owns their data.

**Real-time collaboration** — No merge protocol for two users sharing a memory store.

**Mobile SDK** — Targets browsers. React Native, Swift, Kotlin are out of scope.

**Non-browser JavaScript runtimes** — Node.js, Deno, Bun, Cloudflare Workers are out of scope. The library depends on browser APIs (IndexedDB, SharedWorker, Web Crypto, navigator.storage) that do not exist in server runtimes.

**LLM fine-tuning or training** — LokulMem injects memories into context. It does not use memories to train or fine-tune models.

**General-purpose semantic search API** — Vector search is internal infrastructure for memory retrieval, not a public search product.

**Application-level UI state management** — The library exposes data and events. Applications build their own UI state (selected items, search query string, active filters) on top. The library does not own UI state.

**Re-extraction from conversation history** — The library does not store raw conversations. It stores extracted facts. Applications that want to re-extract must call `learn()` on their own stored messages. `reextractAll()` is out of scope.

**Bulk fact merging / deduplication engine** — `compact()` and `mergeFacts()` are out of scope for v0.1. The decay system handles gradual compaction automatically. Pairwise similarity across all memories is O(N²) without careful indexing. Deferred until real user data shows it is needed.

**AI-powered fact suggestions** — `suggestCategory()` and `suggestMerge()` require the library to make AI calls or run inference internally. Out of scope. The extraction classifier handles categorisation at write time.

**Markdown import** — Parsing arbitrary Markdown back into structured memories is a non-trivial NLP problem with no reliable round-trip guarantee. `exportToMarkdown()` is one-way. Import is JSON only.

**Fact formatting helpers** — `formatFactForDisplay()`, `formatFactForEdit()` are application-level concerns. Out of scope.

**Retention policy engine** — `setRetentionPolicy()` (max age, max facts, min confidence pruning) is deferred to v0.2. The Ebbinghaus decay model already handles the `minConfidence` case automatically.

---

## 4. Design Philosophy

### Privacy by Architecture

LokulMem cannot leak user data because it has nowhere to send it. The constraint is architectural, not policy-based. No API key. No telemetry. The memory store is as private as the user's local file system.

### Inspectability and Trust

A memory system nobody can inspect is a memory system nobody will trust. Every decision LokulMem makes — what it stored, why it retrieved it, what score it gave — must be queryable. The `debug` return from `augment()`, the lineage API, the injection preview — these are not nice-to-haves. They are what turns a clever library into infrastructure people bet their products on.

### LLM Agnosticism

LokulMem communicates through a standard messages interface. If your LLM takes `{role, content}[]`, LokulMem works with it.

### Minimal Surface Area on Core API

Three primary methods: `augment()`, `learn()`, `manage()`. Integration in under 10 minutes. Complexity lives inside the library.

### Math Is Empirical, Not Axiomatic

The Ebbinghaus λ constants, the 0.45 extraction threshold, the 0.80 contradiction similarity threshold — these are informed starting points, not laws. Real-world LLM embeddings are fuzzy. User dialogue is messier than any synthetic test. Every numerical constant in this PRD must be treated as a configurable default that will require tuning during alpha testing. Build the weights as easily adjustable variables from day one. Expect to change most of them.

### Don't Reinvent Solved Problems

Dexie.js for IndexedDB. Transformers.js for embeddings. Purpose-built minimal HNSW for vector search at scale. The novel contribution is the memory lifecycle layer. That is where we build. The rest we compose.

---

## 5. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        APPLICATION                           │
│            (Lokul, any WebLLM app, any LLM app)             │
└─────────────────────────┬───────────────────────────────────┘
                           │ main thread
                    ┌──────▼──────┐
                    │  LokulMem   │
                    │   API       │
                    │ augment()   │  ← returns messages + optional debug
                    │ learn()     │  ← returns extracted + events
                    │ manage()    │  ← full panel API surface
                    └──────┬──────┘
                           │ postMessage / MessageChannel
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐
   │  EXTRACTION │  │  RETRIEVAL  │  │ MANAGEMENT  │
   │   LAYER     │  │   LAYER     │  │   LAYER     │
   └──────┬──────┘  └──────┬──────┘  └─────┬──────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
         ┌─────────────────▼─────────────────┐
         │         WORKER LAYER               │
         │  ┌─────────────────────────────┐   │
         │  │  EMBEDDING ENGINE           │   │
         │  │  MiniLM-L6-v2 (quantised)  │   │
         │  │  Transformers.js / WASM     │   │
         │  │  LRU cache (1,000 entries)  │   │
         │  └─────────────────────────────┘   │
         │  ┌─────────────────────────────┐   │
         │  │  VECTOR SEARCH              │   │
         │  │  Brute force (N ≤ 3,000)   │   │
         │  │  Minimal HNSW (N > 3,000)  │   │
         │  └─────────────────────────────┘   │
         │                                     │
         │  Fallback detection (main thread):  │
         │  1. SharedWorker  (preferred)       │
         │  2. Worker        (Chrome Android)  │
         │  3. Main thread   (last resort)     │
         └─────────────────┬───────────────────┘
                           │
                    ┌──────▼──────┐
                    │   STORAGE   │
                    │  IndexedDB  │
                    │  (Dexie.js) │
                    └─────────────┘
```

### Worker Mode Detection and Fallback

Runs on the **main thread** during `init()` — before the worker is spawned and before any IndexedDB operations. `navigator.storage.persist()` is also called here. Both are impossible inside a Worker context.

```typescript
async function detectWorkerMode(): Promise<
  "shared" | "dedicated" | "main-thread"
> {
  if (typeof SharedWorker !== "undefined") return "shared";
  if (typeof Worker !== "undefined") return "dedicated";
  return "main-thread";
}
```

| Mode             | Multi-tab safe | Blocks UI | Availability                          |
| ---------------- | -------------- | --------- | ------------------------------------- |
| SharedWorker     | ✓              | ✗         | Desktop Chrome, Firefox, Safari, Edge |
| Dedicated Worker | ✗ (per-tab)    | ✗         | Chrome Android, broad                 |
| Main thread      | ✗              | ✓         | Universal fallback                    |

Console warnings in non-SharedWorker modes:

```
[LokulMem] SharedWorker not available. Running in dedicated Worker mode.
Multi-tab synchronisation disabled. Memory writes from multiple tabs
may conflict. Consider limiting to single-tab usage.

[LokulMem] Worker not available. Running on main thread.
Embedding operations will block the UI. Not recommended for production.
```

Non-SharedWorker risk is duplicate maintenance sweeps, not data corruption. Dexie.js transaction locking prevents corruption in all modes.

---

## 6. The Three Algorithmic Layers

### Layer 1 — Extraction: What Is Worth Remembering?

After each exchange, every sentence in the user's message is scored using three signals.

#### Signal 1: Novelty Score

```
novelty(s) = 1 - top1_similarity(s)
```

Routed through the existing retrieval backend (top-1 query). Not a separate O(N) loop. O(log N) when HNSW is active. If store is empty: `novelty(s) = 1.0`.

#### Signal 2: Specificity Score

```
specificity(s) = min(1.0, Σ weights[feature] for feature in detected_features(s))
```

Lightweight NER — regex + static lookup table (~300 lines). No LLM call.

| Feature                                              | Weight |
| ---------------------------------------------------- | ------ |
| Proper noun — person name                            | 0.30   |
| Proper noun — place or organisation                  | 0.25   |
| Numerical value                                      | 0.20   |
| Explicit preference ("I prefer", "I like", "I hate") | 0.25   |
| Date or time reference                               | 0.20   |
| Negation of preference ("I don't", "I never")        | 0.20   |
| First-person possession ("my", "mine")               | 0.10   |

#### Signal 3: Recurrence Weight

```
recurrence(s) = min(1.0, 0.2 + (0.25 × occurrences(s)))
```

Where `occurrences(s)` = past sentences in session with cosine similarity > 0.85 to `s`. Max at 4 occurrences.

#### Combined Extraction Score

```
E(s) = α × novelty(s) + β × specificity(s) + γ × recurrence(s)
```

**Default weights:** α = 0.35, β = 0.45, γ = 0.20
**Default threshold:** E(s) ≥ 0.45

**Important:** These are starting points. Expect to tune aggressively during alpha. Real dialogue is noisier than synthetic tests. The threshold and weights must be easily adjustable in init options and should be the first things changed when extraction quality is wrong.

---

#### Contradiction Detection — Three-Stage Pipeline

**Stage 1 — Candidate Match**

```
top1_similarity(new_fact) > 0.80
```

Uses same retrieval backend. No extra scan.

**Stage 2 — Temporal Marker Detection**

```typescript
const temporalMarkers = [
  "used to",
  "previously",
  "before",
  "anymore",
  "no longer",
  "not anymore",
  "now i",
  "these days",
  "switched to",
  "moved to",
  "changed to",
  "lately",
  "recently started",
  "stopped",
  "quit",
  "gave up",
];
```

If detected: existing fact gets `validTo = now`. New fact stored with `validFrom = now` and `temporalSupersedes` reference. Both preserved — history, not snapshot.

**Stage 3 — Typed Attribute Conflict**

If no temporal marker and similarity > 0.80:

```
conflict = same_entity AND same_attribute_type AND different_value AND no_temporal_marker
```

On confirmed conflict: existing → `status: superseded`. New → `status: active`. Event emitted. Nothing silently deleted.

| Scenario                               | Temporal marker? | Result                           |
| -------------------------------------- | ---------------- | -------------------------------- |
| "I live in London" (was: Berlin)       | No               | Conflict — Berlin superseded     |
| "I used to live in Berlin, now London" | Yes              | Coexistence — Berlin validTo set |
| "I prefer dark mode" (was: light mode) | No               | Conflict — light mode superseded |
| "I'm no longer at Acme Corp"           | Yes              | Coexistence — Acme validTo set   |

**Important:** The 0.80 similarity threshold for contradiction candidates will likely need tuning. Too high: misses real contradictions. Too low: false positives on unrelated but embedding-similar statements. Tune during alpha.

---

### Layer 2 — Storage: Decay and Persistence

#### Ebbinghaus Forgetting Curve

```
strength(t) = base_strength × e^(-λ × Δt_hours)
```

| Category                       | λ      | Half-life |
| ------------------------------ | ------ | --------- |
| Identity (name, age, pronouns) | 0.0001 | ~289 days |
| Location                       | 0.0005 | ~58 days  |
| Profession / Role              | 0.0003 | ~96 days  |
| Preferences                    | 0.001  | ~29 days  |
| Current project                | 0.005  | ~6 days   |
| Temporal context               | 0.02   | ~35 hours |
| Relational (people)            | 0.0004 | ~72 days  |
| Emotional state                | 0.01   | ~3 days   |

**Important:** These λ values are informed estimates. A user who mentions their project every day will have different effective decay behaviour than a user who chats weekly. Monitor during alpha and adjust.

**Pinned memories:** `pinned: true` memories have `λ = 0` — they never decay. They get retrieval priority. They are excluded from automatic pruning. The user must explicitly unpin or delete them.

**Reinforcement:**

```
base_strength = min(3.0, base_strength + 0.3)  // on each retrieval
```

**Emotional valence boost:**
Memories with `|valence| > 0.6` start at `base_strength = 1.2`.

**Pruning:**
`strength(t) < 0.1` → `status: faded`. Retained 30 days. Then permanently deleted.

#### Semantic Clustering

K-means in worker. Dynamic K:

```
K = max(3, floor(√(total_active_memories / 2)))
```

Uses stored embeddings. Runs at session start if > 10 new memories since last run. Cluster members get +0.05 retrieval bonus.

---

### Layer 3 — Retrieval: What Gets Injected?

#### Vector Search Routing

```
N ≤ hnswThreshold (default: 3000) → brute_force_cosine_search()
N > hnswThreshold                 → minimal_hnsw_search()
```

HNSW loads lazily. Zero cost until threshold crossed. Both paths return the same interface.

#### Composite Relevance Score

```
R(m, q) = w1 × semantic_sim(m, q)
         + w2 × temporal_recency(m)
         + w3 × memory_strength(m)
         + w4 × conversation_continuity(m, recent_turns)
```

Default weights: w1 = 0.40, w2 = 0.20, w3 = 0.25, w4 = 0.15. All configurable.

Pinned memories: `w3` component set to 1.0 regardless of actual strength.

```
semantic_sim(m, q)   = cosine_similarity(embed(m.content), embed(q))
temporal_recency(m)  = e^(-0.005 × hours_since_created(m))
memory_strength(m)   = strength(t) / 3.0
continuity(m, turns) = max(cosine_similarity(embed(m.content), embed(t)) for t in last_3_turns)
```

#### Token-Aware Dynamic K

```typescript
tokenCounter?: (text: string) => number  // provide your LLM's tokenizer
// fallback: Math.ceil(text.length / 4)  // adequate for Latin scripts, underestimates code/CJK

available_tokens = context_window_size - system_prompt_tokens - history_tokens - response_buffer
K = floor(available_tokens / avg_tokens_per_candidate)
```

Do not use the MiniLM tokenizer from the SharedWorker. MiniLM uses WordPiece; most LLMs use BPE or SentencePiece. Token counts differ meaningfully. Always provide your LLM's tokenizer via `tokenCounter` for accurate budgeting.

#### Injection Format — v0.1

`prepend-system` only in v0.1. v0.2 adds `injectionMode` option.

```
[Memory Context — what you know about this user]
• 📌 Alex is a product manager at a Series B startup in Berlin. (pinned)
• Alex prefers concise answers and bullet points. (confidence: high)
• Alex is currently preparing a board presentation. (confidence: medium)
• Alex mentioned their co-founder is Maya. (confidence: medium)
• Alex seems to be under time pressure this week. (confidence: low — inferred)
[End Memory Context]
```

Confidence mapping: High = `base_strength ≥ 1.5` + explicitly stated. Medium = `base_strength ≥ 0.8` or stated once. Low = inferred.

---

## 7. Memory Types

Seven defaults. Extensible. Multiple types per memory allowed.

| Type         | Description             | Examples                | λ      |
| ------------ | ----------------------- | ----------------------- | ------ |
| `identity`   | Who the user is         | Name, age, pronouns     | 0.0001 |
| `location`   | Where they are          | City, country, timezone | 0.0005 |
| `profession` | What they do            | Job title, employer     | 0.0003 |
| `preference` | How they like things    | Tone, format, style     | 0.001  |
| `project`    | What they're working on | Tasks, goals, deadlines | 0.005  |
| `temporal`   | Time-sensitive context  | "This week", deadlines  | 0.02   |
| `relational` | People in their life    | Names, relationships    | 0.0004 |
| `emotional`  | How they're feeling     | Stress, excitement      | 0.01   |

Custom types:

```typescript
customTypes: [
  { name: "medical", decayLambda: 0.00005 },
  { name: "financial", decayLambda: 0.002 },
];
```

---

## 8. The Public API

### Installation

```bash
npm install lokulmem
```

### Initialisation

```typescript
import { LokulMem } from 'lokulmem'

const memory = new LokulMem({
  // Storage
  storage: 'indexeddb' | 'memory',
  storeName: 'lokulmem_default',

  // Embedding
  embedder: 'minilm',             // or custom EmbedderInterface

  // Extraction — tune these during alpha
  extractionThreshold: 0.45,      // lower = more extracted, higher = stricter
  extractionWeights: { novelty: 0.35, specificity: 0.45, recurrence: 0.20 },

  // Retrieval — tune these during alpha
  contextWindowSize: 4096,
  responseBuffer: 512,
  retrievalWeights: { semantic: 0.40, recency: 0.20, strength: 0.25, continuity: 0.15 },
  hnswThreshold: 3000,

  // Token budgeting — always provide for accuracy
  tokenCounter: (text: string) => number,

  // Decay
  decayModel: 'ebbinghaus' | 'linear' | 'none',

  // Custom types
  customTypes: CustomTypeDefinition[],

  // Encryption (v0.3)
  encryptionPassphrase?: string,
  keyStorage?: 'session' | 'local' | 'none',  // default: 'none'

  // Callbacks
  onMemoryAdded: (memory: Memory) => void,
  onMemoryUpdated: (memory: Memory) => void,
  onMemoryDeleted: (id: string) => void,
  onMemoryFaded: (memory: Memory) => void,
  onContradictionDetected: (existing: Memory, incoming: Memory, resolution: 'conflict' | 'temporal-coexistence') => void,
  onStatsChanged: (stats: MemoryStats) => void,
  onStoragePersistDenied: () => void,
  onProgress: (event: { stage: 'worker' | 'model' | 'storage' | 'maintenance' | 'ready', progress: number }) => void,
})

await memory.init()
// Main thread sequence:
// 1. Detect worker mode
// 2. navigator.storage.persist() — main thread, before worker spawn
// 3. Spawn/connect worker
// 4. Load MiniLM model
// 5. Connect Dexie.js, run migrations
// 6. Maintenance sweep (decay pruning, clustering)
// 7. Proactive scan (v0.2+)
// 8. Resolve ready
```

---

### `memory.augment(message, history, options?)`

```typescript
const result = await memory.augment(
  userMessage: string,
  history: Message[],
  options?: {
    maxMemories?: number,
    minRelevance?: number,
    types?: string[],
    includeEpisodes?: boolean,       // v0.2+
    includeProactive?: boolean,      // v0.2+
    debug?: boolean,                 // return LokulMemDebug alongside messages
  }
): Promise<AugmentResult>

interface AugmentResult {
  messages: Message[]           // augmented messages array — pass directly to LLM
  debug?: LokulMemDebug         // only populated when options.debug = true
}

interface LokulMemDebug {
  injected: InjectedMemory[]        // what was injected and why
  candidates: ScoredMemory[]        // all memories considered (top 20)
  episodeInjected?: Episode         // episode injected if any (v0.2+)
  proactiveInjected?: Memory[]      // proactive memories injected (v0.2+)
  tokensUsed: number                // tokens consumed by memory context
  tokensAvailable: number           // tokens available before injection
  retrievalStrategy: 'brute-force' | 'hnsw'
  embeddingLatencyMs: number
  retrievalLatencyMs: number
}

interface InjectedMemory {
  memory: Memory
  score: number                     // composite R score
  scoreBreakdown: {
    semantic: number                // w1 component
    recency: number                 // w2 component
    strength: number                // w3 component
    continuity: number              // w4 component
  }
  reason: string                    // human-readable: "high semantic match + recently reinforced"
  injectionRank: number             // 1 = most relevant
}

interface ScoredMemory {
  memory: Memory
  score: number
  injected: boolean                 // false if below threshold or budget
  excludedReason?: string           // "below relevance threshold" | "token budget exhausted" | "type filtered"
}
```

**This is the most important addition in v0.4.** When `debug: true`:

- Developers can see exactly what LokulMem injected and why
- The memory panel can show "what Lokul knew when you sent this message"
- Tuning the extraction threshold and retrieval weights becomes empirical rather than guesswork
- Trust is built through transparency, not marketing

---

### `memory.learn(userMessage, assistantResponse, options?)`

```typescript
const result = await memory.learn(
  userMessage: string,
  assistantResponse: string,
  options?: {
    sessionId?: string,
    forceExtract?: boolean,
    skipTypes?: string[],
  }
): Promise<LearnResult>

interface LearnResult {
  extracted: Memory[]
  contradictions: ContradictionEvent[]
  faded: Memory[]
  totalMemories: number
}

interface ContradictionEvent {
  existing: Memory
  incoming: Memory
  resolution: 'conflict' | 'temporal-coexistence'
  temporalMarkerDetected?: string   // the marker that triggered coexistence path
}
```

---

### `memory.manage()` — Full Panel API

```typescript
const mgmt = memory.manage();
```

#### Querying

```typescript
// List with filters
await mgmt.list(filter?: {
  type?: string | string[],
  status?: 'active' | 'faded' | 'superseded' | 'archived',
  minStrength?: number,
  pinned?: boolean,
  since?: number,              // Unix ms — memories created after this timestamp
  until?: number,
  limit?: number,
  offset?: number,
  orderBy?: 'createdAt' | 'lastAccessedAt' | 'strength' | 'mentionCount',
  direction?: 'asc' | 'desc',
}): Promise<Memory[]>

// Single memory
await mgmt.get(id: string): Promise<Memory>

// Memories from a specific conversation
await mgmt.getByConversation(conversationId: string): Promise<Memory[]>

// Most recently accessed
await mgmt.getRecent(limit?: number): Promise<Memory[]>

// Highest strength / most reinforced
await mgmt.getTop(limit?: number): Promise<Memory[]>

// Pinned memories
await mgmt.getPinned(): Promise<Memory[]>

// Full-text search (searches content strings)
await mgmt.search(query: string): Promise<Memory[]>

// Semantic search (embedding-based — uses vector search infrastructure)
await mgmt.semanticSearch(query: string, limit?: number): Promise<Memory[]>

// Related memories (first-degree graph neighbours — v0.2+)
await mgmt.getRelated(memoryId: string): Promise<Memory[]>

// Timeline — memories grouped by date of creation
await mgmt.getTimeline(): Promise<Array<{
  date: string,                // ISO date string 'YYYY-MM-DD'
  memories: Memory[],
}>>

// Grouped for display — pre-organised for UI rendering
await mgmt.getGrouped(): Promise<{
  pinned: Memory[],
  identity: Memory[],
  location: Memory[],
  profession: Memory[],
  preferences: Memory[],
  projects: Memory[],
  temporal: Memory[],
  relational: Memory[],
  emotional: Memory[],
  custom: Record<string, Memory[]>,   // developer-defined types
  recent: Memory[],                   // last 10 regardless of type
}>

// Full lineage of a memory — history, sources, supersession chain
await mgmt.getLineage(memoryId: string): Promise<{
  memory: Memory,
  sourceConversations: string[],  // all conversation IDs that contributed
  supersedes: Memory | null,      // memory this one replaced (if conflict)
  supersededBy: Memory | null,    // memory that replaced this one
  temporalHistory: Memory[],      // all temporal coexistence versions
  reinforcementCount: number,     // how many times this was retrieved and reinforced
}>

// Preview what augment() would inject for a given message
// Without running inference — useful for memory panel "preview" feature
await mgmt.getInjectionPreview(
  userMessage: string,
  options?: { types?: string[], maxMemories?: number }
): Promise<{
  wouldInject: InjectedMemory[],
  estimatedTokens: number,
}>
```

---

#### Mutations

```typescript
// Update content or metadata (user correction)
await mgmt.update(id: string, patch: {
  content?: string,
  types?: string[],
  confidence?: 'high' | 'medium' | 'low',
}): Promise<Memory>

// Pin / unpin
await mgmt.pin(id: string): Promise<Memory>
await mgmt.unpin(id: string): Promise<Memory>

// Archive (soft delete — excluded from retrieval, retained in history)
await mgmt.archive(id: string): Promise<Memory>
await mgmt.unarchive(id: string): Promise<Memory>

// Permanent delete
await mgmt.delete(id: string): Promise<void>

// Full reset
await mgmt.clear(): Promise<void>

// Bulk operations (for manage-mode multi-select UI)
await mgmt.deleteMany(ids: string[]): Promise<void>
await mgmt.archiveMany(ids: string[]): Promise<void>
await mgmt.pinMany(ids: string[]): Promise<void>
await mgmt.unpinMany(ids: string[]): Promise<void>
```

---

#### Analytics

```typescript
await mgmt.stats(): Promise<MemoryStats>

interface MemoryStats {
  total: number,
  active: number,
  faded: number,
  archived: number,
  superseded: number,
  pinned: number,
  byType: Record<string, number>,
  averageStrength: number,
  averageConfidence: number,
  confidenceDistribution: { high: number, medium: number, low: number },
  strengthDistribution: { strong: number, medium: number, weak: number },
  mostMentioned: Memory[],          // top 5 by mentionCount
  recentlyUpdated: Memory[],        // last 5 updated
  recentlyFaded: Memory[],          // last 5 that faded
  oldestMemory: Memory | null,
  newestMemory: Memory | null,
  storageUsedBytes: number,
  conversationCount: number,        // distinct conversation IDs across all memories
}
```

---

#### Export and Import

```typescript
// Export — portable JSON, re-importable
await mgmt.export(): Promise<{
  version: string,
  exportedAt: number,
  storeName: string,
  memories: Memory[],
  episodes: Episode[],
  clusters: Cluster[],
  edges: Edge[],
}>

// Export as Markdown — one-way, human-readable, not re-importable
await mgmt.exportToMarkdown(): Promise<string>
// Format:
// # LokulMem Export — [date]
// ## Identity
// - **Alex** — Product manager at Series B startup in Berlin *(high confidence)*
// ## Preferences
// - Prefers concise answers and bullet points *(high confidence)*
// ...

// Import from JSON
await mgmt.import(data: ExportData, options?: {
  merge?: boolean,                      // default: false (replaces)
  conflictStrategy?: 'keep-existing' | 'use-imported' | 'keep-newer',
}): Promise<{ imported: number, skipped: number, conflicts: number }>
```

---

#### Event Subscriptions (for reactive UI)

```typescript
// Subscribe to memory lifecycle events
// All return an unsubscribe function

const unsub1 = mgmt.onMemoryAdded((memory: Memory) => {
  // Update UI — new memory card, increment stats
});

const unsub2 = mgmt.onMemoryUpdated((memory: Memory) => {
  // Update specific memory card
});

const unsub3 = mgmt.onMemoryDeleted((id: string) => {
  // Remove memory card from UI
});

const unsub4 = mgmt.onMemoryFaded((memory: Memory) => {
  // Show "faded" indicator or remove from active list
});

const unsub5 = mgmt.onStatsChanged((stats: MemoryStats) => {
  // Update stats panel, counters, category breakdown
});

const unsub6 = mgmt.onContradictionDetected((event: ContradictionEvent) => {
  // Optionally surface in UI: "Lokul noticed a change"
});

// Cleanup on component unmount
unsub1();
unsub2();
unsub3();
unsub4();
unsub5();
unsub6();
```

---

### React Hook (v0.2)

The library ships a minimal `useMem()` hook. Applications build their own panel hooks on top.

```typescript
import { useMem } from "lokulmem/react";

// Library-level hook — raw data and core actions
function useMem(options: LokulMemOptions): {
  memories: Memory[]; // reactive — updates on every learn() or manage mutation
  stats: MemoryStats; // reactive — updates on every mutation
  isReady: boolean; // false during init()
  error: Error | null;
  augment: typeof memory.augment;
  learn: typeof memory.learn;
  manage: typeof memory.manage;
};

// Application builds panel-specific hooks on top:
// function useMemoryPanel() {
//   const { memories, stats, manage } = useMem(config)
//   const [selectedIds, setSelectedIds] = useState(new Set())
//   const [searchQuery, setSearchQuery] = useState('')
//   const [activeType, setActiveType] = useState('all')
//   // ... application UI state
// }
```

---

### Integration Examples

```typescript
// ── WebLLM — browser, local WebGPU ──────────────────────────────────────
import { CreateMLCEngine } from "@mlc-ai/web-llm";
import { LokulMem } from "lokulmem";

const engine = await CreateMLCEngine("Qwen2.5-1.5B-Instruct-q4f32_1-MLC");
const memory = new LokulMem({
  storeName: "lokul-user",
  contextWindowSize: 4096,
  onProgress: ({ stage, progress }) => updateLoadingUI(stage, progress),
  onMemoryAdded: (m) => refreshMemoryPanel(),
  onStatsChanged: (s) => updateStatsPanel(s),
});
await memory.init();

async function chat(userMessage, history) {
  const { messages, debug } = await memory.augment(userMessage, history, {
    debug: true,
  });
  console.log("Injected memories:", debug.injected); // inspect what Lokul knows

  const reply = await engine.chat.completions.create({ messages });
  const response = reply.choices[0].message.content;

  const { extracted } = await memory.learn(userMessage, response);
  console.log("Learned:", extracted);

  return response;
}

// ── OpenAI ───────────────────────────────────────────────────────────────
import OpenAI from "openai";
import { encoding_for_model } from "tiktoken";

const enc = encoding_for_model("gpt-4o");
const memory = new LokulMem({
  storeName: "openai-user",
  contextWindowSize: 128000,
  tokenCounter: (text) => enc.encode(text).length, // accurate GPT-4o tokenizer
});
await memory.init();

// ── Anthropic ─────────────────────────────────────────────────────────────
import Anthropic from "@anthropic-ai/sdk";

const memory = new LokulMem({
  storeName: "anthropic-user",
  contextWindowSize: 200000,
});
await memory.init();

// ── Ollama ────────────────────────────────────────────────────────────────
const memory = new LokulMem({
  storeName: "ollama-user",
  contextWindowSize: 8192,
});
await memory.init();
```

---

## 9. Storage Schema

### Dexie.js Object Stores

#### `memories`

```typescript
interface Memory {
  id: string; // UUID v4
  content: string; // Natural language fact sentence
  types: string[]; // Multiple types per memory

  // Embedding
  embedding: number[]; // 384-dim float32

  // Cluster assignment
  clusterId: string | null;

  // Strength, confidence, importance
  baseStrength: number; // 1.0 at creation → max 3.0 via reinforcement
  confidence: "high" | "medium" | "low";
  extractionScore: number; // E(s) at extraction time
  emotionalValence: number; // -1.0 to 1.0
  mentionCount: number; // times retrieved and reinforced

  // Pinning
  pinned: boolean; // default false; pinned = λ 0, retrieval priority

  // Temporal validity
  validFrom: number; // Unix ms — when fact became true
  validTo: number | null; // null = still valid

  // Lifecycle timestamps
  createdAt: number;
  lastAccessedAt: number;
  lastReinforced: number;

  // Status
  status: "active" | "faded" | "superseded" | "archived";
  supersededBy: string | null;
  supersededAt: number | null;
  supersessionType: "conflict" | "temporal" | null;

  // Source provenance
  sourceSession: string; // session ID where first extracted
  sourceTurn: number; // turn index in that session
  sourceConversationIds: string[]; // ALL conversation IDs that contributed to this memory

  // Extracted entities
  entities: string[]; // named entities detected during extraction
}
```

**Dexie indexes:**

```
'id, *types, status, clusterId, lastAccessedAt, baseStrength, validFrom, pinned, mentionCount, [status+lastAccessedAt], [status+pinned]'
```

---

#### `episodes`

```typescript
interface Episode {
  id: string; // Session UUID
  summary: string; // 2–3 sentence summary
  embedding: number[]; // Mean of session message embeddings
  memoriesExtracted: string[];
  startedAt: number;
  endedAt: number;
  turnCount: number;
  emotionalValence: number;
  topics: string[];
}
```

---

#### `edges`

Individual records — not a single JSON document. Incremental writes. Scales to tens of thousands.

```typescript
interface Edge {
  id: string; // `${fromId}__${toId}` — deterministic
  fromId: string;
  toId: string;
  weight: number; // cosine_similarity
  sharedEntities: string[];
  createdAt: number;
  lastUpdated: number;
}
```

**Dexie indexes:** `'id, fromId, toId, weight, [fromId+weight]'`

---

#### `clusters`

```typescript
interface Cluster {
  id: string;
  centroid: number[];
  memberIds: string[];
  label: string;
  lastRecomputed: number;
  memberCount: number;
}
```

---

### Schema Version Chain

```typescript
const db = new Dexie("lokulmem");
db.version(1).stores({
  memories:
    "id, *types, status, clusterId, lastAccessedAt, baseStrength, validFrom, pinned, mentionCount, [status+lastAccessedAt], [status+pinned]",
  episodes: "id, startedAt",
  edges: "id, fromId, toId, weight, [fromId+weight]",
  clusters: "id",
});
// db.version(2).stores(...).upgrade(tx => ...) — future migrations
```

---

### Encryption Note

When `encryptionPassphrase` is provided, memory `content` strings are encrypted with AES-GCM before writing. Key derivation: PBKDF2, 100,000 iterations, SHA-256. Random 16-byte salt stored in `meta` store (only unencrypted record). Random 12-byte IV per write, stored alongside ciphertext.

**Embeddings are not encrypted.** This is deliberate. Encrypting embeddings breaks cosine similarity — the retrieval pipeline would require full decryption on every query, negating all HNSW and brute-force performance. A sophisticated attacker with IndexedDB file-system access can perform embedding inversion to partially recover semantic signal. For a personal memory system on the user's own device, an attacker with file-system access has already compromised far more. This tradeoff is documented, not hidden.

**Key UX (v0.3):** Derived key not stored by default — user sees empty memory on every reload without passphrase. v0.3 adds `keyStorage: 'session' | 'local' | 'none'`.

---

## 10. Enhanced Features

### 10.1 Episodic Memory (v0.2)

Session-level compressed summaries stored in `episodes`. Retrieved in parallel with facts when `cosine_similarity(query_embedding, episode.embedding) > 0.75`.

```
[Episode Context — relevant past conversation]
About 3 weeks ago, you had a long conversation about preparing your
Series A pitch deck, focused on financial projections and burn rate framing.
[End Episode Context]
```

### 10.2 Emotional Valence Tagging (v0.2)

VADER-style TypeScript lexicon (~3,000 entries, public domain). Sub-millisecond. No LLM call.

`|valence| > 0.6` → `base_strength = 1.0 + 0.2 × |valence|` at creation.

### 10.3 Proactive Memory — Push Model (v0.2)

```
proactive_score(m) = temporal_urgency(m) × memory_strength(m)
temporal_urgency(m) = σ(days_to_event(m) × -2.0)
```

Memories with `proactive_score > 0.7` injected at session start before user says anything.

### 10.4 Knowledge Graph Edges (v0.2)

Edges created when memories share entities or cosine similarity > 0.70. First-degree neighbours get +0.08 retrieval bonus in second-pass re-ranking. Updated during clustering pass.

### 10.5 Injection Mode Options (v0.2)

```typescript
injectionMode: "prepend-system" | // v0.1 default
  "new-system-message" |
  "developer-message" |
  "user-turn-prefix";
```

### 10.6 Optional At-Rest Encryption (v0.3)

AES-GCM, PBKDF2, `keyStorage` option. Full spec in Section 9.

---

## 11. Libraries — What to Use, What to Build, What to Skip

### Use Directly

**Dexie.js** — Apache 2.0, actively maintained. Best IndexedDB abstraction. Non-negotiable.

**Transformers.js** — Apache 2.0, actively maintained. Browser-native WASM model runner. MiniLM-L6-v2 quantised (~22MB weights, cached via Cache API after first download).

### Build — Minimal Purpose-Built HNSW

**Why not MeMemo:** Last commit approximately two years ago. Research code from Georgia Tech. Not maintained as a production library. Depending on it for a critical performance path is a growing liability.

**Why not fork MeMemo:** Shifts maintenance burden without eliminating it. For 300–400 lines, building is cleaner than inheriting unmaintained code.

**What to build:** Minimal HNSW in TypeScript, purpose-built for LokulMem's 384-dimensional cosine similarity schema, persisted to IndexedDB.

**Reference materials:**

- Malkov & Yashunin 2016 HNSW paper (algorithm)
- MeMemo source code (study IndexedDB persistence approach, then write your own)
- A-MEM graph construction (conceptual reference for edge creation)

**HNSW parameters:** M = 16, ef_construction = 200, ef_search = 50, distance = `1 - cosine_similarity`.

**Fallback:** Brute-force cosine is fully functional for all v0.1 use cases. At 3,000 memories, 384-dim brute-force in a SharedWorker takes ~15–25ms. Do not block v0.1 on HNSW. Ship brute-force. Add HNSW in v0.2.

### Study — Don't Use Directly

**EntityDB** — Study embedding-to-IndexedDB wiring. Don't use: plumbing only.

**vector-storage** — Study brute-force cosine over IndexedDB. Don't use: plumbing only.

**SimpleMem** — Study atomic memory unit design and deduplication logic. Don't use: Python server-side.

**A-MEM** — Study Zettelkasten dynamic linking for the edges store. Don't use: ChromaDB, Python.

**railroad-memory** — Study developer ergonomics of a conceptually adjacent library. Don't use: no browser-native embeddings, no lifecycle.

### Skip Entirely

**Mem0, LangMem, MemOS, Zep, MemEngine** — Server-first. Architecturally incompatible.

---

## 12. Implementation Roadmap

### v0.1 — Foundation (6 weeks)

**Worker Infrastructure**

- [ ] Worker mode detection on main thread: SharedWorker → Worker → main-thread with console warnings
- [ ] `navigator.storage.persist()` on main thread before worker spawn
- [ ] SharedWorker with MessageChannel port coordination
- [ ] `onProgress` callback: `worker`, `model`, `storage`, `maintenance`, `ready`

**Storage**

- [ ] Dexie.js schema v1 with all TypeScript interfaces (Section 9)
- [ ] `memories`, `episodes`, `edges`, `clusters` stores
- [ ] All indexes including compound indexes
- [ ] Schema migration chain

**Embedding Engine**

- [ ] Transformers.js MiniLM-L6-v2 in worker
- [ ] LRU embedding cache (1,000 entries)
- [ ] Brute-force cosine search for N ≤ 3,000

**Extraction Layer**

- [ ] Specificity NER: regex + static lookup (~300 lines)
- [ ] Novelty via top-1 retrieval query (not separate O(N) loop)
- [ ] Recurrence tracking within session
- [ ] Composite E score — configurable weights and threshold (tune during alpha)
- [ ] Three-stage contradiction pipeline
- [ ] `valid_from` / `valid_to` on every memory record
- [ ] Contradiction event logging and callbacks
- [ ] `pinned` field with λ = 0 and retrieval priority

**Memory Type Classification**

- [ ] Seven default types — regex + embedding classifier
- [ ] Extensible custom type system
- [ ] Multiple type tags per memory
- [ ] `entities` extraction alongside type classification

**Retrieval Layer**

- [ ] Composite R score — configurable weights (tune during alpha)
- [ ] `tokenCounter` interface with `Math.ceil(length / 4)` fallback
- [ ] Token-aware dynamic K
- [ ] `prepend-system` injection only
- [ ] R > 0.3 floor (tune during alpha)

**Debug Output**

- [ ] `augment()` returns `LokulMemDebug` when `debug: true`
- [ ] `InjectedMemory` with score, breakdown, human-readable reason, rank
- [ ] `ScoredMemory` candidates list with `injected: boolean` and `excludedReason`
- [ ] Latency reporting in debug object

**Decay and Lifecycle**

- [ ] Ebbinghaus decay per-category λ (treat as tunable defaults)
- [ ] Reinforcement on retrieval, `mentionCount` increment
- [ ] Maintenance sweep at session start
- [ ] k-means clustering in worker (synchronous for v0.1)
- [ ] Cluster retrieval bonus

**Public API — manage()**

- [ ] `list()`, `get()`, `getByConversation()`, `getRecent()`, `getTop()`, `getPinned()`
- [ ] `search()`, `semanticSearch()`
- [ ] `getTimeline()`, `getGrouped()`, `getInjectionPreview()`
- [ ] `update()`, `pin()`, `unpin()`, `archive()`, `unarchive()`, `delete()`, `clear()`
- [ ] `deleteMany()`, `archiveMany()`, `pinMany()`, `unpinMany()`
- [ ] `stats()` with full `MemoryStats` interface
- [ ] `export()` JSON, `exportToMarkdown()`, `import()`
- [ ] `onMemoryAdded()`, `onMemoryUpdated()`, `onMemoryDeleted()`, `onMemoryFaded()`, `onStatsChanged()`, `onContradictionDetected()` — all return unsubscribe functions

**Integration**

- [ ] Replace Lokul's internal memory system with LokulMem v0.1
- [ ] Integration examples: WebLLM, OpenAI, Ollama, Anthropic
- [ ] Full TypeScript types exported

### v0.2 — Intelligence (4 weeks after v0.1)

- [ ] Minimal HNSW TypeScript implementation (~350 lines), IndexedDB-persisted
- [ ] HNSW lazy loading above `hnswThreshold`
- [ ] k-means moved to `requestIdleCallback` + chunked async loops
- [ ] Knowledge graph edges: creation, retrieval bonus
- [ ] Emotional valence tagging: VADER-style TypeScript lexicon
- [ ] Episodic memory: session summarisation, episode store, retrieval path
- [ ] Proactive memory: temporal urgency scoring, push injection at session start
- [ ] `injectionMode` option: `prepend-system`, `new-system-message`, `developer-message`, `user-turn-prefix`
- [ ] `getRelated()` in manage() (graph neighbours)
- [ ] `getLineage()` in manage()
- [ ] React hook: `useMem()`
- [ ] Retention policy: `setRetentionPolicy()` with max age, max facts, min confidence
- [ ] `findSimilarFacts()` for compaction (safe O(N log N) via HNSW)

### v0.3 — Security and Polish (4 weeks after v0.2)

- [ ] At-rest encryption: AES-GCM, PBKDF2, `keyStorage: 'session' | 'local' | 'none'`
- [ ] Svelte store adapter
- [ ] Full benchmark suite
- [ ] Documentation site
- [ ] npm publish as `lokulmem` — MIT licence

### v1.0 — Public Release

- [ ] 100% TypeScript coverage, no `any` in public API
- [ ] Tree-shakeable ESM bundle
- [ ] Semantic versioning policy
- [ ] Community contribution guidelines

---

## 13. Success Metrics

### Performance

| Metric                               | Target        | Notes                            |
| ------------------------------------ | ------------- | -------------------------------- |
| Library bundle (excl. model weights) | < 2MB gzipped |                                  |
| Model weights — MiniLM quantised     | ~22MB         | Downloaded once, Cache API       |
| Worker init — after model cached     | < 800ms       |                                  |
| Embedding — LRU hit                  | < 2ms         |                                  |
| Embedding — warm cache miss          | < 10ms        |                                  |
| Extraction per turn                  | < 50ms        | Including top-1 novelty          |
| Retrieval — brute force (N ≤ 3,000)  | < 30ms        |                                  |
| Retrieval — HNSW (N > 3,000)         | < 20ms        |                                  |
| IndexedDB write per memory           | < 5ms         |                                  |
| Debug output overhead                | < 5ms         | Additional cost when debug: true |
| Storage — 1,000 memories             | < 25MB        |                                  |
| Storage — 10,000 memories            | < 200MB       |                                  |

### Quality

| Metric                                      | Target |
| ------------------------------------------- | ------ |
| Extraction precision                        | > 85%  |
| Extraction recall                           | > 75%  |
| Retrieval relevance — top-3 rated relevant  | > 80%  |
| True conflict detection                     | > 90%  |
| False positive contradictions               | < 5%   |
| Temporal coexistence correct classification | > 85%  |

### Developer Experience

| Metric                                          | Target              |
| ----------------------------------------------- | ------------------- |
| Integration time                                | < 10 minutes        |
| Lines for basic usage                           | 3 (augment + learn) |
| Required config for sensible defaults           | Zero                |
| TypeScript coverage — public API                | 100%                |
| Time to first memory retrieval from npm install | < 2 minutes         |

---

## 14. Appendix — Mathematical Reference

### Cosine Similarity

```
cosine_similarity(a, b) = (a · b) / (||a|| × ||b||)
```

384-dimensional MiniLM embeddings. Practical range [0, 1] for natural language.

### Ebbinghaus Forgetting Curve

```
strength(t) = base_strength × e^(-λ × Δt_hours)
t_half = ln(2) / λ ≈ 0.693 / λ
```

Pinned memories: λ = 0 → `strength(t) = base_strength` (no decay).

### Composite Extraction Score

```
E(s) = 0.35 × (1 - top1_similarity(s))
     + 0.45 × min(1.0, Σ specificity_weights)
     + 0.20 × min(1.0, 0.2 + 0.25 × occurrences(s))
```

Threshold default: 0.45. **Treat as empirically tunable. Expect to adjust during alpha.**

### Composite Retrieval Score

```
R(m, q) =
  0.40 × cosine_similarity(embed(m.content), embed(q))
  + 0.20 × e^(-0.005 × hours_since_created(m))
  + 0.25 × (min(base_strength(m), 3.0) / 3.0) × e^(-λ_m × Δt_hours)
  + 0.15 × max(cosine_similarity(embed(m.content), embed(t)) for t in last_3_turns)
```

Floor: R > 0.3. **Treat as empirically tunable.** All components [0, 1]. Composite R ∈ [0, 1].

For pinned memories, w3 component = 1.0 regardless of actual strength value.

### K-means (Lloyd's Algorithm)

K = `max(3, floor(√(total_active_memories / 2)))`

1. Initialise K centroids from existing embeddings
2. Assign each memory to nearest centroid by cosine distance
3. Recompute centroid as mean of assigned embeddings
4. Repeat until stable or 50 iterations

### HNSW Parameters

M = 16, ef_construction = 200, ef_search = 50, distance = `1 - cosine_similarity(a, b)`

### Temporal Urgency

```
temporal_urgency(m) = σ(days_to_event(m) × -2.0)
σ(x) = 1 / (1 + e^(-x))
```

0.5 at event date. Approaches 1.0 as deadline approaches. Zero for memories with no temporal reference detected.

### Emotional Valence Boost

```
base_strength_at_creation = 1.0 + 0.2 × min(1.0, |valence(s)|)
```

Applied when `|valence(s)| > 0.6`. Maximum: 1.2 at `|valence| = 1.0`.

---

## Note on Numerical Constants

Every numerical constant in this document — extraction threshold (0.45), contradiction similarity threshold (0.80), temporal coexistence threshold (0.75 for episodes), retrieval floor (0.30), Ebbinghaus λ values, scoring weights — must be treated as an empirically tunable starting point, not a fixed specification.

LLM embedding spaces are noisy. Real user dialogue is messier than synthetic test data. The constants above are informed by the architecture and prior work in agent memory systems, but they will require adjustment once real users interact with real conversations.

**Build every constant as a named, documented, easily adjustable variable.** Track which constants were changed and why during alpha. The final v1.0 defaults should be based on observed performance, not the numbers in this document.

---

_LokulMem is built by the Lokul team. It powers the memory system inside Lokul and is released as a standalone open source library under the MIT licence._

_This document supersedes all previous versions. v0.4 is the approved pre-build specification._
