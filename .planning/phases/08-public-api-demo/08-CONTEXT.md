# Phase 8: Public API & Demo - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete public API surface with augment/learn/manage methods, event system, and working React demo application. This phase implements the user-facing API that developers will interact with, plus a demo app to showcase capabilities.

**Scope:** Public API methods (augment, learn, manage), event callback system, and React demo application. Internal components (Phases 1-7) are already complete.

</domain>

<decisions>
## Implementation Decisions

### augment() behavior

- **Injection format:** Prepend system message (first message is system prompt with injected memories, followed by user message and conversation history)
- **Return type:** Return object with messages and metadata (not just messages array)
- **Memory limits:** Limit by token budget (dynamic K) - use token-aware dynamic K selection from Phase 5
- **No relevant memories:** Flag in metadata, clean return (no_memories_found flag, return user message and history cleanly)
- **Memory formatting:** Summarized memory blocks (content + type + source, shorter and less distracting to LLM)
- **Debug object:** Everything (memories, scores, exclusions, tokens, timing) when options.debug = true
- **Token counting:** Breakdown by stage (injection tokens + total operation tokens)
- **history parameter:** Default to empty history (optional, user-friendly)
- **Error handling:** Hybrid (throw critical only - throw for critical errors, return metadata for warnings)
- **Memory format in prompt:** Summarized blocks (not full DTO)

### learn() behavior

- **Extraction timing:** Always extract (every learn() call runs extraction)
- **Maintenance sweep:** Configurable (runMaintenance option) - user controls when maintenance runs
- **Contradiction handling:** Follow contradiction config (auto/manual) - respect Phase 7 config
- **Extraction source:** Configurable (extractFrom: 'user' | 'assistant' | 'both', default 'both')
- **Return structure:** Grouped by operation ({ extracted: [], contradictions: [], maintenance: {} })
- **Cache updates:** Update synchronously (immediately update in-memory vector cache)
- **Memory details:** Configurable (verbose option) - user controls return verbosity
- **Conversation tracking:** Optional with auto-creation (conversationId optional, generate if missing, return in result)
- **Quality threshold:** Respect extraction threshold, allow override (default E(s) ≥ 0.55, allow learnThreshold option)
- **Auto-association:** Configurable (autoAssociate option) - user controls association with previous augment()
- **Operation order:** Extract → detect contradictions → supersede (logical pipeline order)
- **Event emissions:** Emit individual events (granular: onMemoryAdded, onMemorySuperseded, etc.)
- **Response storage:** Configurable (storeResponse option) - user controls whether assistantResponse stored in episode
- **Timestamp handling:** Message timestamp with fallback (use message timestamp if available, else learn() time)
- **Partial failures:** Skip failed, continue others (best effort - don't fail entire operation if one extraction fails)

### manage() API design

- **Method exposure:** Separate methods for each operation (manage.update(), manage.delete(), etc. - more discoverable than single manage() with operation param)
- **Single operation returns:** Return ID and status only (lightweight)
- **Bulk operation returns:** Summary + arrays ({succeeded: [], failed: [], total, counts} - detailed feedback)
- **Export format:** Both (format option) - support both JSON and Markdown via format option
- **Import mode:** Configurable (mode option: replace/merge) - user controls whether import replaces or merges with existing

### Demo app scope

- **Feature set:** Standard (augment + learn + list) - core workflow showcase
- **Conversation handling:** Single conversation view (simple, focused)
- **Debug visualization:** Split view (conversation + debug) - side-by-side for learning
- **Memory list:** Live reactive list (real-time updates with reactive state)
- **Memory card detail:** Expandable (summary → detail) - summary by default, click to expand
- **Theming:** Light theme only (keep it simple)
- **Data persistence:** Persisted IndexedDB storage (realistic, like real app)
- **Sample data:** Prompt user (empty or sample) - ask on first load, let user choose
- **View structure:** Tab-based navigation (clean separation of views)
- **Debug panel style:** No styling (raw JSON) - show raw debug JSON, technical and simple

### Claude's Discretion

- Exact options interface shapes and defaults for each method
- Event callback timing (when events fire during operation lifecycle)
- Error message content and recovery hints
- Demo app UI component structure and styling approach
- Sample data content and diversity
- Tab organization and routing strategy
- Debug panel JSON formatting (indentation, sorting)

</decisions>

<specifics>
## Specific Ideas

- augment() should "feel like calling a function that returns an LLM-ready messages array"
- learn() should "capture everything useful but not be annoying about configuration"
- manage() should "have discoverable methods that do what they say"
- Demo app should "teach by showing, not by explaining"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-public-api-demo*
*Context gathered: 2026-02-26*
