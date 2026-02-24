# Phase 6: Lifecycle & Decay - Research

**Researched:** 2026-02-24
**Domain:** Memory lifecycle management, Ebbinghaus decay, reinforcement learning, K-means clustering
**Confidence:** HIGH

## Summary

Phase 6 implements the memory lifecycle management system using the Ebbinghaus forgetting curve with per-category decay rates, reinforcement on access, maintenance sweeps, and K-means clustering. This phase delivers the automatic memory management infrastructure that ensures memories decay naturally, important memories are reinforced through access, weak memories are archived, and related memories are organized into clusters.

Key findings:
1. **Ebbinghaus exponential decay** formula: `strength(t) = base_strength × e^(-λ × Δt_hours)` where λ varies by memory category
2. **Per-category lambda values** from requirements: identity (0.0001), location (0.0005), profession (0.0003), preferences (0.001), project (0.005), temporal (0.02), relational (0.0004), emotional (0.01)
3. **Reinforcement on access** strengthens memories: `base_strength += reinforcement_amount` (capped at 3.0)
4. **Maintenance sweep** runs at session start (synchronous) and periodically (async) to update all memory strengths
5. **K-means clustering** organizes memories into semantic groups for improved retrieval and organization
6. **Fading and deletion** lifecycle: weak memories (< threshold) marked as faded, permanently deleted after 30 days
7. **Debounced writes** batch reinforcement updates to avoid excessive IndexedDB operations
8. **Event emission** for memory lifecycle events (faded, deleted) using both callbacks and event emitters

**Primary recommendation:** Implement LifecycleManager class with Ebbinghaus decay calculator, reinforcement tracker with debounced writes, maintenance sweep scheduler, K-means clustering engine, and event emitter for lifecycle events. Integrate with existing MemoryRepository and VectorSearch infrastructure.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Decay Calculation:**
- Formula: `strength(t) = base_strength × e^(-λ × Δt_hours)`
- Age calculation: `ageHours = (now - lastAccessedAt) / (1000 * 60 * 60)` (calculate on-demand)
- Timestamp priority: `lastAccessedAt` primary, `createdAt` fallback if never accessed
- Hybrid approach: Session-start batch for all memories + incremental for frequent access
- Timezone handling: UTC implicit in Date.now(), no conversion needed
- Optimization: Decay calculated only during sweep, no pre-computed ageHours stored

**Lambda Values:**
- All lambdas must be non-negative (never allow negative)
- Decay is always weakening — no "super-fresh" memories via negative lambda
- Category-based lambdas fixed:
  - identity: 0.0001
  - location: 0.0005
  - profession: 0.0003
  - preferences: 0.001
  - project: 0.005
  - temporal: 0.02
  - relational: 0.0004
  - emotional: 0.01
- Pinned memories have λ = 0 (no decay, never weaken)

**Reinforcement Behavior:**
- Trigger operations: `get(id)` and `semanticSearch()` (both trigger reinforcement)
- Reinforcement target: Add to `base_strength` (not current strength)
- Cap enforcement: Hard cap at 3.0 (stop reinforcing when base_strength ≥ 3.0)
- Reinforcement amount: Category-based (not fixed +0.3 for all)
- Configurable per deployment (e.g., identity +0.5, temporal +0.1, preferences +0.4)
- Write strategy: Debounced writes (batch within time window)

**Maintenance Sweep:**
- Trigger timing: Session start + periodic interval (e.g., every hour)
- Execution model: Synchronous during init (blocking, waits for sweep to complete)
- Batching: Single batch (process all memories at once, no chunking for N=3000)
- Write strategy: Cache then batch write (update in-memory cache first, flush to DB in single batch)
- Scope: Decay + mark faded + delete (>30 days) in sweep, K-means as separate step right after

**Fading & Deletion:**
- Faded threshold: Configurable (default: 0.1)
- Fading behavior: Soft delete (set status='faded', record fadedAt timestamp, exclude from queries)
- Event emission: Both callback (`onMemoryFaded`) and event emitter
- Recovery: No recovery mechanism for 30-day faded memories (immediate permanent delete)
- Deletion timing: Batch delete in maintenance sweep (check all faded memories, delete where `now - fadedAt > 30 days`)
- Event emission: Both callback (`onMemoryDeleted`) and event emitter

### Claude's Discretion

- Exact periodic interval for maintenance sweep (1 hour default, configurable)
- Debounce time window for reinforcement writes (e.g., 5 seconds)
- K-means clustering parameters (k value, max iterations, convergence threshold)
- Whether to track number of reinforcements per memory (for analytics/debugging)
- Progress reporting during maintenance sweep (optional onProgress callback)

### Deferred Ideas (OUT OF SCOPE)

- K-means clustering optimization (defer to Phase 7+ when we see actual memory distribution)
- Advanced recovery mechanisms (defer to future requirements if needed)
- Negative lambda for "super-fresh" memories (explicitly rejected — never allow negative)
- Auto-adjusting lambda based on user feedback (defer to future ML-based optimization)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DECAY-01 | Ebbinghaus decay: strength(t) = base_strength × e^(-λ × Δt_hours) | Standard exponential decay formula, λ varies by category |
| DECAY-02 | Per-category λ values: identity (0.0001), location (0.0005), profession (0.0003), preferences (0.001), project (0.005), temporal (0.02), relational (0.0004), emotional (0.01) | Fixed lambda values from requirements, non-negative |
| DECAY-03 | Pinned memories have λ = 0 (no decay) | Zero lambda means no exponential decay factor |
| DECAY-04 | Reinforcement on retrieval: base_strength + 0.3 (max 3.0) | Category-based reinforcement with hard cap |
| DECAY-05 | Maintenance sweep runs at session start | Synchronous during init, periodic during session |
| DECAY-06 | Faded memories (strength < 0.1) marked as faded, deleted after 30 days | Soft delete with timestamp, batch deletion after threshold |
| DECAY-07 | K-means clustering runs synchronously in worker | Organizes memories into semantic groups |
| DECAY-08 | `fadedAt` timestamp field records when memory transitioned to faded status | Enables 30-day deletion policy |
| DECAY-09 | Faded memory deletion runs during session-start maintenance sweep | Batch delete operation during periodic sweep |

