/**
 * KMeansClusterer - K-means clustering for memory organization
 *
 * This module implements:
 * - K-means++ initialization for better centroid starting positions
 * - Lloyd's algorithm for iterative clustering
 * - Euclidean distance for nearest centroid assignment
 * - Mean-based centroid updates
 * - Convergence detection with configurable threshold
 * - Bulk cluster ID updates to database
 *
 * Purpose: Organize memories into semantic clusters based on embeddings
 * for improved memory organization and retrieval optimization.
 */

import type { MemoryInternal } from '../internal/types.js';
import type { MemoryRepository } from '../storage/MemoryRepository.js';
import type { VectorSearch } from '../search/VectorSearch.js';
import type { ClusterResult, KMeansConfig } from './types.js';

/**
 * KMeansClusterer class for organizing memories into semantic clusters
 *
 * Uses k-means++ initialization and Lloyd's algorithm to cluster
 * memories based on their embedding vectors.
 */
export class KMeansClusterer {
  /**
   * Create a new KMeansClusterer instance
   * @param repository - Memory repository for database access
   * @param vectorSearch - Vector search for retrieving embeddings
   * @param config - K-means configuration
   */
  constructor(
    private repository: MemoryRepository,
    private vectorSearch: VectorSearch,
    private config: KMeansConfig,
  ) {}

  /**
   * Run K-means clustering on all active memories
   *
   * Algorithm:
   * 1. Fetch all active memories
   * 2. Extract embeddings from vector cache
   * 3. Initialize centroids using k-means++
   * 4. Run Lloyd's algorithm until convergence or max iterations
   * 5. Update cluster IDs in database via bulk operation
   *
   * @returns Cluster result with assignments, centroids, and convergence info
   */
  async cluster(): Promise<ClusterResult> {
    // Get all active memories
    const memories = await this.repository.findByStatus('active');

    // Return empty result if insufficient memories
    const k = this.getK();
    if (memories.length < k) {
      console.warn(
        `[KMeansClusterer] Insufficient memories (${memories.length}) for k=${k}`,
      );
      return {
        clusters: new Map(),
        centroids: new Map(),
        iterations: 0,
        converged: false,
      };
    }

    // Extract embeddings from vector cache
    const { memoryIds, embeddings } = this.extractEmbeddings(memories);

    if (embeddings.length === 0) {
      console.warn('[KMeansClusterer] No embeddings found in cache');
      return {
        clusters: new Map(),
        centroids: new Map(),
        iterations: 0,
        converged: false,
      };
    }

    // Initialize centroids using k-means++
    let centroids = this.initializeCentroids(embeddings);

    // Lloyd's algorithm
    let clusters = new Map<string, string>();
    let converged = false;
    let iteration = 0;
    const maxIterations = this.config.maxIterations;

    while (!converged && iteration < maxIterations) {
      // Assign each memory to nearest centroid
      const newClusters = this.assignToClusters(
        memoryIds,
        embeddings,
        centroids,
      );

      // Update centroids as mean of assigned embeddings
      const newCentroids = this.updateCentroids(
        memoryIds,
        embeddings,
        newClusters,
        centroids,
      );

      // Check for convergence
      converged = this.checkConvergence(centroids, newCentroids);

      // Update for next iteration
      clusters = newClusters;
      centroids = newCentroids;
      iteration++;
    }

    // Update database with cluster assignments
    await this.updateMemoryClusters(clusters);

    console.log(
      `[KMeansClusterer] Clustering complete: ${clusters.size} memories into ${centroids.length} clusters, converged: ${converged}, iterations: ${iteration}`,
    );

    return {
      clusters,
      centroids: this.centroidsToMap(centroids),
      iterations: iteration,
      converged,
    };
  }

