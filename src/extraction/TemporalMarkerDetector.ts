/**
 * TemporalMarkerDetector - Detect temporal markers indicating factual change
 *
 * Identifies phrases like "used to", "no longer", "previously" that indicate
 * facts have changed over time. Used for contradiction detection and temporal
 * supersession handling.
 */

import type { ConflictDomain } from '../internal/types.js';

/**
 * TemporalMarker - Detected temporal phrase with metadata
 *
 * NOTE: Position is NOT stored or persisted per Phase 7 decision "no positions".
 * Position tracking is debug-only and never saved to database.
 */
export interface TemporalMarker {
  /** The matched phrase */
  phrase: string;

  /** Type of temporal marker */
  type: 'past' | 'former' | 'change' | 'correction';

  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * TemporalUpdate - Parsed temporal update from content
 */
export interface TemporalUpdate {
  /** Whether temporal marker detected */
  hasMarker: boolean;

  /** Detected markers */
  markers: TemporalMarker[];

  /** Inferred change type (undefined when no markers detected) */
  changeType:
    | 'location'
    | 'profession'
    | 'preference'
    | 'identity'
    | 'general'
    | undefined;
}

export class TemporalMarkerDetector {
  // 16 temporal marker patterns from requirements
  private readonly patterns = [
    // Past tense indicators
    { pattern: /\bused to\b/gi, type: 'past' as const, confidence: 0.9 },
    { pattern: /\bpreviously\b/gi, type: 'past' as const, confidence: 0.85 },
    { pattern: /\bbefore\b/gi, type: 'past' as const, confidence: 0.7 },
    { pattern: /\bformerly\b/gi, type: 'past' as const, confidence: 0.85 },
    {
      pattern: /\blast (?:time|week|month|year|decade)\b/gi,
      type: 'past' as const,
      confidence: 0.75,
    },

    // Change indicators
    { pattern: /\bno longer\b/gi, type: 'change' as const, confidence: 0.9 },
    { pattern: /\bnot anymore\b/gi, type: 'change' as const, confidence: 0.85 },
    { pattern: /\bstopped\b/gi, type: 'change' as const, confidence: 0.8 },
    { pattern: /\bquit\b/gi, type: 'change' as const, confidence: 0.75 },
    { pattern: /\bleft\b/gi, type: 'change' as const, confidence: 0.7 },
    {
      pattern: /\bmoved (?:to|from)\b/gi,
      type: 'change' as const,
      confidence: 0.85,
    },

    // Correction indicators
    { pattern: /\bactually\b/gi, type: 'correction' as const, confidence: 0.6 },
    { pattern: /\bwait\b/gi, type: 'correction' as const, confidence: 0.65 },
    { pattern: /\bsorry\b/gi, type: 'correction' as const, confidence: 0.5 },
    {
      pattern: /\bcorrection\b/gi,
      type: 'correction' as const,
      confidence: 0.9,
    },

    // Former state
    {
      pattern: /\bmy (?:former|ex|late)\b/gi,
      type: 'former' as const,
      confidence: 0.85,
    },
    // FIX: Remove generic \bold\b pattern - it matches "old laptop", "old code" causing false positives
    // If needed, use specific pattern: /\bold (?:address|job|company|role|city|house|apartment)\b/gi
    // Per CONTEXT decision, temporal markers should be precise, not broad
  ];

  /**
   * Detect temporal markers in content
   * @param content - Text content to analyze
   * @returns Temporal update with detected markers
   */
  detect(content: string): TemporalUpdate {
    const markers: TemporalMarker[] = [];

    for (const { pattern, type, confidence } of this.patterns) {
      pattern.lastIndex = 0; // Reset regex state
      let match = pattern.exec(content);
      while (match !== null) {
        // CRITICAL: Do NOT store position - Phase 7 decision was "no positions"
        // Position is debug-only and never persisted
        markers.push({
          phrase: match[0] ?? '',
          type,
          confidence,
        });
        match = pattern.exec(content);
      }
    }

    const hasMarker = markers.length > 0;
    const changeType = hasMarker
      ? this.inferChangeType(content, markers)
      : undefined;

    return {
      hasMarker,
      markers,
      changeType,
    };
  }

  /**
   * Check if content implies temporal update for a specific type
   * @param content - Text content
   * @param memoryType - Memory type to check
   * @returns True if content suggests temporal update for this type
   */
  isTemporalUpdate(content: string, memoryType: string): boolean {
    const detection = this.detect(content);
    if (!detection.hasMarker) return false;

    // Map change types to memory types
    const typeMapping: Record<string, string[]> = {
      location: ['location'],
      profession: ['profession'],
      preference: ['preference'],
      identity: ['identity'],
      general: [
        'identity',
        'location',
        'profession',
        'preference',
        'project',
        'relational',
        'emotional',
      ],
    };

    const applicableTypes =
      typeMapping[detection.changeType ?? 'general'] ?? [];
    return applicableTypes.includes(memoryType);
  }

  /**
   * Infer change type from content and markers
   * @param content - Text content
   * @param _markers - Detected temporal markers (unused but kept for API consistency)
   * @returns Inferred change type
   */
  private inferChangeType(
    content: string,
    _markers: TemporalMarker[],
  ): 'location' | 'profession' | 'preference' | 'identity' | 'general' {
    const lowerContent = content.toLowerCase();

    // Location keywords
    if (/\b(live|living|address|city|country|home|move)/.test(lowerContent)) {
      return 'location';
    }

    // Profession keywords
    if (
      /\b(work|job|career|company|role|title|position|employ)/.test(
        lowerContent,
      )
    ) {
      return 'profession';
    }

    // Preference keywords
    if (/\b(like|love|hate|prefer|favorite|enjoy)/.test(lowerContent)) {
      return 'preference';
    }

    // Identity keywords
    if (/\b(name|age|gender|pronoun|married|single)/.test(lowerContent)) {
      return 'identity';
    }

    return 'general';
  }

  /**
   * Get timestamp range for temporal update
   * When temporal marker detected, existing memory gets validTo=now,
   * new memory gets validFrom=now
   *
   * @returns Object with validTo and validFrom timestamps
   */
  getTimestampRange(): { validTo: number; validFrom: number } {
    const now = Date.now();
    return {
      validTo: now,
      validFrom: now,
    };
  }

  /**
   * Map memory type to conflict domain
   * Memories conflict within the same domain, not exact type
   *
   * @param memoryType - Memory type to map
   * @returns Conflict domain
   */
  static mapToConflictDomain(memoryType: string): ConflictDomain {
    const mapping: Record<string, ConflictDomain> = {
      identity: 'identity',
      location: 'location',
      profession: 'profession',
      preference: 'preference',
      temporal: 'temporal',
      relational: 'relational',
      emotional: 'emotional',
      project: 'project',
    };

    return mapping[memoryType] ?? 'preference';
  }
}