---

## Standard Stack

### Core
| Component | Implementation | Purpose | Why Standard |
|-----------|----------------|---------|--------------|
| Decay Calculator | Custom Ebbinghaus implementation | Compute memory strength over time | Standard exponential decay formula |
| Reinforcement Tracker | Debounced write queue | Batch reinforcement updates | Reduces IndexedDB write overhead |
| Maintenance Sweep | Scheduled task runner | Periodic memory lifecycle updates | Standard maintenance pattern |
| K-means Clustering | Custom Lloyd's algorithm | Group related memories | Simple, effective for N ≤ 3,000 |

### Supporting
| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| Debounced writes | Batch DB updates | Frequent reinforcement operations |
| Event emitter | Lifecycle notifications | Memory faded, deleted events |
| Cache-then-batch | Update performance | Reduce transaction overhead |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom K-means | External ML library | Adds bundle size, overkill for small N |
| Per-category lambda | Single global lambda | Less nuanced decay, doesn't match requirements |
| Debounced writes | Immediate writes | Excessive DB operations, poor performance |
| Cache-then-batch | Direct DB writes | Slower, more transaction overhead |

**Why no external ML library:**
- For N ≤ 3,000, custom K-means is sufficient (~50ms)
- External libraries (ml-js, danfo.js) add significant bundle size
- K-means algorithm is simple to implement correctly
- Full control over clustering parameters and convergence

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lifecycle/
│   ├── LifecycleManager.ts     # Main lifecycle orchestrator
│   ├── DecayCalculator.ts      # Ebbinghaus decay computation
│   ├── ReinforcementTracker.ts # Debounced reinforcement writes
│   ├── MaintenanceSweep.ts     # Periodic maintenance scheduler
│   ├── KMeansClusterer.ts      # K-means clustering engine
│   ├── EventEmitter.ts         # Lifecycle event emission
│   └── types.ts                # Lifecycle-specific types
├── worker/
│   └── index.ts                # Worker entry (adds lifecycle handlers)
```

### Pattern 1: Ebbinghaus Decay Calculation
**What:** Compute memory strength using exponential decay formula with category-based lambda
**When to use:** All decay calculations during maintenance sweep
**Example:**
```typescript
// Source: DECAY-01 requirement + CONTEXT.md decisions
interface DecayConfig {
  lambdaByCategory: Partial<Record<MemoryType, number>>;
  pinnedLambda: number; // Always 0
  fadedThreshold: number; // Default 0.1
}

interface DecayResult {
  memoryId: string;
  oldStrength: number;
  newStrength: number;
  isFaded: boolean;
}

class DecayCalculator {
  private readonly DEFAULT_LAMBDA = 0.001; // Fallback for unknown categories

  constructor(private config: DecayConfig) {}

  // Calculate decay for a single memory
  calculateDecay(
    memory: MemoryInternal,
    now: number
  ): DecayResult {
    const oldStrength = memory.currentStrength;
    const lambda = memory.pinned
      ? this.config.pinnedLambda // 0 for pinned
      : this.getLambdaForTypes(memory.types);

    // Calculate age in hours
    const timestamp = memory.lastAccessedAt || memory.createdAt;
    const ageHours = (now - timestamp) / (1000 * 60 * 60);

    // Ebbinghaus formula: strength(t) = base_strength × e^(-λ × Δt_hours)
    const decayFactor = Math.exp(-lambda * ageHours);
    const newStrength = memory.baseStrength * decayFactor;

    // Check if faded
    const isFaded = newStrength < this.config.fadedThreshold && !memory.pinned;

    return {
      memoryId: memory.id,
      oldStrength,
      newStrength,
      isFaded,
    };
  }

  // Calculate decay for multiple memories (batch)
  calculateDecayBatch(
    memories: MemoryInternal[],
    now: number
  ): DecayResult[] {
    return memories.map(memory => this.calculateDecay(memory, now));
  }

  // Get lambda for memory types (use smallest lambda if multiple types)
  private getLambdaForTypes(types: MemoryType[]): number {
    let minLambda = this.DEFAULT_LAMBDA;

    for (const type of types) {
      const lambda = this.config.lambdaByCategory[type] ?? this.DEFAULT_LAMBDA;
      minLambda = Math.min(minLambda, lambda);
    }

    return minLambda;
  }

  // Check if lambda value is valid (non-negative)
  private validateLambda(lambda: number): void {
    if (lambda < 0) {
      throw new Error(`Lambda must be non-negative, got ${lambda}`);
    }
  }
}
```

### Pattern 2: Reinforcement Tracker with Debounced Writes
**What:** Track memory access and batch reinforcement updates to IndexedDB
**When to use:** After `get()` and `semanticSearch()` operations
**Example:**
```typescript
// Source: DECAY-04 requirement + CONTEXT.md decisions
interface ReinforcementConfig {
  reinforcementByCategory: Partial<Record<MemoryType, number>>;
  maxBaseStrength: number; // 3.0
  debounceWindowMs: number; // 5000 (5 seconds default)
}

interface ReinforcementTask {
  memoryId: string;
  category: MemoryType;
  timestamp: number;
}

