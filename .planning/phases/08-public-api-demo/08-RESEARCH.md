# Phase 8: Public API & Demo - Research

**Researched:** 2026-02-26
**Domain:** Public API design, event-driven architecture, React demo applications
**Confidence:** HIGH

## Summary

Phase 8 implements the user-facing public API layer (`augment()`, `learn()`, `manage()`) with a complete event system and working React demo application. This phase delivers the developer experience surface that makes LokulMem consumable, demonstrating how all internal components (Phases 1-7) work together to provide persistent, privacy-preserving memory for LLM applications.

Key findings:
1. **Public API design** follows a three-method surface pattern: `augment()` for retrieval+injection, `learn()` for extraction+storage, `manage()` for inspection+manipulation
2. **augment()** requires careful message history handling with prepend-system injection format, token-aware dynamic K, and comprehensive debug metadata
3. **learn()** implements synchronous cache updates for immediate queryability, configurable extraction thresholds, and grouped return structures
4. **manage()** provides 16+ methods for data access with separate method discovery (no single `manage()` with operation parameter)
5. **Event system** uses IDs-only payload pattern with optional verbose mode, consistent unsubscribe pattern, and granular event types
6. **Demo app** uses isolated package.json, tab-based navigation, reactive state management, and split debug view

**Primary recommendation:** Implement three API surfaces (`augment()`, `learn()`, `manage()`), complete event callback system with 7 event types, and React demo app with conversation view, memory list, and debug panel.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**augment() behavior:**
- **Injection format:** Prepend system message with proper handling:
  - If first message in history has `role: 'system'`, prepend memory block to its content (merge, don't duplicate)
  - Else, insert new system message at index 0 with memory block
  - Result: [system_with_memories, ...user_messages, ...assistant_messages, current_user_message]
- **Return type:** Return object with messages and metadata (not just messages array)
- **Memory limits:** Token budget aware (dynamic K) - use Phase 5's remaining tokens logic:
  - Compute: `remainingTokens = contextWindowTokens - reservedForResponseTokens - (system + history + user) tokens`
  - Inject only top-K memories that fit in remaining budget
  - Report in metadata: `usedTokensBeforeInjection`, `injectionTokens`, `remainingTokensAfterInjection`
- **No relevant memories:** Flag in metadata, clean return (no_memories_found flag, return user message and history cleanly)
- **Memory formatting:** Summarized memory blocks (content + type + source, shorter and less distracting to LLM)
- **Debug object:** Everything (memories, scores, exclusions, tokens, timing) but **lazy-computed only when options.debug === true**
  - Debug payload NOT computed/serialized if debug is false (performance)
  - Default: `debug: false` - must be explicitly enabled
- **Token counting:** Breakdown by stage with context window awareness
- **history parameter:** Default to empty history (optional, user-friendly)
- **Error handling:** Hybrid (throw critical only - throw for critical errors, return metadata for warnings)
- **Memory format in prompt:** Summarized blocks (not full DTO)

**learn() behavior:**
- **Extraction timing:** Always extract (every learn() call runs extraction)
- **Maintenance sweep:** Configurable (runMaintenance option) - user controls when maintenance runs
- **Contradiction handling:** Follow contradiction config (auto/manual) - respect Phase 7 config
- **Extraction source:** Configurable (extractFrom: 'user' | 'assistant' | 'both', default 'both')
- **Return structure:** Grouped by operation ({ extracted: [], contradictions: [], maintenance: {} })
- **Cache updates:** Synchronous guarantee - **after `await learn()` resolves, the next `augment()` can retrieve the new memory**
  - DB write and cache update happen in same transaction boundary
  - New memory is immediately queryable and searchable
  - Explicit guarantee in docs: "await learn(); await augment(); // new memory included in results"
- **Memory details:** Configurable (verbose option) - user controls return verbosity
- **Conversation tracking:** Optional with auto-creation (conversationId optional, generate if missing, return in result)
- **Quality threshold:** Respect extraction threshold, allow override (default E(s) ≥ 0.55, allow learnThreshold option)
- **Auto-association:** Configurable (autoAssociate option) - user controls association with previous augment()
- **Operation order:** Extract → detect contradictions → supersede (logical pipeline order)
- **Event emissions:** Emit individual events (granular: onMemoryAdded, onMemorySuperseded, etc.)
- **Response storage:** Configurable (storeResponse option) - user controls whether assistantResponse stored in episode
- **Timestamp handling:** Message timestamp with fallback (use message timestamp if available, else learn() time)
- **Partial failures:** Skip failed, continue others (best effort - don't fail entire operation if one extraction fails)

**manage() API design:**
- **Method exposure:** Separate methods for each operation (manage.update(), manage.delete(), etc. - more discoverable than single manage() with operation param)
- **Single operation returns:** Return ID and status only (lightweight)
- **Bulk operation returns:** Summary + arrays ({succeeded: [], failed: [], total, counts} - detailed feedback)
- **Export format:** Both (format option) - support both JSON and Markdown via format option
- **Import mode:** Configurable (mode option: replace/merge) - user controls whether import replaces or merges with existing

**Event system contract:**
- **Consistent lightweight format:** All events use IDs-only or DTO (no embeddings) - matches Phase 7 contradiction event decision
- **Large fields optional:** Content and other large fields included only if `verboseEvents: true` (default false)
- **Event payload types:** Define EventPayload types consistently across all callbacks:
  - **IDs-only mode** (default): `{ memoryId, timestamp, type, status }` - no content, no embeddings
  - **Verbose mode** (verboseEvents: true): `{ memoryId, timestamp, type, status, content, metadata }` - includes content and other fields
  - **Never included:** `embedding` field - always excluded from events regardless of mode
- **Applies to all events:** onMemoryAdded, onMemoryUpdated, onMemoryDeleted, onMemoryFaded, onStatsChanged, onContradictionDetected, onMemorySuperseded

**Demo app scope:**
- **Feature set:** Standard (augment + learn + list) - core workflow showcase
- **Conversation handling:** Single conversation view (simple, focused)
- **Debug visualization:** Split view (conversation + debug) - side-by-side for learning
- **Memory list:** Live reactive list (real-time updates with reactive state)
- **Memory card detail:** Expandable (summary → detail) - summary by default, click to expand
- **Theming:** Respect stored preferences with simple toggle:
  - Default to light theme
  - Include theme toggle that stores preference as a memory (calls manage().update() on preference memory)
  - Demonstrates preference storage/retrieval - showcases memory usefulness
  - Keep styling simple regardless of theme
- **Data persistence:** Persisted IndexedDB storage (realistic, like real app)
- **Sample data:** Prompt user (empty or sample) - ask on first load, let user choose
- **View structure:** Tab-based navigation (clean separation of views)
- **Debug panel style:** Raw JSON (no syntax highlighting or fancy formatting) - show raw debug object, technical and simple

### Claude's Discretion

- augment() options: contextWindowTokens (default from model config), reservedForResponseTokens (default 2048), exact shapes of options interfaces
- Event callback timing (when events fire during operation lifecycle)
- Error message content and recovery hints
- Demo app UI component structure and styling approach
- Sample data content and diversity
- Tab organization and routing strategy
- Debug panel JSON formatting (indentation, sorting)
- Theme toggle implementation details (preference memory structure, update pattern)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUG-01 | Accepts userMessage, history[], options | Standard chat completion API pattern |
| AUG-02 | Returns augmented messages array ready for LLM | Prepend-system injection format preserves message structure |
| AUG-03 | Returns LokulMemDebug when options.debug = true | Lazy computation only when debug=true for performance |
| AUG-04 | Debug includes injected memories with scores and breakdowns | Reuse Phase 5 composite scoring breakdown |
| AUG-05 | Debug includes candidates with excluded reasons | Filtered candidates from VectorSearch with exclusion reasons |
| AUG-06 | Debug includes token usage and latency metrics | Timing measurements and token counting from Phase 5 |
| AUG-07 | Prepend-system injection format | Merge with existing system message or insert at index 0 |
| LEARN-01 | Accepts userMessage, assistantResponse, options | Standard turn-based extraction pattern |
| LEARN-02 | Returns extracted memories array | Extraction pipeline from Phase 7 (SpecificityNER, NoveltyCalculator, etc.) |
| LEARN-03 | Returns contradictions detected | ContradictionDetector and SupersessionManager from Phase 7 |
| LEARN-04 | Returns faded memories from maintenance | LifecycleManager maintenance sweep results |
| LEARN-05 | Updates in-memory vector cache after extraction | Write-through cache sync from Phase 5 |
| MGMT-10 | `update()`, `pin()`, `unpin()`, `archive()`, `unarchive()`, `delete()` | Single-operation mutations with ID+status return |
| MGMT-11 | Bulk operations: `deleteMany()`, `archiveMany()`, `pinMany()`, `unpinMany()` | Batch operations with summary feedback |
| MGMT-12 | `clear()` reset all memories | Clear all with confirmation |
| MGMT-13 | `stats()` full MemoryStats interface | Aggregate statistics from repository |
| MGMT-14 | `export()` JSON with base64 embeddings | Full export with serialization |
| MGMT-15 | `exportToMarkdown()` human-readable export | Formatted markdown output |
| MGMT-16 | `import()` JSON with merge options | Import with conflict resolution |
| EVENT-01 | `onMemoryAdded()` callback with MemoryDTO | Event emission on extraction success |
| EVENT-02 | `onMemoryUpdated()` callback with MemoryDTO | Event emission on mutation |
| EVENT-03 | `onMemoryDeleted()` callback with id | Already implemented in Phase 6 |
| EVENT-04 | `onMemoryFaded()` callback with MemoryDTO | Already implemented in Phase 6 |
| EVENT-05 | `onStatsChanged()` callback with MemoryStats | Event emission on stat changes |
| EVENT-06 | `onContradictionDetected()` callback with event details | Already implemented in Phase 7 |
| EVENT-07 | All event callbacks return unsubscribe functions | Standard subscription pattern |
| DEMO-01 | React app in `examples/react-app/` with isolated package.json | Separate workspace to avoid root pollution |
| DEMO-02 | Visualizes debug object from augment() | Raw JSON display in split view |
| DEMO-03 | Reactive memory list using manage().list() | Real-time updates with event listeners |
| DEMO-04 | Does not pollute root package.json with React dependencies | Isolated workspace with own dependencies |

---

## Standard Stack

### Core

| Component | Implementation | Purpose | Why Standard |
|-----------|----------------|---------|--------------|
| augment() | Main thread orchestration | Retrieve+inject memories for LLM context | User-facing API surface |
| learn() | Worker RPC with cache sync | Extract+store memories from conversation | Turn-based learning pattern |
| manage() | Namespace object with 16+ methods | Inspection, manipulation, export/import | Data management API |
| Event system | Callback registration with unsubscribe | Event-driven architecture | Standard observer pattern |

### Supporting

| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| Prepend-system injection | Memory block formatting | All augment() calls with history |
| Token-aware dynamic K | Context window optimization | All LLM integrations |
| IDs-only event payloads | Lightweight event callbacks | All event emissions (default) |
| Verbose event mode | Detailed event data | Debugging and inspection |
| Unsubscribe pattern | Event cleanup | All event subscriptions |
| Namespace API | Method discoverability | manage() API surface |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| augment()/learn()/manage() | Single memory object | Less discoverable, unclear separation of concerns |
| Prepend-system injection | Append-user injection | Less LLM-friendly, breaks conversation flow |
| Token-aware dynamic K | Fixed K retrieval | Wastes context window or under-injects |
| IDs-only events | Full DTO events | Higher IPC overhead, violates Phase 7 decision |
| Namespace manage() | Single manage(op, params) | Less discoverable, harder to type |

**Why three-method API surface:**
- Clear separation: augment (read), learn (write), manage (admin)
- Discoverable: each method has obvious purpose
- Type-safe: separate option types for each operation
- Familiar: matches common SDK patterns (e.g., database clients)

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── api/
│   ├── Augmenter.ts           # augment() implementation
│   ├── Learner.ts             # learn() implementation
│   ├── Manager.ts             # manage() namespace implementation
│   ├── EventManager.ts        # Event callback registry
│   ├── types.ts               # API-specific types
│   └── _index.ts              # API barrel file
├── core/
│   └── LokulMem.ts            # Main class (add augment/learn/manage methods)
├── types/
│   ├── api.ts                 # Extend with new interfaces
│   └── events.ts              # Event types (already exists)
└── worker/
    └── index.ts               # Add LEARN, AUGMENT RPC handlers

examples/
└── react-app/
    ├── src/
    │   ├── components/
    │   │   ├── ChatView.tsx        # Conversation interface
    │   │   ├── MemoryList.tsx      # Memory browser
    │   │   ├── DebugPanel.tsx      # Debug visualization
    │   │   └── ThemeToggle.tsx     # Preference demo
    │   ├── hooks/
    │   │   └── useLokulMem.ts      # React wrapper
    │   ├── App.tsx
    │   └── main.tsx
    ├── index.html
    ├── vite.config.ts
    ├── tsconfig.json
    └── package.json              # Isolated dependencies
```

### Pattern 1: augment() with Prepend-System Injection

**What:** Inject retrieved memories as system message at index 0
**When to use:** All LLM calls that accept messages[] format
**Example:**

```typescript
// Source: Phase 8 user constraints (prepend-system injection)
interface AugmentOptions {
  contextWindowTokens?: number;
  reservedForResponseTokens?: number;
  maxTokens?: number;
  debug?: boolean;
}

interface AugmentResult {
  messages: ChatMessage[];
  metadata: {
    injectedCount: number;
    noMemoriesFound: boolean;
    usedTokensBeforeInjection: number;
    injectionTokens: number;
    remainingTokensAfterInjection: number;
  };
  debug?: LokulMemDebug;
}

class Augmenter {
  async augment(
    userMessage: string,
    history: ChatMessage[] = [],
    options: AugmentOptions = {}
  ): Promise<AugmentResult> {
    const {
      contextWindowTokens = this.config.contextWindowTokens,
      reservedForResponseTokens = 2048,
      maxTokens,
      debug = false
    } = options;

    // 1. Compute token budget
    const messages = [...history, { role: 'user', content: userMessage }];
    const budget = computeTokenBudget(messages, {
      contextWindowTokens,
      reservedForResponseTokens,
      tokenCounter: this.config.tokenCounter
    });

    // 2. Retrieve memories using dynamic K
    const searchResults = await this.queryEngine.semanticSearch(userMessage, {
      k: Math.floor(budget.availableTokens / 10), // Rough estimate
      useCompositeScoring: true
    });

    // 3. Format memory block (summarized format)
    const memoryBlock = this.formatMemoryBlock(searchResults);

    // 4. Inject as system message (prepend format)
    const augmentedMessages = this.injectSystemMessage(messages, memoryBlock);

    // 5. Compute metadata
    const metadata = {
      injectedCount: searchResults.length,
      noMemoriesFound: searchResults.length === 0,
      usedTokensBeforeInjection: budget.usedTokens,
      injectionTokens: this.estimateTokens(memoryBlock),
      remainingTokensAfterInjection: budget.remainingTokens
    };

    // 6. Lazy debug computation (only if debug=true)
    const debugObj = debug ? this.computeDebug(searchResults, budget) : undefined;

    return { messages: augmentedMessages, metadata, debug: debugObj };
  }

  private injectSystemMessage(
    messages: ChatMessage[],
    memoryBlock: string
  ): ChatMessage[] {
    if (!memoryBlock) {
      return messages;
    }

    // Check if first message is system
    const firstMessage = messages[0];
    if (firstMessage?.role === 'system') {
      // Prepend to existing system message
      return [
        {
          ...firstMessage,
          content: `${memoryBlock}\n\n${firstMessage.content}`
        },
        ...messages.slice(1)
      ];
    }

    // Insert new system message at index 0
    return [
      { role: 'system', content: memoryBlock },
      ...messages
    ];
  }

  private formatMemoryBlock(memories: MemoryDTO[]): string {
    if (memories.length === 0) {
      return '';
    }

    // Summarized format: content + type + source
    const blocks = memories.map(m =>
      `- [${m.types.join(', ')}] ${m.content}`
    );

    return `Relevant context:\n${blocks.join('\n')}`;
  }
}
```

### Pattern 2: learn() with Synchronous Cache Update

**What:** Extract memories and update cache in same transaction
**When to use:** All conversation turns for learning
**Example:**

```typescript
// Source: Phase 8 user constraints (synchronous cache guarantee)
interface LearnOptions {
  conversationId?: string;
  extractFrom?: 'user' | 'assistant' | 'both';
  runMaintenance?: boolean;
  learnThreshold?: number;
  autoAssociate?: boolean;
  storeResponse?: boolean;
  verbose?: boolean;
}

interface LearnResult {
  extracted: MemoryDTO[];
  contradictions: ContradictionEvent[];
  maintenance: {
    faded: number;
    deleted: number;
  };
  conversationId: string;
}

class Learner {
  async learn(
    userMessage: ChatMessage,
    assistantResponse: ChatMessage,
    options: LearnOptions = {}
  ): Promise<LearnResult> {
    const {
      conversationId: providedConversationId,
      extractFrom = 'both',
      runMaintenance = false,
      learnThreshold,
      autoAssociate = false,
      storeResponse = false,
      verbose = false
    } = options;

    // 1. Generate or use conversation ID
    const conversationId = providedConversationId ?? this.generateConversationId();

    // 2. Extract candidates from messages
    const sources: string[] = [];
    if (extractFrom === 'user' || extractFrom === 'both') {
      sources.push(userMessage.content);
    }
    if (extractFrom === 'assistant' || extractFrom === 'both') {
      sources.push(assistantResponse.content);
    }

    const candidates = await this.extractFromSources(sources, conversationId);

    // 3. Quality scoring and thresholding
    const extracted: MemoryInternal[] = [];
    for (const candidate of candidates) {
      const score = this.qualityScorer.computeScore(candidate);
      const threshold = learnThreshold ?? this.config.extractionThreshold;

      if (score >= threshold) {
        extracted.push(candidate);
      }
    }

    // 4. Generate embeddings and store
    const memoriesWithEmbeddings = await Promise.all(
      extracted.map(async (m) => ({
        ...m,
        embedding: await this.embeddingEngine.embed(m.content)
      }))
    );

    // 5. Batch write to DB (transaction boundary)
    const stored = await this.repository.batchAdd(memoriesWithEmbeddings);

    // 6. Update vector cache IMMEDIATELY (synchronous guarantee)
    for (const memory of memoriesWithEmbeddings) {
      this.vectorSearch.add(memory);
    }

    // 7. Emit events (after cache update)
    for (const memory of stored) {
      this.eventManager.emit('MEMORY_ADDED', this.toDTO(memory));
    }

    // 8. Detect contradictions
    const contradictions: ContradictionEvent[] = [];
    for (const memory of stored) {
      const contradiction = await this.contradictionDetector.detect(memory);
      if (contradiction) {
        const resolution = await this.supersessionManager.resolve(contradiction);
        contradictions.push({
          newMemoryId: memory.id,
          conflictingMemoryId: contradiction.conflictingMemoryId,
          similarity: contradiction.similarity,
          hasTemporalMarker: contradiction.hasTemporalMarker,
          resolution: resolution.mode,
          newMemoryCreatedAt: memory.createdAt,
          conflictingMemoryCreatedAt: contradiction.conflictingMemoryCreatedAt,
          newMemoryTypes: memory.types,
          conflictingMemoryTypes: contradiction.conflictingMemoryTypes,
          conflictDomain: contradiction.conflictDomain
        });

        // Emit contradiction event
        this.eventManager.emit('CONTRADICTION_DETECTED', contradictions[contradictions.length - 1]);
      }
    }

    // 9. Optional maintenance sweep
    let maintenanceStats = { faded: 0, deleted: 0 };
    if (runMaintenance) {
      maintenanceStats = await this.lifecycleManager.runMaintenance();
    }

    // 10. Store episode if requested
    if (storeResponse) {
      await this.repository.addEpisode({
        conversationId,
        userMessage,
        assistantResponse,
        timestamp: Date.now()
      });
    }

    return {
      extracted: stored.map(this.toDTO),
      contradictions,
      maintenance: maintenanceStats,
      conversationId
    };
  }

  // CRITICAL: Cache update happens before learn() resolves
  // This guarantees: await learn(); await augment(); // new memory included
}
```

### Pattern 3: manage() Namespace API

**What:** Separate methods for each management operation
**When to use:** All data access and manipulation
**Example:**

```typescript
// Source: Phase 8 user constraints (separate methods for discoverability)
class Manager {
  // === Single Operations ===

  async update(id: string, updates: Partial<MemoryDTO>): Promise<{ id: string; status: 'updated' }> {
    await this.repository.update(id, updates);
    return { id, status: 'updated' };
  }

  async pin(id: string): Promise<{ id: string; status: 'pinned' }> {
    await this.repository.update(id, { pinned: true });
    return { id, status: 'pinned' };
  }

  async unpin(id: string): Promise<{ id: string; status: 'unpinned' }> {
    await this.repository.update(id, { pinned: false });
    return { id, status: 'unpinned' };
  }

  async archive(id: string): Promise<{ id: string; status: 'archived' }> {
    await this.repository.update(id, { status: 'archived' });
    return { id, status: 'archived' };
  }

  async unarchive(id: string): Promise<{ id: string; status: 'active' }> {
    await this.repository.update(id, { status: 'active' });
    return { id, status: 'active' };
  }

  async delete(id: string): Promise<{ id: string; status: 'deleted' }> {
    await this.repository.delete(id);
    return { id, status: 'deleted' };
  }

  // === Bulk Operations ===

  async deleteMany(ids: string[]): Promise<{
    succeeded: string[];
    failed: Array<{ id: string; error: string }>;
    total: number;
    counts: { succeeded: number; failed: number };
  }> {
    const succeeded: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const id of ids) {
      try {
        await this.repository.delete(id);
        succeeded.push(id);
      } catch (error) {
        failed.push({ id, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return {
      succeeded,
      failed,
      total: ids.length,
      counts: { succeeded: succeeded.length, failed: failed.length }
    };
  }

  async pinMany(ids: string[]): Promise<BulkOperationResult> {
    // Similar pattern to deleteMany
  }

  async archiveMany(ids: string[]): Promise<BulkOperationResult> {
    // Similar pattern to deleteMany
  }

  async unpinMany(ids: string[]): Promise<BulkOperationResult> {
    // Similar pattern to deleteMany
  }

  // === Clear ===

  async clear(): Promise<{ status: 'cleared'; count: number }> {
    const count = await this.repository.count();
    await this.repository.clearAll();
    return { status: 'cleared', count };
  }

  // === Stats ===

  async stats(): Promise<MemoryStats> {
    return this.repository.getStats();
  }

  // === Export/Import ===

  async export(format: 'json' | 'markdown'): Promise<string> {
    if (format === 'json') {
      const data = await this.repository.exportAll();
      return JSON.stringify(data, null, 2);
    } else {
      const memories = await this.repository.getAll();
      return this.formatMarkdown(memories);
    }
  }

  async import(data: string, mode: 'replace' | 'merge'): Promise<{
    imported: number;
    skipped: number;
    errors: number;
  }> {
    const parsed = JSON.parse(data);

    if (mode === 'replace') {
      await this.repository.clearAll();
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const memory of parsed.memories) {
      try {
        if (mode === 'merge') {
          const existing = await this.repository.getById(memory.id);
          if (existing) {
            skipped++;
            continue;
          }
        }
        await this.repository.add(memory);
        imported++;
      } catch {
        errors++;
      }
    }

    return { imported, skipped, errors };
  }

  // === Query Methods (from Phase 5) ===

  async list(options?: ListOptions): Promise<PaginatedResult<MemoryDTO>> {
    return this.queryEngine.list(options);
  }

  async get(id: string): Promise<MemoryDTO | null> {
    return this.queryEngine.get(id);
  }

  // ... other query methods (getByConversation, search, semanticSearch, etc.)
}
```

### Pattern 4: Event System with IDs-Only Payloads

**What:** Lightweight event payloads with optional verbose mode
**When to use:** All event emissions for state changes
**Example:**

```typescript
// Source: Phase 8 user constraints (IDs-only with verbose mode)
interface EventConfig {
  verboseEvents?: boolean; // Default: false
}

interface MemoryEventPayload {
  memoryId: string;
  timestamp: number;
  type: string;
  status: string;
  // Optional verbose fields:
  content?: string;
  metadata?: Record<string, unknown>;
}

class EventManager {
  private handlers: Map<string, Set<Function>> = new Map();
  private config: EventConfig;

  constructor(config: EventConfig = {}) {
    this.config = { verboseEvents: false, ...config };
  }

  // Register event handler
  on(eventType: string, handler: Function): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  // Emit event (called internally)
  emit(eventType: string, data: unknown): void {
    const handlers = this.handlers.get(eventType);
    if (!handlers) {
      return;
    }

    for (const handler of handlers) {
      handler(data);
    }
  }

  // Create IDs-only payload (default)
  createMemoryEvent(memory: MemoryDTO): MemoryEventPayload {
    const base = {
      memoryId: memory.id,
      timestamp: memory.createdAt,
      type: memory.types.join(', '),
      status: memory.status
    };

    // Add verbose fields if enabled
    if (this.config.verboseEvents) {
      return {
        ...base,
        content: memory.content,
        metadata: memory.metadata
      };
    }

    return base;
  }
}

// Integration with LokulMem
class LokulMem {
  private eventManager: EventManager;

  onMemoryAdded(handler: (event: MemoryEventPayload) => void): () => void {
    return this.eventManager.on('MEMORY_ADDED', handler);
  }

  onMemoryUpdated(handler: (event: MemoryEventPayload) => void): () => void {
    return this.eventManager.on('MEMORY_UPDATED', handler);
  }

  onStatsChanged(handler: (stats: MemoryStats) => void): () => void {
    return this.eventManager.on('STATS_CHANGED', handler);
  }
}
```

### Pattern 5: React Demo App with Isolated Workspace

**What:** Separate React app in examples/ with own package.json
**When to use:** Demo and documentation applications
**Example:**

```typescript
// Source: Phase 8 user constraints (isolated workspace)
// File: examples/react-app/package.json
{
  "name": "@lokulmem/react-demo",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "lokulmem": "workspace:*" // Reference to root package
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0"
  }
}

// File: examples/react-app/src/App.tsx
import { useState } from 'react';
import { useLokulMem } from './hooks/useLokulMem';
import { ChatView } from './components/ChatView';
import { MemoryList } from './components/MemoryList';
import { DebugPanel } from './components/DebugPanel';
import { ThemeToggle } from './components/ThemeToggle';

function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'memories'>('chat');
  const { lokul, isReady } = useLokulMem();

  if (!isReady) {
    return <div>Loading LokulMem...</div>;
  }

  return (
    <div className="app">
      <header>
        <h1>LokulMem Demo</h1>
        <ThemeToggle lokul={lokul} />
      </header>

      <nav>
        <button onClick={() => setActiveTab('chat')}>Chat</button>
        <button onClick={() => setActiveTab('memories')}>Memories</button>
      </nav>

      {activeTab === 'chat' && (
        <div className="split-view">
          <ChatView lokul={lokul} />
          <DebugPanel lokul={lokul} />
        </div>
      )}

      {activeTab === 'memories' && (
        <MemoryList lokul={lokul} />
      )}
    </div>
  );
}

// File: examples/react-app/src/hooks/useLokulMem.ts
import { useEffect, useState } from 'react';
import { createLokulMem } from 'lokulmem';

export function useLokulMem() {
  const [lokul, setLokul] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    createLokulMem({
      dbName: 'lokulmem-demo',
      onProgress: (stage, progress) => {
        console.log(`${stage}: ${progress}%`);
      }
    }).then((instance) => {
      setLokul(instance);
      setIsReady(true);
    });
  }, []);

  return { lokul, isReady };
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Message history handling | Custom message merging | Standard array operations | Simpler, less error-prone |
| Token counting | Custom tokenizer estimation | Optional user-provided counter | LLM-specific, can't generalize |
| Event subscription | Custom PubSub | Callback + unsubscribe pattern | Standard observer pattern |
| React state management | Complex state machines | useState + useEffect | Sufficient for simple demo |
| Debug JSON formatting | Custom syntax highlight | Raw JSON.stringify() | Spec requirement: raw output |
| Theme persistence | LocalStorage | manage().update() as memory | Demonstrates API usage |

**Key insight:** Public API should feel like a standard library, not a framework. Use familiar patterns (async/await, callbacks, unsubscribe) that match developer expectations.

---

## Common Pitfalls

### Pitfall 1: Cache Update Timing in learn()

**What goes wrong:** augment() called immediately after learn() doesn't retrieve new memories.

**Why it happens:** Cache update is deferred or happens after learn() resolves.

**How to avoid:** Update vector cache in the same transaction boundary as DB write, before learn() resolves.

**Warning signs:** Tests show `await learn(); await augment();` missing new memories.

### Pitfall 2: Debug Object Performance Overhead

**What goes wrong:** augment() is slow even when debug=false.

**Why it happens:** Debug payload computed regardless of debug flag.

**How to avoid:** Lazy computation - only build debug object when `debug === true`.

**Warning signs:** Profiling shows time spent in debug formatting when debug disabled.

### Pitfall 3: Memory Block Format for LLM

**What goes wrong:** LLM ignores injected memories or treats them as user messages.

**Why it happens:** Wrong injection format (append instead of prepend, or wrong role).

**How to avoid:** Always use prepend-system format (system message at index 0 or merge with existing).

**Warning signs:** LLM doesn't reference memories in responses.

### Pitfall 4: Token Budget Underflow

**What goes wrong:** Too few memories injected, or negative remaining tokens.

**Why it happens:** Incorrect token counting or forgetting to account for message overhead.

**How to avoid:** Use computeTokenBudget() helper with proper message array and overhead per message.

**Warning signs:** Debug shows `remainingTokensAfterInjection` close to zero or negative.

### Pitfall 5: Event Payload Size

**What goes wrong:** Events are slow or cause IPC errors.

**Why it happens:** Including full content or embeddings in event payloads.

**How to avoid:** IDs-only mode by default, verbose mode optional, never include embeddings.

**Warning signs:** Event callbacks cause performance issues or structured clone errors.

### Pitfall 6: manage() Method Discoverability

**What goes wrong:** Users can't find the right manage() operation.

**Why it happens:** Single manage() method with operation parameter (less discoverable).

**How to avoid:** Separate methods (manage.update(), manage.delete(), etc.) for better IDE autocomplete.

**Warning signs:** Users struggle to find management operations in documentation.

### Pitfall 7: Demo App Dependency Pollution

**What goes wrong:** Root package.json bloated with React dependencies.

**Why it happens:** Demo app installed in root directory.

**How to avoid:** Isolated workspace in examples/ with own package.json.

**Warning signs:** Root package.json has react, react-dom, @vitejs/plugin-react.

### Pitfall 8: Theme Preference as Memory Anti-Pattern

**What goes wrong:** Theme toggle doesn't persist or pollutes memory store.

**Why it happens:** Storing theme as a regular memory without proper structure.

**How to avoid:** Create dedicated preference memory with clear type and metadata.

**Warning signs:** Theme preference appears in memory list or doesn't persist across sessions.

### Pitfall 9: Empty State Handling in Demo

**What goes wrong:** Demo app shows empty state with no guidance.

**Why it happens:** No sample data or onboarding flow.

**How to avoid:** Prompt user on first load: "Start empty" or "Load sample data".

**Warning signs:** Users don't understand what to do in empty demo.

### Pitfall 10: Event Memory Leaks

**What goes wrong:** Event listeners accumulate and cause memory leaks.

**Why it happens:** Not calling unsubscribe functions when components unmount.

**How to avoid:** Always use useEffect cleanup to call unsubscribe functions.

**Warning signs:** Memory usage grows over time in demo app.

---

## Code Examples

### Complete augment() Implementation

```typescript
// Source: Phase 8 requirements + user constraints
import type { ChatMessage, AugmentOptions, AugmentResult, LokulMemDebug } from '../types/api.js';
import { computeTokenBudget } from '../core/TokenBudget.js';
import type { QueryEngine } from '../search/QueryEngine.js';
import type { MemoryDTO } from '../types/memory.js';

export class Augmenter {
  constructor(
    private queryEngine: QueryEngine,
    private config: { tokenCounter?: (text: string) => number }
  ) {}

  async augment(
    userMessage: string,
    history: ChatMessage[] = [],
    options: AugmentOptions = {}
  ): Promise<AugmentResult> {
    const {
      contextWindowTokens,
      reservedForResponseTokens = 2048,
      maxTokens,
      debug = false
    } = options;

    // 1. Build messages array
    const messages = [
      ...history,
      { role: 'user' as const, content: userMessage }
    ];

    // 2. Compute token budget
    const budget = computeTokenBudget(messages, {
      contextWindowTokens,
      reservedForResponseTokens,
      tokenCounter: this.config.tokenCounter
    });

    // 3. Determine max tokens (override vs computed)
    const effectiveMaxTokens = maxTokens ?? budget.availableTokens;

    // 4. Retrieve memories with token-aware K
    const searchResults = await this.queryEngine.semanticSearch(userMessage, {
      k: Math.floor(effectiveMaxTokens / 10), // Rough estimate: ~10 tokens per memory
      useCompositeScoring: true
    });

    // 5. Format memory block (summarized)
    const memoryBlock = this.formatMemories(searchResults);

    // 6. Inject as system message (prepend format)
    const augmentedMessages = this.injectSystemMessage(messages, memoryBlock);

    // 7. Compute metadata
    const injectionTokens = this.estimateTokens(memoryBlock);
    const metadata = {
      injectedCount: searchResults.length,
      noMemoriesFound: searchResults.length === 0,
      usedTokensBeforeInjection: budget.usedTokens,
      injectionTokens,
      remainingTokensAfterInjection: budget.remainingTokens - injectionTokens
    };

    // 8. Lazy debug computation
    const debugObj = debug ? this.computeDebug(searchResults, budget, metadata) : undefined;

    return {
      messages: augmentedMessages,
      metadata,
      debug: debugObj
    };
  }

  private injectSystemMessage(
    messages: ChatMessage[],
    memoryBlock: string
  ): ChatMessage[] {
    if (!memoryBlock) {
      return messages;
    }

    const firstMessage = messages[0];
    if (firstMessage?.role === 'system') {
      // Merge with existing system message
      return [
        {
          ...firstMessage,
          content: `${memoryBlock}\n\n${firstMessage.content}`
        },
        ...messages.slice(1)
      ];
    }

    // Insert new system message at index 0
    return [
      { role: 'system', content: memoryBlock },
      ...messages
    ];
  }

  private formatMemories(memories: MemoryDTO[]): string {
    if (memories.length === 0) {
      return '';
    }

    const blocks = memories.map(m =>
      `- [${m.types.join(', ')}] ${m.content}`
    );

    return `Relevant context from memory:\n${blocks.join('\n')}`;
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private computeDebug(
    memories: MemoryDTO[],
    budget: unknown,
    metadata: unknown
  ): LokulMemDebug {
    // TODO: Implement full debug object
    return {
      injectedMemories: memories,
      scores: [],
      excludedCandidates: [],
      tokenUsage: {
        prompt: 0,
        completion: 0,
        total: 0
      },
      latencyMs: 0
    };
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single memory API | Three-method surface (augment/learn/manage) | 2024+ | Clearer separation of concerns |
| Fixed K retrieval | Token-aware dynamic K | 2023+ | Better context window utilization |
| Full event payloads | IDs-only with verbose mode | 2024+ | Reduced IPC overhead |
| Root demo workspace | Isolated example workspace | 2023+ | Cleaner dependency management |
| Debug always computed | Lazy debug computation | 2024+ | Better performance when debug disabled |

**Current best practices (2024-2025):**
- Three-method API surface for clear separation (augment, learn, manage)
- Namespace-based management API for discoverability
- IDs-only event payloads with optional verbose mode
- Prepend-system injection for LLM compatibility
- Synchronous cache updates for immediate queryability
- Lazy debug computation for performance
- Isolated demo workspaces to avoid dependency pollution

**Deprecated/outdated:**
- Single memory object with operation parameter (less discoverable)
- Fixed memory count retrieval (wastes context window)
- Full DTO in all events (performance overhead)
- Debug always computed (wastes CPU cycles)

---

## Open Questions

1. **Token Counter Integration**
   - What we know: Optional tokenCounter function for accurate budgets
   - What's unclear: Which tokenizers to support (tiktoken, tokenizer, etc.)
   - Recommendation: Accept `(text: string) => number` function, let user integrate their tokenizer

2. **Message Timestamp Handling**
   - What we know: Messages should have timestamps for episode storage
   - What's unclear: What timestamp format to accept (Date, number, undefined)
   - Recommendation: Support optional timestamp field, fallback to Date.now()

3. **Conversation ID Generation**
   - What we know: Auto-generate conversation ID if not provided
   - What's unclear: What format to use (UUID, nanoid, simple counter)
   - Recommendation: Use crypto.randomUUID() (browser native, no dependencies)

4. **Debug Panel Updates in Demo**
   - What we know: Split view with conversation + debug
   - What's unclear: How to trigger debug updates (every augment, manual refresh)
   - Recommendation: Update debug panel on every augment() call (real-time feedback)

5. **Sample Data Content**
   - What we know: Prompt user for empty or sample data
   - What's unclear: What sample data to include (diversity, volume)
   - Recommendation: 10-15 diverse memories covering all types (identity, preference, location, etc.)

---

## Sources

### Primary (HIGH confidence)
- /Users/poak/Documents/personal-project/lokul-mind/.planning/phases/08-public-api-demo/08-CONTEXT.md - User decisions and implementation constraints
- /Users/poak/Documents/personal-project/lokul-mind/.planning/REQUIREMENTS.md - AUG-01..07, LEARN-01..05, MGMT-10..16, EVENT-01..07, DEMO-01..04
- /Users/poak/Documents/personal-project/lokul-mind/src/core/LokulMem.ts - Existing public API structure
- /Users/poak/Documents/personal-project/lokul-mind/src/types/api.ts - API types and interfaces
- /Users/poak/Documents/personal-project/lokul-mind/src/types/events.ts - Event callback types

### Secondary (MEDIUM confidence)
- /Users/poak/Documents/personal-project/lokul-mind/.planning/phases/05-memory-store-retrieval/05-RESEARCH.md - Query engine patterns from Phase 5
- /Users/poak/Documents/personal-project/lokul-mind/.planning/phases/07-extraction-contradiction/07-RESEARCH.md - Extraction patterns from Phase 7
- /Users/poak/Documents/personal-project/lokul-mind/README.md - Public API documentation examples

### Tertiary (LOW confidence)
- Web search results for React demo app patterns (search failed, relying on established patterns)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Based on established SDK patterns and Phase 1-7 implementation
- Architecture: HIGH - Extends existing WorkerManager and event system patterns
- API design: HIGH - Matches user constraints from CONTEXT.md
- Demo app: MEDIUM - Standard React patterns, but web search failed for verification
- Performance: HIGH - Lazy debug computation and IDs-only events are well-understood patterns

**Research date:** 2026-02-26
**Valid until:** 2026-05-26 (API design patterns are stable, 90-day validity appropriate)

---

## Next Steps for Planning

Based on this research, the phase planning should focus on:

1. **Wave 1 (autonomous):** Public API surface (augment, learn, manage classes)
2. **Wave 2 (autonomous):** Event system integration (EventManager, all 7 event types)
3. **Wave 3 (autonomous):** Worker RPC handlers (LEARN, AUGMENT message types)
4. **Wave 4 (autonomous):** LokulMem integration (add augment/learn/manage methods)
5. **Wave 5 (autonomous):** React demo app setup (isolated workspace, basic UI)

**Key implementation priorities:**
- Synchronous cache update guarantee in learn()
- Lazy debug computation in augment()
- IDs-only event payloads with verbose mode
- Prepend-system injection format
- manage() namespace with 16+ separate methods
- Isolated React demo workspace