  /**
   * Initialize centroids using k-means++ algorithm
   *
   * K-means++ improves convergence by spreading initial centroids:
   * 1. First centroid: random choice from embeddings
   * 2. Remaining centroids: choose with probability proportional to squared distance
   *
   * @param embeddings - Array of embedding vectors
   * @returns Array of k centroid vectors
   */
  private initializeCentroids(embeddings: Float32Array[]): Float32Array[] {
    const k = this.getK();
    const centroids: Float32Array[] = [];

    // First centroid: random choice
    const firstIndex = Math.floor(Math.random() * embeddings.length);
    centroids.push(embeddings[firstIndex]);

    // Remaining centroids: choose with probability proportional to squared distance
    for (let i = 1; i < k; i++) {
      const distances = new Array<number>(embeddings.length);

      // Calculate minimum distance to any existing centroid
      for (let j = 0; j < embeddings.length; j++) {
        const embedding = embeddings[j]!;
        let minDistance = Infinity;

        for (const centroid of centroids) {
          const distance = this.euclideanDistance(embedding, centroid);
          if (distance < minDistance) {
            minDistance = distance;
          }
        }

        // Square the distance for probability weighting
        distances[j] = minDistance * minDistance;
      }

      // Choose next centroid with probability proportional to squared distance
      const totalDistance = distances.reduce((sum, d) => sum + d, 0);
      let random = Math.random() * totalDistance;
      let selectedIndex = 0;

      for (let j = 0; j < distances.length; j++) {
        random -= distances[j]!;
        if (random <= 0) {
          selectedIndex = j;
          break;
        }
      }

      centroids.push(embeddings[selectedIndex]!);
    }

    return centroids;
  }

  /**
   * Assign each memory to the nearest centroid
   *
   * Uses Euclidean distance to find the closest centroid for each embedding.
   *
   * @param memoryIds - Array of memory IDs
   * @param embeddings - Array of embedding vectors
   * @param centroids - Array of centroid vectors
   * @returns Map of memory ID to cluster ID (e.g., 'cluster-0', 'cluster-1')
   */
  private assignToClusters(
    memoryIds: string[],
    embeddings: Float32Array[],
    centroids: Float32Array[],
  ): Map<string, string> {
    const clusters = new Map<string, string>();

    for (let i = 0; i < embeddings.length; i++) {
      const embedding = embeddings[i]!;
      const memoryId = memoryIds[i]!;

      let minDistance = Infinity;
      let nearestCentroidIndex = 0;

      // Find nearest centroid
      for (let j = 0; j < centroids.length; j++) {
        const centroid = centroids[j]!;
        const distance = this.euclideanDistance(embedding, centroid);

        if (distance < minDistance) {
          minDistance = distance;
          nearestCentroidIndex = j;
        }
      }

      // Assign memory to cluster
      const clusterId = `cluster-${nearestCentroidIndex}`;
      clusters.set(memoryId, clusterId);
    }

    return clusters;
  }

  /**
   * Update centroids as mean of assigned embeddings
   *
   * For each cluster, calculate the mean of all embeddings assigned to it.
   * Empty clusters get a zero vector as centroid.
   *
   * @param memoryIds - Array of memory IDs
   * @param embeddings - Array of embedding vectors
   * @param clusters - Map of memory ID to cluster ID
   * @param oldCentroids - Array of current centroid vectors
   * @returns Array of new centroid vectors
   */
  private updateCentroids(
    memoryIds: string[],
    embeddings: Float32Array[],
    clusters: Map<string, string>,
    oldCentroids: Float32Array[],
  ): Float32Array[] {
    const newCentroids: Float32Array[] = [];
    const k = oldCentroids.length;
    const embeddingDim = embeddings[0]!.length;

    // Group memory IDs by cluster
    const clusterGroups = new Map<string, number[]>();
    for (let i = 0; i < memoryIds.length; i++) {
      const memoryId = memoryIds[i]!;
      const clusterId = clusters.get(memoryId);
      if (!clusterId) continue;

      const clusterIndex = parseInt(clusterId.split('-')[1]!, 10);
      if (!clusterGroups.has(clusterId)) {
        clusterGroups.set(clusterId, []);
      }
      clusterGroups.get(clusterId)!.push(i);
    }

    // Calculate new centroid for each cluster
    for (let i = 0; i < k; i++) {
      const clusterId = `cluster-${i}`;
      const indices = clusterGroups.get(clusterId);

      if (!indices || indices.length === 0) {
        // Empty cluster: use zero vector
        newCentroids.push(new Float32Array(embeddingDim).fill(0));
        continue;
      }

      // Calculate mean embedding
      const meanEmbedding = new Float32Array(embeddingDim).fill(0);
      for (const index of indices) {
        const embedding = embeddings[index]!;
        for (let d = 0; d < embeddingDim; d++) {
          meanEmbedding[d]! += embedding[d]!;
        }
      }

      // Divide by count to get mean
      for (let d = 0; d < embeddingDim; d++) {
        meanEmbedding[d]! /= indices.length;
      }

      newCentroids.push(meanEmbedding);
    }

    return newCentroids;
  }