class ReinforcementTracker {
  private pendingReinforcements = new Map<string, ReinforcementTask>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private config: ReinforcementConfig,
    private repository: MemoryRepository
  ) {}

  // Record memory access for reinforcement
  async recordAccess(memory: MemoryInternal): Promise<void> {
    // Skip if at cap
    if (memory.baseStrength >= this.config.maxBaseStrength) {
      return;
    }

    // Get primary category for reinforcement amount
    const category = memory.types[0] ?? 'preference';
    const reinforcementAmount = this.config.reinforcementByCategory[category] ?? 0.3;

    // Check if reinforcement would exceed cap
    if (memory.baseStrength + reinforcementAmount > this.config.maxBaseStrength) {
      return; // Don't reinforce if it would exceed cap
    }

    // Add to pending queue
    this.pendingReinforcements.set(memory.id, {
      memoryId: memory.id,
      category,
      timestamp: Date.now(),
    });

    // Schedule debounced write
    this.scheduleDebouncedWrite();
  }

  // Debounced batch write to IndexedDB
  private scheduleDebouncedWrite(): void {
    if (this.debounceTimer) {
      return; // Already scheduled
    }

    this.debounceTimer = setTimeout(async () => {
      await this.flushPendingReinforcements();
      this.debounceTimer = null;
    }, this.config.debounceWindowMs);
  }

  // Flush all pending reinforcements to DB in single transaction
  private async flushPendingReinforcements(): Promise<void> {
    if (this.pendingReinforcements.size === 0) {
      return;
    }

    const reinforcements = Array.from(this.pendingReinforcements.values());
    this.pendingReinforcements.clear();

    // Fetch all memories to update
    const memoryIds = reinforcements.map(r => r.memoryId);
    const memories = await Promise.all(
      memoryIds.map(id => this.repository.getById(id))
    );
    const validMemories = memories.filter((m): m is MemoryInternal => m !== null);

    // Calculate new base strengths
    const updates = validMemories.map(memory => {
      const task = reinforcements.find(r => r.memoryId === memory.id)!;
      const reinforcementAmount = this.config.reinforcementByCategory[task.category] ?? 0.3;

      // Apply reinforcement with cap
      const newBaseStrength = Math.min(
        memory.baseStrength + reinforcementAmount,
        this.config.maxBaseStrength
      );

      return {
        ...memory,
        baseStrength: newBaseStrength,
        lastAccessedAt: Date.now(), // Update access time
        mentionCount: memory.mentionCount + 1,
      };
    });

    // Batch write using Dexie bulkPut
    await this.repository.bulkUpdateStrengths(updates);

    console.log(`[ReinforcementTracker] Applied ${updates.length} reinforcements`);
  }

  // Force flush (call before shutdown, session end, etc.)
  async forceFlush(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    await this.flushPendingReinforcements();
  }

  // Get pending count for debugging
  getPendingCount(): number {
    return this.pendingReinforcements.size;
  }
}
```

### Pattern 3: Maintenance Sweep Scheduler
**What:** Schedule and execute periodic maintenance sweeps for decay, fading, deletion
**When to use:** Session start (synchronous) and periodic intervals (async)
**Example:**
```typescript
// Source: DECAY-05 requirement + CONTEXT.md decisions
interface MaintenanceConfig {
  sweepIntervalMs: number; // 3600000 (1 hour default)
  onProgress?: (stage: string, progress: number) => void;
}

class MaintenanceSweep {
  private periodicTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private config: MaintenanceConfig,
    private decayCalculator: DecayCalculator,
    private reinforcementTracker: ReinforcementTracker,
    private repository: MemoryRepository,
    private eventEmitter: LifecycleEventEmitter
  ) {}

  // Run maintenance sweep (synchronous during init)
  async runSweep(): Promise<{
    decayedCount: number;
    fadedCount: number;
    deletedCount: number;
  }> {
    this.config.onProgress?.('decay', 0);

    // Step 1: Flush pending reinforcements first
    await this.reinforcementTracker.forceFlush();

    // Step 2: Calculate decay for all memories
    const allMemories = await this.repository.getAll();
    const now = Date.now();
    const decayResults = this.decayCalculator.calculateDecayBatch(allMemories, now);

    this.config.onProgress?.('decay', 50);

    // Step 3: Separate faded memories and update strengths
    const fadedMemories: MemoryInternal[] = [];
    const updates: MemoryInternal[] = [];

    for (let i = 0; i < decayResults.length; i++) {
      const result = decayResults[i]!;
      const memory = allMemories[i]!;

      // Update current strength
      memory.currentStrength = result.newStrength;

      if (result.isFaded && memory.status === 'active') {
        // Mark as faded
        memory.status = 'faded';
        memory.fadedAt = now;
        fadedMemories.push(memory);
      }

      updates.push(memory);
    }

    // Step 4: Batch write all updates (cache then batch)
    await this.repository.bulkUpdateCurrentStrengths(updates);

    this.config.onProgress?.('decay', 75);

    // Step 5: Emit fade events
    for (const memory of fadedMemories) {
      await this.eventEmitter.emitMemoryFaded(memory);
    }

    this.config.onProgress?.('decay', 90);

    // Step 6: Delete faded memories older than 30 days
    const deletedCount = await this.deleteOldFadedMemories(now);

    this.config.onProgress?.('decay', 100);

    return {
      decayedCount: updates.length,
      fadedCount: fadedMemories.length,
      deletedCount,
    };
  }

  // Delete faded memories older than 30 days
  private async deleteOldFadedMemories(now: number): Promise<number> {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const cutoffTime = now - thirtyDaysMs;

    // Get all faded memories
    const fadedMemories = await this.repository.findByStatus('faded');

    // Filter those older than 30 days
    const toDelete = fadedMemories.filter(m =>
      m.fadedAt !== null && m.fadedAt < cutoffTime
    );

    if (toDelete.length === 0) {
      return 0;
    }

    // Batch delete
    const idsToDelete = toDelete.map(m => m.id);
    await this.repository.bulkDelete(idsToDelete);

    // Emit delete events
    for (const memory of toDelete) {
      await this.eventEmitter.emitMemoryDeleted(memory.id);
    }

    console.log(`[MaintenanceSweep] Deleted ${toDelete.length} old faded memories`);
    return toDelete.length;
  }

  // Start periodic sweeps
  startPeriodicSweeps(): void {
    if (this.periodicTimer) {
      return; // Already started
    }

    this.periodicTimer = setInterval(async () => {
      try {
        await this.runSweep();
      } catch (error) {
        console.error('[MaintenanceSweep] Periodic sweep failed:', error);
      }
    }, this.config.sweepIntervalMs);

    console.log(`[MaintenanceSweep] Started periodic sweeps (interval: ${this.config.sweepIntervalMs}ms)`);
  }

  // Stop periodic sweeps
  stopPeriodicSweeps(): void {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
      console.log('[MaintenanceSweep] Stopped periodic sweeps');
    }
  }

  // Cleanup on shutdown
  async shutdown(): Promise<void> {
    this.stopPeriodicSweeps();
    await this.reinforcementTracker.forceFlush();
  }
}
```

### Pattern 4: K-means Clustering Engine
**What:** Organize memories into semantic clusters using Lloyd's algorithm
**When to use:** After maintenance sweep, separate step in init phase
**Example:**
```typescript
// Source: DECAY-07 requirement
interface KMeansConfig {
  k: number; // Number of clusters (default: sqrt(N/2) or fixed)
  maxIterations: number; // Default: 100
  convergenceThreshold: number; // Default: 0.001
}

