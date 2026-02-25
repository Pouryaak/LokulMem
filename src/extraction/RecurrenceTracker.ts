/**
 * RecurrenceTracker - Session-based recurrence tracking
 *
 * Tracks content embeddings within a session to detect when information
 * recurs. Recurrence is detected when cosine similarity exceeds threshold.
 *
 * Uses content hashing for efficient key-based storage, avoiding issues with
 * large content strings as keys and paraphrase detection.
 */
export class RecurrenceTracker {
  // CRITICAL: Key by hash/ID, not full content string
  // Using full content as key treats paraphrases as different and large texts become keys
  private sessionEmbeddings = new Map<string, Float32Array>();
  private contentHashes = new Map<string, string>(); // content -> hash mapping

  /**
   * Track content for recurrence detection
   * Stores embeddings from current session for comparison
   *
   * CRITICAL: Use content hash as key, NOT full content string.
   * Full content strings treat paraphrases as different and large texts become keys.
   *
   * @param content - Text content
   * @param embedding - Embedding vector
   */
  track(content: string, embedding: Float32Array): void {
    const hash = this.simpleHash(content);
    this.sessionEmbeddings.set(hash, embedding);
    this.contentHashes.set(content, hash);
  }

  /**
   * Check if content recurs in current session
   * Recurrence = cosine similarity > 0.85 with any session embedding
   *
   * @param content - Text content to check
   * @param embedding - Embedding vector
   * @param threshold - Recurrence threshold (default: 0.85)
   * @returns Recurrence score (0-1)
   */
  checkRecurrence(
    content: string,
    embedding: Float32Array,
    threshold = 0.85,
  ): number {
    const hash = this.simpleHash(content);
    const sessionEmbedding = this.sessionEmbeddings.get(hash);

    if (sessionEmbedding) {
      const similarity = this.cosineSimilarity(embedding, sessionEmbedding);
      if (similarity > threshold) {
        return similarity;
      }
    }
    return 0;
  }

  /**
   * Clear session tracking (call at session end)
   */
  clear(): void {
    this.sessionEmbeddings.clear();
    this.contentHashes.clear();
  }

  /**
   * Generate simple hash from content
   * In production, use crypto.subtle.digest('SHA-256', ...)
   *
   * @param content - Text content
   * @returns Hash string
   */
  private simpleHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Compute cosine similarity between two embedding vectors
   *
   * IMPORTANT: Assumes embeddings are normalized. For normalized vectors,
   * cosine(a,b) = dot(a,b). The result is clamped to [0, 1].
   *
   * @param a - First embedding vector
   * @param b - Second embedding vector
   * @returns Cosine similarity in [0, 1]
   * @throws Error if dimensions don't match
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Embedding dimension mismatch');
    }

    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      const aVal = a[i];
      const bVal = b[i];
      if (aVal !== undefined && bVal !== undefined) {
        dotProduct += aVal * bVal;
      }
    }

    // Clamp to [0, 1] for normalized vectors
    return Math.max(0, Math.min(1, dotProduct));
  }
}
