import type { VectorSearch } from '../search/VectorSearch.js';

/**
 * NoveltyCalculator - Compute novelty score using vector search
 *
 * Novelty is computed as: 1 - top1_similarity
 * Uses k=1 vector search to find the closest existing memory.
 *
 * This is O(N) via VectorSearch.search() with k=1, avoiding redundant loops.
 */
export class NoveltyCalculator {
  constructor(private vectorSearch: VectorSearch) {}

  /**
   * Compute novelty score for content
   * Novelty = 1 - top1_similarity (using k=1 search)
   *
   * CRITICAL: Must use vectorSearch.search(embed(s), k=1) from Phase 5
   * to avoid redundant O(N) loops over all memories.
   *
   * @param content - Text content to evaluate
   * @returns Novelty score (0-1), where 1 = completely novel
   */
  async compute(content: string): Promise<number> {
    // Use k=1 to get only the top match
    const results = await this.vectorSearch.search(content, { k: 1 });

    if (results.length === 0) {
      // No existing memories = completely novel
      return 1.0;
    }

    // Novelty = 1 - similarity to closest match
    const topSimilarity = results[0]?.similarity ?? 0;
    return Math.max(0, 1 - topSimilarity);
  }

  /**
   * Batch compute novelty for multiple contents
   * @param contents - Array of text contents
   * @returns Array of novelty scores (0-1)
   */
  async computeBatch(contents: string[]): Promise<number[]> {
    return Promise.all(contents.map((c) => this.compute(c)));
  }
}