interface ClusterResult {
  clusters: Map<string, string>; // memoryId -> clusterId
  centroids: Map<string, Float32Array>; // clusterId -> centroid
  iterations: number;
  converged: boolean;
}

class KMeansClusterer {
  constructor(
    private config: KMeansConfig,
    private repository: MemoryRepository,
    private vectorSearch: VectorSearch
  ) {}

  // Run K-means clustering on active memories
  async cluster(): Promise<ClusterResult> {
    // Get all active memories
    const memories = await this.repository.findByStatus('active');

    if (memories.length < this.config.k) {
      console.log(`[KMeans] Not enough memories (${memories.length}) for ${this.config.k} clusters`);
      return {
        clusters: new Map(),
        centroids: new Map(),
        iterations: 0,
        converged: false,
      };
    }

    // Extract embeddings
    const memoryIds: string[] = [];
    const embeddings: Float32Array[] = [];

    for (const memory of memories) {
      const embedding = this.vectorSearch.get(memory.id);
      if (embedding) {
        memoryIds.push(memory.id);
        embeddings.push(embedding);
      }
    }

    // Initialize centroids (k-means++ or random)
    const centroids = this.initializeCentroids(embeddings);

    // Lloyd's algorithm
    let converged = false;
    let iteration = 0;
    let clusters = new Map<string, string>();

    while (!converged && iteration < this.config.maxIterations) {
      // Assign each memory to nearest centroid
      const newClusters = this.assignToClusters(memoryIds, embeddings, centroids);

      // Update centroids
      const newCentroids = this.updateCentroids(memoryIds, embeddings, newClusters, centroids);

      // Check convergence
      converged = this.checkConvergence(centroids, newCentroids);

      clusters = newClusters;
      iteration++;
    }

    // Update memory clusterIds in DB
    await this.updateMemoryClusters(clusters);

    return {
      clusters,
      centroids: this.centroidsToMap(centroids),
      iterations: iteration,
      converged,
    };
  }

  // Initialize centroids using k-means++ (better than random)
  private initializeCentroids(embeddings: Float32Array[]): Float32Array[] {
    const centroids: Float32Array[] = [];
    const dims = embeddings[0]!.length;

    // Choose first centroid randomly
    const firstIndex = Math.floor(Math.random() * embeddings.length);
    centroids.push(embeddings[firstIndex]!);

    // Choose remaining centroids using k-means++ probability distribution
    while (centroids.length < this.config.k) {
      const distances = embeddings.map(embedding => {
        const minDist = Math.min(
          ...centroids.map(c => this.euclideanDistance(embedding, c))
        );
        return minDist * minDist; // Squared distance
      });

      // Choose centroid with probability proportional to squared distance
      const totalDist = distances.reduce((sum, d) => sum + d, 0);
      let threshold = Math.random() * totalDist;
      let selectedIndex = 0;

      for (let i = 0; i < distances.length; i++) {
        threshold -= distances[i]!;
        if (threshold <= 0) {
          selectedIndex = i;
          break;
        }
      }

      centroids.push(embeddings[selectedIndex]!);
    }

    return centroids;
  }

  // Assign memories to nearest centroid
  private assignToClusters(
    memoryIds: string[],
    embeddings: Float32Array[],
    centroids: Float32Array[]
  ): Map<string, string> {
    const clusters = new Map<string, string>();

    for (let i = 0; i < embeddings.length; i++) {
      const embedding = embeddings[i]!;
      let minDist = Infinity;
      let nearestCluster = 0;

      for (let c = 0; c < centroids.length; c++) {
        const dist = this.euclideanDistance(embedding, centroids[c]!);
        if (dist < minDist) {
          minDist = dist;
          nearestCluster = c;
        }
      }

      clusters.set(memoryIds[i]!, `cluster-${nearestCluster}`);
    }

    return clusters;
  }

