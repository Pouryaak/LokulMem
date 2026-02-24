# Phase 6: Lifecycle & Decay - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

## Phase Boundary

Memory lifecycle management with Ebbinghaus decay, reinforcement on access, automatic maintenance sweeps, fading, and deletion. This phase delivers:
1. Ebbinghaus forgetting curve — Memories decay over time with category-specific lambda values
2. Reinforcement on access — Retrieved memories get stronger (+0.3 category-based)
3. Maintenance sweep — Session-start + periodic updates of all memory strengths
4. Fading & deletion — Weak memories (< 0.1) marked faded, deleted after 30 days
5. K-means clustering — Organizes memories into groups (separate step after sweep)

This is an internal infrastructure phase — background processes that manage memory lifecycle automatically without user intervention.

## Implementation Decisions

### Decay Calculation

**Hybrid calculation approach:**
- Session-start batch: Calculate decay for all memories during maintenance sweep
- Incremental for frequent access: Calculate on-demand for frequently accessed memories
- Best of both: accurate for active memories, efficient for bulk

**Timestamp for age calculation:**
- Use `lastAccessedAt` as primary timestamp
- Fall back to `createdAt` if `lastAccessedAt` is not set (never accessed)
- Formula: `ageHours = (now - lastAccessedAt) / (1000 * 60 * 60)` (calculate on-demand)

**Timezone handling:**
- Use `Date.now()` for current time (millisecond timestamps)
- UTC implicit in Date.now(), no timezone conversion needed
- Age computed as time delta, so timezone cancels out

**Optimization:**
- Decay calculated only during maintenance sweep (sweep only)
- No pre-computed ageHours stored (always calculate on-demand)
- Efficient for N ≤ 3000: single batch operation is sufficient

**Lambda values:**
- All lambdas must be non-negative (never allow negative)
- Decay is always weakening — no "super-fresh" memories via negative lambda
- Category-based lambdas fixed: identity (0.0001), location (0.0005), profession (0.0003), preferences (0.001), project (0.005), temporal (0.02), relational (0.0004), emotional (0.01)
- Pinned memories have λ = 0 (no decay, never weaken)

### Reinforcement Behavior

**Trigger operations:**
- `get(id)` — Direct memory access reinforces
- `semanticSearch()` — High-relevance retrieval reinforces
- Both operations trigger reinforcement (get + semanticSearch)

**Reinforcement target:**
- Add to `base_strength` (not current strength)
- Original foundation grows, decay formula computes from new base
- Keeps reinforcement meaningful across multiple accesses

**Cap enforcement:**
- Hard cap at 3.0 (enforced, not soft target)
- Stop reinforcing when base_strength ≥ 3.0
- No further strengthening possible once at cap

**Reinforcement amount:**
- Category-based reinforcement (not fixed +0.3 for all)
- Different categories can have different reinforcement values
- Configurable per deployment (e.g., identity +0.5, temporal +0.1, preferences +0.4)

**Write strategy:**
- Debounced writes (batch within time window)
- Prevents excessive DB writes for frequently-accessed memories
- Balances freshness and performance

### Maintenance Sweep

**Trigger timing:**
- Session start (when LokulMem initializes)
- Periodic interval (e.g., every hour) during active use
- Session + periodic: balances freshness and performance

**Execution model:**
- Synchronous during init (blocking)
- Waits for sweep to complete before returning from initialize()
- Simpler, predictable, ensures fresh state at session start

**Batching:**
- Single batch (process all memories at once)
- No chunking or batching for N=3000 (single batch is fine)
- Simpler implementation, sufficient performance

**Write strategy:**
- Cache then batch write
- Update in-memory cache first (for immediate use)
- Flush all changes to DB in single batch operation
- Faster than individual writes, lower risk than pure cache

**Scope:**
- Decay + mark faded + delete (>30 days) in sweep
- K-means clustering as separate step right after sweep
- Still in session-start init, but distinct operations

### Fading & Deletion

**Faded threshold:**
- Configurable threshold (default: 0.1)
- Different deployments can adjust sensitivity
- Memories with `strength < threshold` marked as faded

**Fading behavior:**
- Soft delete (query-excluded)
- Set `status = 'faded'` and record `fadedAt` timestamp
- Exclude from query results (list, search, semanticSearch)
- Can still be retrieved by ID if needed (not hard-deleted)

**Event emission:**
- Both callback and event emitter
- `onMemoryFaded` callback for simple reactions
- Event emitter pattern for multiple subscribers
- Maximum flexibility for different use cases

**Recovery:**
- No recovery mechanism for 30-day faded memories
- Immediate permanent delete after 30 days
- Once deleted, memory is gone (irreversible)

**Deletion timing:**
- Batch delete in maintenance sweep
- Check all faded memories, delete those where `now - fadedAt > 30 days`
- Efficient single operation during periodic sweep

**Event emission:**
- Both callback and event emitter
- `onMemoryDeleted` callback for simple reactions
- Event emitter pattern for multiple subscribers
- Consistent with fading event pattern

### Claude's Discretion

- Exact periodic interval for maintenance sweep (1 hour default, configurable)
- Debounce time window for reinforcement writes (e.g., 5 seconds)
- K-means clustering parameters (k value, max iterations, convergence threshold)
- Whether to track number of reinforcements per memory (for analytics/debugging)
- Progress reporting during maintenance sweep (optional onProgress callback)

## Specific Ideas

- Hybrid decay calculation: Session-start batch for all + incremental for frequent access
- Reinforcement debouncing: Batch writes within time window to avoid excessive DB writes
- Cache-first then batch: Update in-memory cache immediately, flush to DB in batch during sweep
- Separate steps: Decay/fade/delete in sweep, K-means right after (still in init phase)

## Deferred Ideas

- K-means clustering optimization (defer to Phase 7+ when we see actual memory distribution)
- Advanced recovery mechanisms (defer to future requirements if needed)
- Negative lambda for "super-fresh" memories (explicitly rejected — never allow negative)
- Auto-adjusting lambda based on user feedback (defer to future ML-based optimization)

---

*Phase: 06-lifecycle-decay*
*Context gathered: 2026-02-24*