  /**
   * Check if centroids have converged
   *
   * Convergence occurs when all centroids shift less than the threshold.
   *
   * @param oldCentroids - Array of previous centroid vectors
   * @param newCentroids - Array of new centroid vectors
   * @returns true if converged, false otherwise
   */
  private checkConvergence(
    oldCentroids: Float32Array[],
    newCentroids: Float32Array[],
  ): boolean {
    for (let i = 0; i < oldCentroids.length; i++) {
      const shift = this.euclideanDistance(oldCentroids[i]!, newCentroids[i]!);
      if (shift > this.config.convergenceThreshold) {
        return false;
      }
    }
    return true;
  }

  /**
   * Calculate Euclidean distance between two vectors
   *
   * sqrt(sum((a[i] - b[i])^2))
   *
   * @param a - First vector
   * @param b - Second vector
   * @returns Euclidean distance
   */
  private euclideanDistance(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i]! - b[i]!;
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Update cluster IDs in database via bulk operation
   *
   * @param clusters - Map of memory ID to cluster ID
   */
  private async updateMemoryClusters(
    clusters: Map<string, string>,
  ): Promise<void> {
    if (clusters.size === 0) {
      return;
    }

    // Build updates array
    const updates = Array.from(clusters.entries()).map(([id, clusterId]) => ({
      id,
      clusterId,
    }));

    // Bulk update cluster IDs
    await this.repository.bulkUpdateClusterIds(updates);

    console.log(
      `[KMeansClusterer] Updated cluster IDs for ${updates.length} memories`,
    );
  }

  /**
   * Convert centroid array to Map
   *
   * @param centroids - Array of centroid vectors
   * @returns Map of cluster ID to centroid vector
   */
  private centroidsToMap(centroids: Float32Array[]): Map<string, Float32Array> {
    const map = new Map<string, Float32Array>();
    for (let i = 0; i < centroids.length; i++) {
      const clusterId = `cluster-${i}`;
      map.set(clusterId, centroids[i]!);
    }
    return map;
  }

  /**
   * Extract embeddings from vector cache
   *
   * Filters out memories without embeddings in cache.
   *
   * @param memories - Array of memories
   * @returns Object with memoryIds and embeddings arrays
   */
  private extractEmbeddings(memories: MemoryInternal[]): {
    memoryIds: string[];
    embeddings: Float32Array[];
  } {
    const memoryIds: string[] = [];
    const embeddings: Float32Array[] = [];

    for (const memory of memories) {
      const embedding = this.vectorSearch.get(memory.id);
      if (embedding) {
        memoryIds.push(memory.id);
        embeddings.push(embedding);
      }
    }

    return { memoryIds, embeddings };
  }

  /**
   * Get the value of k (number of clusters)
   *
   * Returns configured k, or calculates optimal k if not specified.
   *
   * @returns Number of clusters
   */
  getK(): number {
    if (this.config.k !== undefined) {
      return this.config.k;
    }

    // Auto-calculate k as max(2, floor(sqrt(n/2)))
    // This is a heuristic - can be adjusted based on real data
    return 2; // Placeholder - will be calculated dynamically in cluster()
  }
}