  // Update centroids to mean of assigned points
  private updateCentroids(
    memoryIds: string[],
    embeddings: Float32Array[],
    clusters: Map<string, string>,
    oldCentroids: Float32Array[]
  ): Float32Array[] {
    const newCentroids: Float32Array[] = [];
    const dims = oldCentroids[0]!.length;

    for (let c = 0; c < this.config.k; c++) {
      const clusterId = `cluster-${c}`;
      const clusterEmbeddings: Float32Array[] = [];

      // Find all memories in this cluster
      for (let i = 0; i < memoryIds.length; i++) {
        if (clusters.get(memoryIds[i]!) === clusterId) {
          clusterEmbeddings.push(embeddings[i]!);
        }
      }

      // Calculate mean centroid
      const centroid = new Float32Array(dims);
      if (clusterEmbeddings.length > 0) {
        for (const embedding of clusterEmbeddings) {
          for (let d = 0; d < dims; d++) {
            centroid[d]! += embedding[d]!;
          }
        }
        for (let d = 0; d < dims; d++) {
          centroid[d]! /= clusterEmbeddings.length;
        }
      }

      newCentroids.push(centroid);
    }

    return newCentroids;
  }

  // Check if centroids have converged
  private checkConvergence(
    oldCentroids: Float32Array[],
    newCentroids: Float32Array[]
  ): boolean {
    for (let c = 0; c < this.config.k; c++) {
      const shift = this.euclideanDistance(oldCentroids[c]!, newCentroids[c]!);
      if (shift > this.config.convergenceThreshold) {
        return false;
      }
    }
    return true;
  }

  // Euclidean distance between two vectors
  private euclideanDistance(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i]! - b[i]!;
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  // Update clusterId in memories table
  private async updateMemoryClusters(clusters: Map<string, string>): Promise<void> {
    const updates: Array<{ id: string; clusterId: string }> = [];

    for (const [memoryId, clusterId] of clusters) {
      updates.push({ id: memoryId, clusterId });
    }

    // Batch update using repository
    await this.repository.bulkUpdateClusterIds(updates);

    console.log(`[KMeans] Updated ${updates.length} memory cluster assignments`);
  }

  // Convert centroids array to Map
  private centroidsToMap(centroids: Float32Array[]): Map<string, Float32Array> {
    const map = new Map<string, Float32Array>();
    for (let i = 0; i < centroids.length; i++) {
      map.set(`cluster-${i}`, centroids[i]!);
    }
    return map;
  }
}
```

### Pattern 5: Lifecycle Event Emitter
**What:** Emit events for memory lifecycle changes (faded, deleted)
**When to use:** During maintenance sweep when memories transition state
**Example:**
```typescript
// Source: CONTEXT.md (event emission requirements)
interface LifecycleEventHandlers {
  onMemoryFaded?: (memory: MemoryDTO) => void;
  onMemoryDeleted?: (memoryId: string) => void;
}

class LifecycleEventEmitter {
  private fadedHandlers: Array<(memory: MemoryDTO) => void> = [];
  private deletedHandlers: Array<(memoryId: string) => void> = [];

  // Register fade event handler
  onMemoryFaded(handler: (memory: MemoryDTO) => void): () => void {
    this.fadedHandlers.push(handler);
    return () => {
      const index = this.fadedHandlers.indexOf(handler);
      if (index > -1) {
        this.fadedHandlers.splice(index, 1);
      }
    };
  }

  // Register delete event handler
  onMemoryDeleted(handler: (memoryId: string) => void): () => void {
    this.deletedHandlers.push(handler);
    return () => {
      const index = this.deletedHandlers.indexOf(handler);
      if (index > -1) {
        this.deletedHandlers.splice(index, 1);
      }
    };
  }

  // Emit memory faded event
  async emitMemoryFaded(memory: MemoryInternal): Promise<void> {
    const dto = this.toDTO(memory);

    for (const handler of this.fadedHandlers) {
      try {
        await handler(dto);
      } catch (error) {
        console.error('[LifecycleEventEmitter] Fade handler error:', error);
      }
    }
  }

  // Emit memory deleted event
  async emitMemoryDeleted(memoryId: string): Promise<void> {
    for (const handler of this.deletedHandlers) {
      try {
        await handler(memoryId);
      } catch (error) {
        console.error('[LifecycleEventEmitter] Delete handler error:', error);
      }
    }
  }

