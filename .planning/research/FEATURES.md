# Feature Landscape: Browser-Native ML Memory Management

**Domain:** Browser-native LLM memory management libraries
**Researched:** February 23, 2026
**Confidence:** HIGH (based on PRD v0.4, competitor analysis, and ecosystem research)

---

## Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Persistent Storage** | Users expect memories to survive page reloads, browser restarts | LOW | IndexedDB via Dexie.js is standard. In-memory only = toy, not tool. |
| **Vector Embeddings** | Semantic search requires embeddings; users expect relevant retrieval | MEDIUM | Transformers.js + MiniLM-L6-v2 is becoming standard. ~22MB quantized. |
| **CRUD Operations** | Basic memory management: create, read, update, delete | LOW | Standard Dexie.js operations. Must include bulk operations for UX. |
| **Semantic Search** | Find memories by meaning, not just keywords | MEDIUM | Cosine similarity over embeddings. Brute-force acceptable for <3K memories. |
| **Memory Types/Categories** | Organize memories by type (identity, preference, etc.) | LOW | Regex + embedding classifier. Seven defaults cover 90% of use cases. |
| **Event Callbacks** | Reactive UI requires knowing when memories change | LOW | onMemoryAdded, onMemoryUpdated, onMemoryDeleted, onStatsChanged. |
| **Export/Import** | Users own their data; portability is expected | LOW | JSON export/import. Markdown export nice for human readability. |
| **Token-Aware Retrieval** | Don't exceed LLM context window | MEDIUM | Requires tokenCounter callback. Math.ceil(length/4) fallback adequate. |
| **TypeScript Support** | Modern JS libraries require types | LOW | 100% TypeScript coverage expected. |

---

## Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Mathematical Decay Model** | Memories fade naturally like human memory; creates believable AI | HIGH | Ebbinghaus forgetting curve with per-category λ values. Differentiates from dumb vector DBs. |
| **Contradiction Detection** | Handle "I used to live in Berlin, now London" correctly | HIGH | Three-stage pipeline: candidate match → temporal marker → typed conflict. Preserves history, not snapshots. |
| **Pinned Memories** | User can lock critical facts (name, allergies) from decay | LOW | λ = 0 for pinned. Retrieval priority boost. Simple but powerful trust signal. |
| **Debug Transparency** | See exactly what was injected and why | MEDIUM | `augment()` returns debug object with scores, breakdowns, reasons. Builds trust through inspectability. |
| **Worker-Based Architecture** | Non-blocking embedding computation | MEDIUM | SharedWorker → Worker → main-thread fallback. Critical for UX at scale. |
| **Episodic Memory** | Recall conversation summaries, not just facts | MEDIUM | Session-level compressed summaries. Retrieved when relevant to current context. |
| **Proactive Memory** | Inject urgent memories before user asks | MEDIUM | Temporal urgency scoring. σ(days_to_event × -2.0). Push vs pull model. |
| **Knowledge Graph Edges** | Related memories boost retrieval | MEDIUM | First-degree neighbors get +0.08 bonus. Graph traversal for related facts. |
| **Emotional Valence Tagging** | Emotional memories prioritized | LOW | VADER-style lexicon. \|valence\| > 0.6 → strength boost. |
| **Lineage/Provenance** | Track where memories came from | MEDIUM | sourceConversationIds, supersession chains, temporal history. Audit trail for trust. |
| **Zero-Server Architecture** | True privacy; no API keys, no cloud | HIGH | All computation on device. Architectural guarantee, not policy. Major differentiator vs Mem0/LangMem. |
| **LLM Agnostic** | Works with any LLM that takes {role, content}[] | LOW | Universal interface. Not locked to OpenAI, Anthropic, or any provider. |
| **Composite Relevance Scoring** | Better retrieval than pure semantic similarity | MEDIUM | R(m,q) = w1×semantic + w2×recency + w3×strength + w4×continuity. Tunable weights. |
| **At-Rest Encryption** | Protect sensitive memories on shared devices | MEDIUM | AES-GCM, PBKDF2. keyStorage: 'session' \| 'local' \| 'none'. v0.3 feature. |

---

