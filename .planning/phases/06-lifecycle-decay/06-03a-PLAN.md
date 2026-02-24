---
phase: 06-lifecycle-decay
plan: 03a
type: execute
wave: 2
depends_on:
  - 06-01
  - 06-02
files_modified:
  - src/lifecycle/KMeansClusterer.ts
  - src/lifecycle/LifecycleManager.ts
  - src/lifecycle/types.ts
autonomous: true
requirements:
  - DECAY-07

must_haves:
  truths:
    - "K-means clustering runs synchronously during initialization (separate step after sweep)"
    - "K-means uses Lloyd's algorithm with k-means++ initialization"
    - "K-means parameters: k (auto or fixed), maxIterations (default 100), convergenceThreshold (default 0.001)"
    - "K-means clusters active memories (status='active') only"
    - "Cluster ID stored in memory.clusterId field via bulk update"
    - "LifecycleManager integrates K-means in initialize() after sweep"
  artifacts:
    - path: "src/lifecycle/KMeansClusterer.ts"
      provides: "K-means clustering engine for memory organization"
      exports: ["KMeansClusterer", "KMeansConfig", "ClusterResult"]
    - path: "src/lifecycle/LifecycleManager.ts"
      provides: "Extended orchestrator with K-means integration"
      exports: ["LifecycleManager", "runClustering", "getClusterStats"]
    - path: "src/lifecycle/types.ts"
      provides: "K-means configuration types"
      contains: ["KMeansConfig", "ClusterResult"]
  key_links:
    - from: "KMeansClusterer"
      to: "VectorSearch"
      via: "Gets embeddings from in-memory cache"
      pattern: "vectorSearch\.get\(memoryId\)"
    - from: "KMeansClusterer"
      to: "MemoryRepository"
      via: "Fetches active memories, bulk updates clusterIds"
      pattern: "repository\.findByStatus|repository\.bulkUpdateClusterIds"
    - from: "LifecycleManager"
      to: "KMeansClusterer"
      via: "Calls cluster() during initialization"
      pattern: "kMeansClusterer\.cluster\(\)"
---

<objective>
Implement K-means clustering and integrate with LifecycleManager.

Purpose: Organize memories into semantic clusters using K-means algorithm for improved memory organization and potential future retrieval optimization.
Output: KMeansClusterer class, updated LifecycleManager with clustering integration.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/06-lifecycle-decay/06-CONTEXT.md
@.planning/phases/06-lifecycle-decay/06-RESEARCH.md
@src/lifecycle/LifecycleManager.ts
@src/search/VectorSearch.ts
@src/storage/MemoryRepository.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add K-means types to lifecycle/types.ts</name>
  <files>src/lifecycle/types.ts</files>
  <action>
    Extend src/lifecycle/types.ts with K-means interfaces:

    1. KMeansConfig interface:
       ```typescript
       export interface KMeansConfig {
         k?: number; // Auto-calculate if not specified
         maxIterations: number; // Default 100
         convergenceThreshold: number; // Default 0.001
       }
       ```

    2. ClusterResult interface:
       ```typescript
       export interface ClusterResult {
         clusters: Map<string, string>; // memoryId -> clusterId
         centroids: Map<string, Float32Array>; // clusterId -> centroid
         iterations: number;
         converged: boolean;
       }
       ```

    3. Extend LifecycleConfig to include K-means config:
       ```typescript
       export interface LifecycleConfig {
         // Existing fields...
         lambdaByCategory: Partial<Record<MemoryType, number>>;
         pinnedLambda: number;
         fadedThreshold: number;
         reinforcementByCategory: Partial<Record<MemoryType, number>>;
         maxBaseStrength: number;
         reinforcementDebounceMs: number;
         maintenanceIntervalMs: number;
         onProgress?: (stage: string, progress: number) => void;

         // K-means configuration
         kMeansK?: number;
         kMeansMaxIterations: number;
         kMeansConvergenceThreshold: number;
       }
       ```

    Import Float32Array is built-in, no import needed
  </action>
  <verification>
    KMeansConfig interface added to types.ts
    ClusterResult interface added with Map types
    LifecycleConfig extended with K-means fields
    k parameter optional (auto-calculate if not specified)
  </verification>
  <done>
    KMeansConfig defines k, maxIterations, convergenceThreshold
    ClusterResult provides clusters Map and centroids Map
    LifecycleConfig includes kMeansK, kMeansMaxIterations, kMeansConvergenceThreshold
    All K-means configuration available through LifecycleConfig
  </done>
</task>