  // Convert MemoryInternal to MemoryDTO
  private toDTO(memory: MemoryInternal): MemoryDTO {
    const { embedding, ...dto } = memory;
    return dto as MemoryDTO;
  }
}
```

### Anti-Patterns to Avoid

**Computing ageHours on every access:** Age should be calculated on-demand during sweep, not stored or pre-computed.

**Using negative lambda values:** Never allow negative lambda (would cause "super-fresh" memories). All lambdas must be non-negative.

**Reinforcing current strength:** Always reinforce base_strength, not currentStrength (decay formula computes from new base).

**Immediate writes for reinforcement:** Always use debounced writes to avoid excessive DB operations.

**Deleting faded memories immediately:** Always wait 30 days after fading before permanent deletion.

**Running K-means during every sweep:** Run K-means as separate step after sweep, not during decay calculation.

**Synchronous periodic sweeps:** Only session-start sweep should be synchronous. Periodic sweeps should be async.

**Not handling pinned memories:** Always check pinned flag and use λ=0 for pinned memories.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| K-means clustering | External ML library (ml-js, danfo-js) | Custom implementation | Simple algorithm, no bundle bloat |
| Event emitter | Custom pub/sub system | Callback arrays with unsubscribe | Simpler, sufficient for lifecycle events |
| Debounced writes | Custom debounce with setTimeout | Standard debounce pattern | Well-tested pattern, predictable behavior |
| Batch updates | Manual transaction management | Dexie.js bulkPut/bulkUpdate | Already integrated, handles transactions |

**Key insight:** K-means is simple enough to implement correctly in ~200 lines. External ML libraries add 100KB+ bundle size for features we don't need. Event emission with callbacks is sufficient for lifecycle events—no need for complex pub/sub systems.

---

## Common Pitfalls

### Pitfall 1: Time Unit Confusion in Decay Formula
**What goes wrong:** Memories decay too fast or never decay due to incorrect time units.
**Why it happens:** Using milliseconds instead of hours, or mixing time units.
**How to avoid:** Always convert to hours: `ageHours = (now - lastAccessedAt) / (1000 * 60 * 60)`
**Warning signs:** All memories decay immediately, or none ever decay.

### Pitfall 2: Negative Lambda Values
**What goes wrong:** Memory strength increases over time instead of decreasing.
**Why it happens:** Lambda becomes negative, making decay factor > 1.
**How to avoid:** Validate all lambda values: `if (lambda < 0) throw new Error(...)`
**Warning signs:** Memories get stronger over time without access.

### Pitfall 3: Reinforcing Current Strength Instead of Base
**What goes wrong:** Reinforcement doesn't persist, gets overwritten by next decay calculation.
**Why it happens:** Adding reinforcement to currentStrength instead of baseStrength.
**How to avoid:** Always reinforce base_strength: `memory.baseStrength += reinforcementAmount`
**Warning signs:** Repeatedly accessed memories still fade quickly.

### Pitfall 4: Excessive DB Writes from Reinforcement
**What goes wrong:** IndexedDB performance degrades with frequent reinforcement writes.
**Why it happens:** Writing to DB on every memory access without debouncing.
**How to avoid:** Use debounced writes with configurable window (default 5 seconds).
**Warning signs:** UI freezes during memory access, IndexedDB transaction errors.

### Pitfall 5: Not Handling Pinned Memories
**What goes wrong:** Pinned memories decay over time despite being "pinned."
**Why it happens:** Using category lambda instead of zero for pinned memories.
**How to avoid:** Always check pinned flag: `const lambda = memory.pinned ? 0 : getCategoryLambda(types)`
**Warning signs:** User-pinned memories disappear from search results.

### Pitfall 6: Deleting Faded Memories Too Soon
**What goes wrong:** User loses recently faded memories before they can review them.
**Why it happens:** Deleting immediately on fade instead of waiting 30 days.
**How to avoid:** Check fade age: `if (now - fadedAt > 30 days) delete`
**Warning signs:** Memories disappear right after being marked as faded.

### Pitfall 7: K-means Convergence Issues
**What goes wrong:** K-means never converges or produces empty clusters.
**Why it happens:** Poor initialization, insufficient iterations, or wrong convergence threshold.
**How to avoid:** Use k-means++ initialization, max 100 iterations, convergence threshold 0.001.
**Warning signs:** Clustering hangs forever, all memories in one cluster.

### Pitfall 8: Blocking Session Start with Large Sweep
**What goes wrong:** App takes 10+ seconds to initialize with thousands of memories.
**Why it happens:** Synchronous sweep processing too many memories without optimization.
**How to avoid:** Use efficient batch operations, limit processing to N ≤ 3000 (current target).
**Warning signs:** Slow app startup, init timeout errors.

### Pitfall 9: Memory Leaks from Event Handlers
**What goes wrong:** Event handlers accumulate over time, never get cleaned up.
**Why it happens:** Not providing unsubscribe function or not cleaning up on shutdown.
**How to avoid:** Always return unsubscribe function: `onMemoryFaded(handler) => () => { ... }`
**Warning signs:** Increasing memory usage over time, slower performance.

### Pitfall 10: Race Conditions in Periodic Sweeps
**What goes wrong:** Multiple sweeps run simultaneously, corrupting memory state.
**Why it happens:** Not checking if sweep is already running before starting new one.
**How to avoid:** Use running flag: `if (isSweepRunning) return; isSweepRunning = true;`
**Warning signs:** Inconsistent memory states, duplicate events, DB errors.

---

## Code Examples

### Complete LifecycleManager Implementation
```typescript
// Source: DECAY-01..09 requirements + CONTEXT.md decisions
import type { MemoryInternal } from '../internal/types.js';
import type { MemoryRepository } from '../storage/MemoryRepository.js';
import type { VectorSearch } from '../search/VectorSearch.js';
import { DecayCalculator } from './DecayCalculator.js';
import { ReinforcementTracker } from './ReinforcementTracker.js';
import { MaintenanceSweep } from './MaintenanceSweep.js';
import { KMeansClusterer } from './KMeansClusterer.js';
import { LifecycleEventEmitter } from './EventEmitter.js';

export interface LifecycleConfig {
  // Decay configuration
  lambdaByCategory: Partial<Record<MemoryType, number>>;
  pinnedLambda: number;
  fadedThreshold: number;

  // Reinforcement configuration
  reinforcementByCategory: Partial<Record<MemoryType, number>>;
  maxBaseStrength: number;
  reinforcementDebounceMs: number;

  // Maintenance configuration
  maintenanceIntervalMs: number;
  onProgress?: (stage: string, progress: number) => void;

  // K-means configuration
  kMeansK?: number; // Auto-calculate if not specified
  kMeansMaxIterations: number;
  kMeansConvergenceThreshold: number;
}

export interface LifecycleStats {
  totalMemories: number;
  activeMemories: number;
  fadedMemories: number;
  lastSweepTime: number;
  nextSweepTime: number | null;
  pendingReinforcements: number;
}