## Anti-Features (Deliberately Avoid)

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Cross-Device Sync** | Violates zero-server architecture; massive complexity | Export/import JSON. User manually syncs if needed. |
| **Multi-User / Shared Memory** | Scope explosion; collaboration features are product, not library | One store per user. Apps build multi-user on top if needed. |
| **Server Replication / Cloud Backup** | Violates privacy-by-architecture principle | Encrypted export to file. User manages their own backups. |
| **Real-Time Collaboration** | Merge protocols, conflict resolution, operational transforms | Out of scope. Device-local only. |
| **Mobile SDK (React Native, etc.)** | Different runtime, different storage APIs | Target browsers only. PWA covers most mobile use cases. |
| **Node.js / Server Runtime Support** | Depends on browser APIs (IndexedDB, SharedWorker, Web Crypto) | Stay browser-only. Server memory is solved problem (Redis, etc.). |
| **LLM Fine-Tuning / Training** | Scope creep into model training. Different problem domain. | Inject memories into context. Let LLM providers handle training. |
| **General-Purpose Semantic Search API** | Vector search is infrastructure, not product | Internal use only. Not exposed as public search endpoint. |
| **Application-Level UI State Management** | Library owns data, not UI state | Provide events. Apps build their own panel state (selected items, filters). |
| **Re-Extraction from History** | Requires storing raw conversations; privacy risk | Apps call `learn()` on their own stored messages if needed. |
| **Bulk Fact Merging / Deduplication Engine** | O(N²) complexity without careful indexing; premature optimization | Decay system handles gradual compaction. Defer until user data proves need. |
| **AI-Powered Fact Suggestions** | Requires library to make AI calls; violates zero-LLM-dependency | Extraction classifier handles categorization at write time. |
| **Markdown Import** | No reliable round-trip guarantee; NLP-hard problem | One-way exportToMarkdown only. Import is JSON only. |
| **Fact Formatting Helpers** | Display concerns are application-level | Apps build formatters. Library provides raw content. |
| **Retention Policy Engine** | Decay model already handles minConfidence case | Defer to v0.2. Ebbinghaus is sufficient for v0.1. |
| **Reinforcement Learning from Memories** | Training loop complexity; out of scope | Static retrieval and injection only. |
| **Automatic Memory Compression/Summarization** | Requires LLM calls; unreliable quality | Episodic summaries stored as-is. No automatic rewriting. |
| **Multi-Modal Memory (Images, Audio)** | Embeddings complexity; storage bloat | Text-only memories. Apps handle media separately. |
| **Distributed Vector Index** | Browser can't run HNSW across devices | Local HNSW only. Threshold at 3K memories. Brute-force below. |

---

## Feature Dependencies

```
Mathematical Decay
    └──requires──> Persistent Storage (need timestamps)
    └──requires──> Memory Types (per-category λ values)

Contradiction Detection
    └──requires──> Vector Embeddings (similarity search)
    └──requires──> Temporal Markers (regex detection)
    └──requires──> Lineage/Provenance (supersession chains)

Debug Transparency
    └──requires──> Composite Relevance Scoring (score breakdown)
    └──requires──> Token-Aware Retrieval (tokensUsed reporting)

Episodic Memory
    └──requires──> Vector Embeddings (episode retrieval)
    └──requires──> Session Tracking (episode boundaries)

Proactive Memory
    └──requires──> Temporal Marker Detection (urgency scoring)
    └──requires──> Mathematical Decay (strength component)

Knowledge Graph Edges
    └──requires──> Entity Extraction (shared entities detection)
    └──requires──> Vector Embeddings (similarity threshold)

HNSW Vector Search
    └──requires──> Worker-Based Architecture (non-blocking build)
    └──enhances──> Semantic Search (speed at scale)

At-Rest Encryption
    └──requires──> Key Storage Decision (session/local/none)
    └──conflicts──> Embedding Search (embeddings stay unencrypted)
```

### Dependency Notes

- **Mathematical Decay requires Persistent Storage:** Decay calculations need `createdAt`, `lastAccessedAt`, `validFrom` timestamps.
- **Contradiction Detection requires Lineage:** Must track `supersededBy`, `supersededAt`, `temporalSupersedes` for history preservation.
- **Debug Transparency requires Composite Scoring:** Debug object shows breakdown of semantic/recency/strength/continuity components.
- **HNSW enhances Semantic Search:** Not required for v0.1 (brute-force sufficient), but enables scale beyond 3K memories.
- **Encryption conflicts with Embedding Search:** Embeddings must stay unencrypted for cosine similarity. Documented tradeoff, not hidden.

---

## MVP Definition (v0.1)

### Launch With

Minimum viable product — what's needed to validate the concept.

- [x] **Persistent Storage** — IndexedDB via Dexie.js. Non-negotiable foundation.
- [x] **Vector Embeddings** — Transformers.js + MiniLM-L6-v2 in SharedWorker.
- [x] **CRUD + Bulk Operations** — Full manage() API surface.
- [x] **Semantic Search** — Brute-force cosine (HNSW deferred to v0.2).
- [x] **Memory Types** — Seven defaults with regex + embedding classifier.
- [x] **Mathematical Decay** — Ebbinghaus with per-category λ. Core differentiator.
- [x] **Contradiction Detection** — Three-stage pipeline. History preservation.
- [x] **Pinned Memories** — λ = 0, retrieval priority. Simple trust feature.
- [x] **Debug Transparency** — `augment()` returns debug object. Essential for developer trust.
- [x] **Event Callbacks** — Reactive UI support.
- [x] **Token-Aware Retrieval** — Dynamic K based on available tokens.
- [x] **Export/Import** — JSON round-trip, Markdown export.
- [x] **Worker Fallback Chain** — SharedWorker → Worker → main-thread.

### Add After Validation (v0.2)

Features to add once core is working and tuned.