<task type="auto">
  <name>Task 2: Implement KMeansClusterer</name>
  <files>src/lifecycle/KMeansClusterer.ts</files>
  <action>
    Create src/lifecycle/KMeansClusterer.ts with KMeansClusterer class:

    1. Class properties:
       - Private config: KMeansConfig
       - Private repository: MemoryRepository
       - Private vectorSearch: VectorSearch

    2. Constructor: Accept all dependencies

    3. async cluster(): Promise<ClusterResult>
       - Get active memories: repository.findByStatus('active')
       - Return empty result if memories.length < config.k
       - Extract embeddings: iterate memories, get embedding via vectorSearch.get(memory.id)
       - Skip memories without embeddings
       - Build memoryIds and embeddings arrays
       - Initialize centroids: initializeCentroids(embeddings)
       - Lloyd's algorithm loop:
         - converged = false, iteration = 0
         - While !converged && iteration < maxIterations:
           - newClusters = assignToClusters(memoryIds, embeddings, centroids)
           - newCentroids = updateCentroids(memoryIds, embeddings, newClusters, centroids)
           - converged = checkConvergence(centroids, newCentroids)
           - clusters = newClusters, iteration++
       - Update DB: await updateMemoryClusters(clusters)
       - Return { clusters, centroids: centroidsToMap(centroids), iterations: iteration, converged }

    4. Private initializeCentroids(embeddings: Float32Array[]): Float32Array[]
       - Use k-means++ algorithm:
         - First centroid: random choice from embeddings
         - Remaining centroids: choose with probability proportional to squared distance
       - Return array of k centroids

    5. Private assignToClusters(memoryIds, embeddings, centroids): Map<string, string>
       - For each embedding:
         - Find nearest centroid (min euclidean distance)
         - Map memoryId -> clusterId (e.g., 'cluster-0', 'cluster-1')
       - Return clusters Map

    6. Private updateCentroids(memoryIds, embeddings, clusters, oldCentroids): Float32Array[]
       - For each cluster:
         - Find all memories in this cluster
         - Calculate mean centroid: sum all embeddings, divide by count
         - Handle empty clusters (centroid = zero vector)
       - Return array of new centroids

    7. Private checkConvergence(oldCentroids, newCentroids): boolean
       - For each centroid pair:
         - Calculate euclidean distance
         - Return false if any shift > convergenceThreshold
       - Return true

    8. Private euclideanDistance(a: Float32Array, b: Float32Array): number
       - Sum squared differences
       - Return sqrt(sum)

    9. Private async updateMemoryClusters(clusters: Map<string, string>): Promise<void>
       - Build updates array: [{ id, clusterId }]
       - Call repository.bulkUpdateClusterIds(updates)
       - Log count updated

    10. Private centroidsToMap(centroids: Float32Array[]): Map<string, Float32Array>
        - Map centroid index to clusterId (e.g., 'cluster-0')
        - Return Map

    11. getK(): number
        - Return config.k

    Import types from './types.js' and dependencies
  </action>
  <verification>
    KMeansClusterer class exists with all methods
    cluster() implements Lloyd's algorithm with k-means++ initialization
    assignToClusters uses euclidean distance for nearest centroid
    updateCentroids calculates mean of assigned embeddings
    checkConvergence compares centroid shifts
    updateMemoryClusters uses bulk update
    Empty clusters handled (zero vector centroid)
  </verification>
  <done>
    K-means++ initialization improves convergence
    Lloyd's algorithm iterates until convergence or max iterations
    Euclidean distance used for nearest centroid assignment
    Centroids updated as mean of assigned embeddings
    Cluster IDs bulk-updated in database
    Empty clusters handled with zero vector centroid
    Convergence threshold stops iteration when centroids stabilize
  </done>
</task>

<task type="auto">
  <name>Task 3: Integrate K-means into LifecycleManager</name>
  <files>src/lifecycle/LifecycleManager.ts</files>
  <action>
    Update src/lifecycle/LifecycleManager.ts:

    1. Add property:
       - Private kMeansClusterer: KMeansClusterer | null = null
       - Private lastClusterTime: number = 0

    2. Update constructor:
       - Initialize KMeansClusterer with k-means config subset
       - Assign to kMeansClusterer property
       - Pass repository, vectorSearch, and config

    3. Update initialize() method:
       - After maintenance sweep completes:
         - Log "Running K-means clustering..."
         - const clusterResult = await kMeansClusterer.cluster()
         - Set lastClusterTime = Date.now()
         - Log "Clustering complete: X memories into Y groups, converged: Z"
       - Keep periodic sweeps start after clustering

    4. Add method:
       - async runClustering(): Promise<ClusterResult | null>
         - Return null if kMeansClusterer is null
         - Set lastClusterTime = Date.now()
         - Return await kMeansClusterer.cluster()

    5. Add method:
       - getClusterStats(): { k: number | null; lastClusterTime: number | null }
         - Return k from kMeansClusterer or null
         - Return lastClusterTime

    Import KMeansClusterer and ClusterResult
  </action>
  <verification>
    KMeansClusterer initialized in constructor
    initialize() calls cluster() after sweep
    runClustering() method exists
    getClusterStats() method exists
    Clustering runs synchronously during init
    lastClusterTime tracked and returned
  </verification>
  <done>
    KMeansClusterer initialized in constructor with config
    Clustering runs after maintenance sweep in initialize()
    runClustering() allows manual re-clustering
    getClusterStats() provides cluster information
    lastClusterTime tracked for statistics
  </done>
</task>

</tasks>

<verification_criteria>
1. K-means clustering works correctly:
   - Organizes active memories into k clusters
   - Uses k-means++ initialization for better convergence
   - Updates clusterId in database via bulk operation
   - Runs synchronously during init phase
   - Handles edge cases (empty clusters, insufficient memories)

2. LifecycleManager integration:
   - KMeansClusterer initialized in constructor
   - Clustering runs after maintenance sweep in initialize()
   - runClustering() method available for manual re-clustering
   - getClusterStats() provides cluster information
</verification_criteria>

<success_metrics>
- K-means converges in <50 iterations for 3000 memories
- Clustering completes in <2 seconds for 3000 memories
- All memories assigned to valid cluster IDs
- No race conditions between sweep and clustering