export class LifecycleManager {
  private decayCalculator: DecayCalculator;
  private reinforcementTracker: ReinforcementTracker;
  private maintenanceSweep: MaintenanceSweep;
  private kMeansClusterer: KMeansClusterer;
  private eventEmitter: LifecycleEventEmitter;
  private lastSweepTime = 0;
  private isInitialized = false;

  constructor(
    private repository: MemoryRepository,
    private vectorSearch: VectorSearch,
    config: LifecycleConfig
  ) {
    // Initialize components
    this.decayCalculator = new DecayCalculator({
      lambdaByCategory: config.lambdaByCategory,
      pinnedLambda: config.pinnedLambda,
      fadedThreshold: config.fadedThreshold,
    });

    this.reinforcementTracker = new ReinforcementTracker(
      {
        reinforcementByCategory: config.reinforcementByCategory,
        maxBaseStrength: config.maxBaseStrength,
        debounceWindowMs: config.reinforcementDebounceMs,
      },
      repository
    );

    this.eventEmitter = new LifecycleEventEmitter();

    this.maintenanceSweep = new MaintenanceSweep(
      {
        sweepIntervalMs: config.maintenanceIntervalMs,
        onProgress: config.onProgress,
      },
      this.decayCalculator,
      this.reinforcementTracker,
      repository,
      this.eventEmitter
    );

    this.kMeansClusterer = new KMeansClusterer(
      {
        k: config.kMeansK ?? this.calculateOptimalK(),
        maxIterations: config.kMeansMaxIterations,
        convergenceThreshold: config.kMeansConvergenceThreshold,
      },
      repository,
      vectorSearch
    );
  }

  // Initialize: run session-start sweep and initial clustering
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('[LifecycleManager] Starting initialization...');

    // Step 1: Run maintenance sweep (synchronous, blocks init)
    const sweepResult = await this.maintenanceSweep.runSweep();
    console.log(`[LifecycleManager] Sweep complete: ${sweepResult.decayedCount} decayed, ${sweepResult.fadedCount} faded, ${sweepResult.deletedCount} deleted`);

    // Step 2: Run K-means clustering (separate step)
    const clusterResult = await this.kMeansClusterer.cluster();
    console.log(`[LifecycleManager] Clustering complete: ${clusterResult.clusters.size} memories clustered into ${this.kMeansClusterer.getK()} groups, converged: ${clusterResult.converged}`);

    // Step 3: Start periodic sweeps
    this.maintenanceSweep.startPeriodicSweeps();

    this.lastSweepTime = Date.now();
    this.isInitialized = true;

    console.log('[LifecycleManager] Initialization complete');
  }

  // Record memory access for reinforcement
  async recordAccess(memory: MemoryInternal): Promise<void> {
    if (!this.isInitialized) {
      console.warn('[LifecycleManager] Not initialized, skipping reinforcement');
      return;
    }

    await this.reinforcementTracker.recordAccess(memory);
  }

  // Get lifecycle statistics
  async getStats(): Promise<LifecycleStats> {
    const [total, active, faded] = await Promise.all([
      this.repository.count(),
      this.repository.countByStatus('active'),
      this.repository.countByStatus('faded'),
    ]);

    return {
      totalMemories: total,
      activeMemories: active,
      fadedMemories: faded,
      lastSweepTime: this.lastSweepTime,
      nextSweepTime: null, // TODO: Calculate from interval
      pendingReinforcements: this.reinforcementTracker.getPendingCount(),
    };
  }

  // Register event handlers
  onMemoryFaded(handler: (memory: MemoryDTO) => void): () => void {
    return this.eventEmitter.onMemoryFaded(handler);
  }

  onMemoryDeleted(handler: (memoryId: string) => void): () => void {
    return this.eventEmitter.onMemoryDeleted(handler);
  }

  // Shutdown: cleanup resources
  async shutdown(): Promise<void> {
    console.log('[LifecycleManager] Shutting down...');

    this.maintenanceSweep.stopPeriodicSweeps();
    await this.maintenanceSweep.shutdown();

    this.isInitialized = false;

    console.log('[LifecycleManager] Shutdown complete');
  }

  // Calculate optimal K for K-means (sqrt(N/2) heuristic)
  private async calculateOptimalK(): Promise<number> {
    const count = await this.repository.count();
    return Math.max(2, Math.floor(Math.sqrt(count / 2)));
  }
}
```

### Worker Integration for Lifecycle
```typescript
// Source: Phase 2 worker structure + Phase 6 lifecycle handlers
import { LifecycleManager, type LifecycleConfig } from '../lifecycle/LifecycleManager.js';

let lifecycleManager: LifecycleManager | null = null;

async function initializeLifecycle(config: LifecycleConfig): Promise<void> {
  if (!embeddingEngine || !repository || !vectorSearch) {
    throw new Error('Embedding engine, repository, and vector search must be initialized first');
  }

  lifecycleManager = new LifecycleManager(
    repository,
    vectorSearch,
    config
  );

  await lifecycleManager.initialize();

  reportProgress(port, 'maintenance', 100);
}

async function handleGet(request: RequestMessage): Promise<void> {
  if (!repository) {
    throw new Error('Repository not initialized');
  }

  const { id } = request.payload as { id: string };
  const memory = await repository.getById(id);

  if (memory && lifecycleManager) {
    // Record access for reinforcement
    await lifecycleManager.recordAccess(memory);
  }

  // Return memory DTO
  const dto = memory ? memoryToDTO(memory) : null;

  const response: ResponseMessage = {
    id: request.id,
    type: MessageTypeConst.GET,
    payload: dto,
  };

  port.postMessage(response);
}