- [ ] **HNSW Vector Search** — Trigger: >3K memories or retrieval >30ms.
- [ ] **Episodic Memory** — Trigger: Users want conversation recall, not just facts.
- [ ] **Proactive Memory** — Trigger: Users want anticipatory injection.
- [ ] **Knowledge Graph Edges** — Trigger: Need related memory suggestions.
- [ ] **Emotional Valence** — Trigger: Want emotional memory prioritization.
- [ ] **React Hook (useMem)** — Trigger: Developer DX feedback.
- [ ] **Retention Policy** — Trigger: Need explicit pruning rules beyond decay.

### Future Consideration (v0.3+)

Features to defer until product-market fit is established.

- [ ] **At-Rest Encryption** — Trigger: Users on shared devices need privacy.
- [ ] **Svelte/Vue Adapters** — Trigger: Community demand beyond React.
- [ ] **Custom Embedding Models** — Trigger: Need domain-specific embeddings.
- [ ] **Memory Compression** — Trigger: Storage limits hit (10K+ memories).

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Persistent Storage | HIGH | LOW | P1 |
| Vector Embeddings | HIGH | MEDIUM | P1 |
| Mathematical Decay | HIGH | HIGH | P1 |
| Contradiction Detection | HIGH | HIGH | P1 |
| Debug Transparency | HIGH | MEDIUM | P1 |
| Pinned Memories | HIGH | LOW | P1 |
| Semantic Search | HIGH | MEDIUM | P1 |
| Worker Architecture | HIGH | MEDIUM | P1 |
| Token-Aware Retrieval | HIGH | MEDIUM | P1 |
| Memory Types | MEDIUM | LOW | P1 |
| Event Callbacks | MEDIUM | LOW | P1 |
| Export/Import | MEDIUM | LOW | P1 |
| HNSW Vector Search | MEDIUM | HIGH | P2 |
| Episodic Memory | MEDIUM | MEDIUM | P2 |
| Proactive Memory | MEDIUM | MEDIUM | P2 |
| Knowledge Graph | LOW | HIGH | P2 |
| Emotional Valence | LOW | LOW | P2 |
| At-Rest Encryption | MEDIUM | MEDIUM | P3 |
| Lineage/Provenance | LOW | MEDIUM | P2 |
| React Hook | MEDIUM | LOW | P2 |

**Priority Key:**
- P1: Must have for v0.1 launch
- P2: Should have, add in v0.2
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Mem0 | LangMem | railroad-memory | EntityDB | LokulMem (v0.1) |
|---------|------|---------|-----------------|----------|-----------------|
| **Server Required** | Yes | Yes | No | No | **No** |
| **Cloud LLM Required** | Yes (default) | Yes (LangGraph) | No | No | **No** |
| **Browser Native** | Partial | No | Partial | Yes | **Yes** |
| **Browser Embeddings** | No | No | No | No | **Yes** |
| **Mathematical Decay** | No | No | No | No | **Yes** |
| **Contradiction Handling** | Partial | Partial | No | No | **Yes** |
| **Full Lifecycle** | Partial | Partial | No | No | **Yes** |
| **Zero-Server** | No | No | Yes | Yes | **Yes** |
| **Episodic Memory** | No | No | No | No | v0.2 |
| **Knowledge Graph** | Yes | Yes | No | Yes | v0.2 |
| **Open Source** | Partial | Yes | Yes | Yes | **Yes** |
| **Privacy by Architecture** | No | No | Yes | Yes | **Yes** |

### Analysis

**Mem0:** Server-first, API-key based. Strong graph memory and hosted infrastructure. Not browser-native. Privacy through policy, not architecture.

**LangMem:** LangGraph-integrated. Agent-managed memory tools. Server-side. Tight coupling to LangChain ecosystem.

**railroad-memory:** Closest conceptual neighbor. Client-side context management with hierarchical tiers. No browser embeddings, no decay, no contradiction resolution. Manages context window, not persistent knowledge lifecycle.

**EntityDB:** Browser-native vector storage. Good plumbing, not a memory system. No extraction, no decay, no lifecycle.

**LokulMem Opportunity:** The full browser-native LLM memory lifecycle layer is unoccupied. Typed extraction, mathematical decay, contradiction audit trail, episodic memory, proactive injection, user-inspectable and correctable — all on-device with zero server dependency.

---

## Sources

- [LokulMem PRD v0.4](/Users/poak/Documents/personal-project/lokul-mind/PRD.md) — Primary specification
- [Mem0 Documentation](https://docs.mem0.ai) — Competitor analysis
- [LangMem GitHub](https://github.com/langchain-ai/langmem) — Competitor analysis
- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js) — Embedding capabilities
- [Dexie.js GitHub](https://github.com/dexie/Dexie.js) — IndexedDB abstraction
- [Transformers.js Examples](https://github.com/huggingface/transformers.js-examples) — Use case validation

---

*Feature research for: LokulMem — Browser-native ML memory management library*
*Researched: February 23, 2026*