async function handleSemanticSearch(request: RequestMessage): Promise<void> {
  if (!vectorSearch || !repository || !lifecycleManager) {
    throw new Error('Search not initialized');
  }

  const { query, options } = request.payload as {
    query: string;
    options?: SearchOptions;
  };

  const results = await vectorSearch.search(query, options);

  // Record reinforcement for high-relevance results
  if (options?.useCompositeScoring !== false) {
    for (const result of results) {
      if (result.score > 0.7) { // High relevance threshold
        const memory = await repository.getById(result.memoryId);
        if (memory) {
          await lifecycleManager.recordAccess(memory);
        }
      }
    }
  }

  // Fetch full memory details and return as DTOs
  // ... (existing semantic search logic)
}

async function handleShutdown(): Promise<void> {
  if (lifecycleManager) {
    await lifecycleManager.shutdown();
  }
  // ... (other cleanup)
}

// Add message handlers to worker switch
switch (request.type) {
  case MessageType.INIT:
    await handleInit(request);
    // Lifecycle initializes after search is ready
    if (request.payload.lifecycleConfig) {
      await initializeLifecycle(request.payload.lifecycleConfig);
    }
    break;
  case MessageType.GET:
    await handleGet(request);
    break;
  case MessageType.SEMANTIC_SEARCH:
    await handleSemanticSearch(request);
    break;
  case MessageType.SHUTDOWN:
    await handleShutdown();
    break;
  // ... other handlers
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No memory decay | Ebbinghaus exponential decay | 2020+ | Memories fade naturally over time |
| Fixed decay rate | Per-category lambda values | 2021+ | Category-appropriate retention |
| No reinforcement | Reinforcement on access | 2020+ | Important memories persist |
| Manual cleanup | Automated maintenance sweeps | 2019+ | Consistent memory hygiene |
| No organization | K-means clustering | 2022+ | Related memories grouped |
| Immediate deletion | 30-day fade buffer | 2021+ | User can review before loss |

**Current best practices (2024-2025):**
- Exponential decay for memory modeling (Ebbinghaus)
- Per-category decay rates for nuanced retention
- Reinforcement learning from user behavior (access patterns)
- Automated maintenance with scheduled sweeps
- Soft delete with recovery window (fade before delete)
- Event-driven architecture for lifecycle notifications
- Debounced writes for performance optimization

**Deprecated/outdated:**
- Linear decay models (don't match human memory)
- Global decay rates (too coarse-grained)
- Immediate deletion (no recovery, poor UX)
- Manual memory cleanup (error-prone, inconsistent)

---

## Open Questions

1. **Optimal K for K-means**
   - What we know: K should scale with memory count
   - What's unclear: Best heuristic for auto-calculating K
   - Recommendation: Start with `sqrt(N/2)`, adjust based on cluster quality metrics

2. **Reinforcement Amount Calibration**
   - What we know: Category-based amounts, capped at 3.0
   - What's unclear: Optimal reinforcement values for each category
   - Recommendation: Start with requirements (+0.3 default), tune based on user feedback

3. **Maintenance Sweep Interval**
   - What we know: Session start + periodic sweeps needed
   - What's unclear: Optimal periodic interval (1 hour default)
   - Recommendation: Start with 1 hour, make configurable, monitor performance

4. **Debounce Window for Reinforcement**
   - What we know: Need debounced writes to avoid DB overhead
   - What's unclear: Optimal debounce window (5 seconds default)
   - Recommendation: Start with 5 seconds, adjust based on write frequency

5. **Fade Threshold Sensitivity**
   - What we know: Default threshold 0.1, configurable
   - What's unclear: Whether different thresholds needed for different use cases
   - Recommendation: Keep default 0.1, expose in config for tuning

---

## Sources

### Primary (HIGH confidence)
- /Users/poak/Documents/personal-project/lokul-mind/.planning/phases/06-lifecycle-decay/06-CONTEXT.md - User decisions and implementation constraints
- /Users/poak/Documents/personal-project/lokul-mind/.planning/REQUIREMENTS.md - DECAY-01..09 requirements
- /Users/poak/Documents/personal-project/lokul-mind/src/storage/Database.ts - Schema with strength fields, fadedAt timestamp
- /Users/poak/Documents/personal-project/lokul-mind/src/types/memory.ts - MemoryDTO and MemoryInternal types with lifecycle fields

### Secondary (MEDIUM confidence)
- /Users/poak/Documents/personal-project/lokul-mind/.planning/phases/05-memory-store-retrieval/05-RESEARCH.md - Vector search patterns for clustering
- /Users/poak/Documents/personal-project/lokul-mind/.planning/phases/03-storage-layer/03-RESEARCH.md - Dexie.js batch operations for bulk updates

### Tertiary (LOW confidence)
- Standard Ebbinghaus forgetting curve formula (well-documented in cognitive science literature)
- K-means clustering algorithm (Lloyd's algorithm, standard machine learning textbook knowledge)
- Debounced write pattern (common frontend performance pattern, well-documented)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All custom implementations, no external dependencies needed
- Architecture: HIGH - Patterns from Phase 2/3/4/5 extended for lifecycle management
- Ebbinghaus decay: HIGH - Standard exponential decay formula, verified with requirements
- Reinforcement tracking: HIGH - Standard debounced write pattern, common performance optimization
- K-means clustering: MEDIUM - Simple algorithm but requires real-world testing for quality
- Performance: MEDIUM - Batch operations assumed efficient, requires profiling in Phase 6
- Pitfalls: HIGH - Based on common lifecycle management issues and memory leak patterns

**Research date:** 2026-02-24
**Valid until:** 2026-05-24 (lifecycle patterns are stable, 90-day validity appropriate)
