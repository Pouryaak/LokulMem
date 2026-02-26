import type { Entity, MemoryType } from '../types/memory.js';
import {
  IDENTITY_PATTERNS,
  type IdentityPatternKind,
  LANGUAGE_ALLOWLIST,
} from './patterns/identityPatterns.js';
import {
  PROFESSION_KEYWORDS,
  PROFESSION_PATTERNS,
  type ProfessionPatternKind,
} from './patterns/professionPatterns.js';

export interface SpecificityResult {
  /** Specificity score (0-1) */
  score: number;

  /** Extracted entities */
  entities: Entity[];

  /** Detected memory types */
  memoryTypes: MemoryType[];
}

interface IdentitySignal {
  kind: IdentityPatternKind;
  value: string;
  confidence: number;
}

/**
 * SpecificityNER - Regex-based Named Entity Recognition with weighted specificity scoring
 *
 * Extracts entities and computes specificity score based on weighted entity type detection:
 * - Names: 0.3
 * - Places: 0.25
 * - Numbers: 0.2
 * - Preferences: 0.25
 * - Dates: 0.2
 * - Negations: 0.2
 * - First-person possession: 0.10
 *
 * Sum is clamped to 1.0 maximum.
 */
export class SpecificityNER {
  /**
   * Compute specificity score and extract entities
   * @param content - Text content to analyze
   * @returns Specificity result with score, entities, and types
   */
  analyze(content: string): SpecificityResult {
    const entities: Entity[] = [];
    const memoryTypes: MemoryType[] = [];

    // Name patterns (weight: 0.3)
    const names = this.extractNames(content);
    entities.push(...names);
    if (names.length > 0) memoryTypes.push('identity');

    // Identity marker patterns (weight: 0.2)
    const identitySignals = this.extractIdentitySignals(content);
    if (identitySignals.length > 0 && !memoryTypes.includes('identity')) {
      memoryTypes.push('identity');
    }
    if (
      identitySignals.some((signal) =>
        ['relationshipStatus', 'childrenCount', 'parentalStatus'].includes(
          signal.kind,
        ),
      )
    ) {
      memoryTypes.push('relational');
    }

    // Place patterns (weight: 0.25)
    const places = this.extractPlaces(content);
    entities.push(...places);
    if (places.length > 0) memoryTypes.push('location');

    // Job/Company patterns (weight: 0.3) - profession info is highly specific
    const jobs = this.extractJobs(content);
    entities.push(...jobs);
    if (jobs.length > 0) memoryTypes.push('profession');

    // Number patterns (weight: 0.2)
    const numbers = this.extractNumbers(content);
    entities.push(...numbers);

    // Preference patterns (weight: 0.25)
    const preferences = this.extractPreferences(content);
    entities.push(...preferences);
    if (preferences.length > 0) memoryTypes.push('preference');

    // Comparative preference patterns (weight: 0.2)
    const preferenceComparisons = this.extractPreferenceComparisons(content);
    entities.push(...preferenceComparisons);
    if (preferenceComparisons.length > 0) memoryTypes.push('preference');

    // Date patterns (weight: 0.2)
    const dates = this.extractDates(content);
    entities.push(...dates);
    if (dates.length > 0) memoryTypes.push('temporal');

    // Habit/routine patterns (weight: 0.2)
    const habits = this.extractHabits(content);
    entities.push(...habits);
    if (habits.length > 0) memoryTypes.push('preference');

    // Negation patterns (weight: 0.2)
    const negations = this.extractNegations(content);
    entities.push(...negations);

    // Temporal-change markers (weight: 0.25)
    const temporalChanges = this.extractTemporalChanges(content);
    entities.push(...temporalChanges);
    if (temporalChanges.length > 0) memoryTypes.push('temporal');

    // Email patterns (weight: 0.25) - contact information
    const emails = this.extractEmails(content);
    entities.push(...emails);
    if (emails.length > 0) memoryTypes.push('identity');

    // "Named X" patterns (weight: 0.25) - pet names, proper nouns after "named"
    const namedEntities = this.extractNamedEntities(content);
    entities.push(...namedEntities);
    if (namedEntities.length > 0) memoryTypes.push('relational');

    // First-person possession (weight: 0.10) - tracked via entity extraction only
    // Possessions do NOT create a 'possession' entity type - they're extracted
    // as entities but kept separate from memory types to avoid type pollution
    const possessions = this.extractPossessions(content);
    // Store possession count as metadata, not as entities with type='possession'
    if (possessions.length > 0) {
      // Store as flag on memory, not as entity array
      memoryTypes.push('identity');
    }

    // Classify memory types based on patterns
    this.classifyMemoryTypes(content, memoryTypes);

    // Compute weighted specificity (clamp to 1.0)
    const weights = {
      names: 0.3,
      places: 0.25,
      jobs: 0.3,
      numbers: 0.2,
      preferences: 0.25,
      preferenceComparisons: 0.2,
      dates: 0.2,
      habits: 0.2,
      negations: 0.2,
      temporalChanges: 0.25,
      emails: 0.4,
      namedEntities: 0.25,
      possessions: 0.1,
      identitySignals: 0.2,
    };

    const rawScore =
      (names.length > 0 ? weights.names : 0) +
      (places.length > 0 ? weights.places : 0) +
      (jobs.length > 0 ? weights.jobs : 0) +
      (numbers.length > 0 ? weights.numbers : 0) +
      (preferences.length > 0 ? weights.preferences : 0) +
      (preferenceComparisons.length > 0 ? weights.preferenceComparisons : 0) +
      (dates.length > 0 ? weights.dates : 0) +
      (habits.length > 0 ? weights.habits : 0) +
      (negations.length > 0 ? weights.negations : 0) +
      (temporalChanges.length > 0 ? weights.temporalChanges : 0) +
      (emails.length > 0 ? weights.emails : 0) +
      (namedEntities.length > 0 ? weights.namedEntities : 0) +
      (possessions.length > 0 ? weights.possessions : 0) +
      (identitySignals.length > 0 ? weights.identitySignals : 0);

    return {
      score: Math.min(1.0, rawScore),
      entities,
      // CRITICAL: Return empty array when no types detected, NOT ['preference']
      // Let QualityScorer use base threshold as fallback. Defaulting to 'preference'
      // poisons contradiction domains and thresholds.
      memoryTypes: memoryTypes.length ? [...new Set(memoryTypes)] : [],
    };
  }

  /**
   * Extract names using regex patterns
   * Matches: "I'm [Name]", "My name is [Name]", "I am [Name]", capitalized words at sentence start
   */
  private extractNames(content: string): Entity[] {
    const entities: Entity[] = [];
    const nameToken = `[A-Za-z][A-Za-z'’-]{1,30}`;
    const nameSequence = `(${nameToken}(?:\\s+${nameToken}){0,2})`;

    const nameIntroPatterns: Array<{ pattern: RegExp; confidence: number }> = [
      {
        pattern: new RegExp(
          `(?:my\\s+name\\s+is|my\\s+name['’]?s|my\\s+full\\s+name\\s+is)\\s+${nameSequence}`,
          'gi',
        ),
        confidence: 0.95,
      },
      {
        pattern: new RegExp(
          `(?:^|\\s)(?:i['’]?m|im|i\\s+am)\\s+${nameSequence}(?=$|[,.!?])`,
          'gi',
        ),
        confidence: 0.9,
      },
      {
        pattern: new RegExp(
          `(?:call\\s+me|you\\s+can\\s+call\\s+me|just\\s+call\\s+me|i\\s+go\\s+by|i\\s+am\\s+called|i\\s+am\\s+known\\s+as)\\s+${nameSequence}`,
          'gi',
        ),
        confidence: 0.88,
      },
      {
        pattern: new RegExp(
          `(?:my\\s+nickname\\s+is|aka|a\\.k\\.a\\.)\\s+${nameSequence}`,
          'gi',
        ),
        confidence: 0.82,
      },
    ];

    const seen = new Set<string>();
    for (const { pattern, confidence } of nameIntroPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const candidate = match[1]
          ?.replace(/\s+(?:and|or|but)\b.*$/i, '')
          .trim();
        if (!candidate || !this.isLikelyNameCandidate(candidate)) {
          continue;
        }

        const key = candidate.toLowerCase();
        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        entities.push({
          type: 'person',
          value: key,
          raw: candidate,
          count: 1,
          confidence,
        });
      }
    }

    // Pattern: Capitalized words that look like names (2+ consecutive capitalized words)
    // This is a heuristic and may have false positives
    const capitalizedPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
    const capitalizedMatches = content.matchAll(capitalizedPattern);
    for (const match of capitalizedMatches) {
      if (match[1] && !this.isCommonWord(match[1])) {
        entities.push({
          type: 'person',
          value: match[1].toLowerCase(),
          raw: match[1],
          count: 1,
          confidence: 0.6,
        });
      }
    }

    return entities;
  }

  /**
   * Extract places using regex patterns
   * Matches: "in [City]", "at [Place]", "from [Country]", common location indicators
   */
  private extractPlaces(content: string): Entity[] {
    const entities: Entity[] = [];

    // Pattern: "in [City/Country]" / "at [Place]" / "from [Country]"
    const locationPatterns = [
      /(?:in|at|from|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
    ];

    for (const pattern of locationPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (
          match[1] &&
          !this.isCommonWord(match[1]) &&
          !this.isTemporalToken(match[1])
        ) {
          entities.push({
            type: 'place',
            value: match[1].toLowerCase(),
            raw: match[1],
            count: 1,
            confidence: 0.7,
          });
        }
      }
    }

    return entities;
  }

  /**
   * Extract job/company using regex patterns
   * Matches: "I work at [Company]", "I am a [Role]", job titles, company names
   */
  private extractJobs(content: string): Entity[] {
    const entities: Entity[] = [];

    const seen = new Set<string>();
    for (const { pattern, group, kind, confidence } of PROFESSION_PATTERNS) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const captured = (match[group] ?? '').trim();
        if (!captured) {
          continue;
        }

        const normalized = captured
          .replace(/\s+/g, ' ')
          .replace(/^(?:a|an|the)\s+/i, '')
          .trim()
          .toLowerCase();

        if (!this.isLikelyWorkValue(normalized, kind)) {
          continue;
        }

        if (seen.has(normalized)) {
          continue;
        }

        seen.add(normalized);
        entities.push({
          type: 'organization',
          value: normalized,
          raw: captured,
          count: 1,
          confidence,
        });
      }
    }

    return entities;
  }

  /**
   * Extract numbers using regex patterns
   * Matches: integers, decimals, currency amounts, percentages
   */
  private extractNumbers(content: string): Entity[] {
    const entities: Entity[] = [];

    // Pattern: Currency amounts ($10, 50 euros, etc.)
    const currencyPattern =
      /\$\s*(\d+(?:\.\d{2})?)|(\d+(?:\.\d{2})?)\s*(?:dollars?|euros?|cents?)/gi;
    const currencyMatches = content.matchAll(currencyPattern);
    for (const match of currencyMatches) {
      const value = match[1] || match[2];
      if (value) {
        entities.push({
          type: 'number',
          value,
          raw: match[0],
          count: 1,
          confidence: 0.95,
        });
      }
    }

    // Pattern: Percentages (50%, 25 percent)
    const percentPattern = /(\d+(?:\.\d+)?)\s*%/gi;
    const percentMatches = content.matchAll(percentPattern);
    for (const match of percentMatches) {
      if (match[1]) {
        entities.push({
          type: 'number',
          value: match[1],
          raw: match[0],
          count: 1,
          confidence: 0.95,
        });
      }
    }

    // Pattern: Standalone integers
    const intPattern = /\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\b/g;
    const intMatches = content.matchAll(intPattern);
    for (const match of intMatches) {
      if (match[1]) {
        entities.push({
          type: 'number',
          value: match[1].replace(/,/g, ''),
          raw: match[1],
          count: 1,
          confidence: 0.5,
        });
      }
    }

    return entities;
  }

  /**
   * Extract preferences using regex patterns
   * Matches: "I like/love/hate [X]", "I prefer [X]", "[X] is my favorite", polarity parsing
   */
  private extractPreferences(content: string): Entity[] {
    const entities: Entity[] = [];

    // Pattern: "I like/love/hate/enjoy [X]"
    const preferPatterns = [
      /i\s+(?:really\s+)?(?:like|love|hate|enjoy|prefer|adore|can't stand)\s+([^.!?]+)/gi,
      /i\s+(?:usually\s+)?(?:drink|eat|use)\s+([^.!?]+)/gi,
    ];

    for (const pattern of preferPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          const value = match[1].trim();
          if (value.length > 0 && value.length < 100) {
            entities.push({
              type: 'preference',
              value: value.toLowerCase(),
              raw: value,
              count: 1,
              confidence: 0.85,
            });
          }
        }
      }
    }

    // Pattern: "[X] is my favorite"
    const favoritePattern = /([^.!?]+)\s+is\s+(?:my\s+)?favorite/gi;
    const favoriteMatches = content.matchAll(favoritePattern);
    for (const match of favoriteMatches) {
      if (match[1]) {
        const value = match[1].trim();
        if (value.length > 0 && value.length < 100) {
          entities.push({
            type: 'preference',
            value: value.toLowerCase(),
            raw: value,
            count: 1,
            confidence: 0.9,
          });
        }
      }
    }

    // Pattern: "My/Your favorite [X] is [Y]" (e.g., "My favorite color is blue")
    const myFavoritePattern = /(?:my|your)\s+favorite\s+\w+\s+is\s+([^.!?]+)/gi;
    const myFavoriteMatches = content.matchAll(myFavoritePattern);
    for (const match of myFavoriteMatches) {
      if (match[1]) {
        const value = match[1].trim();
        if (value.length > 0 && value.length < 100) {
          entities.push({
            type: 'preference',
            value: value.toLowerCase(),
            raw: value,
            count: 1,
            confidence: 0.9,
          });
        }
      }
    }

    // Pattern: "I prefer [X] over/to [Y]" (comparison preferences)
    const comparePattern = /i\s+prefer\s+(\w+)\s+(?:over|to)\s+(\w+)/gi;
    const compareMatches = content.matchAll(comparePattern);
    for (const match of compareMatches) {
      if (match[1] && match[2]) {
        entities.push({
          type: 'preference',
          value: `${match[1].toLowerCase()} over ${match[2].toLowerCase()}`,
          raw: match[0],
          count: 1,
          confidence: 0.9,
        });
      }
    }

    return entities;
  }

  /**
   * Extract dates using regex patterns
   * Matches: ISO dates, "tomorrow", "next week", "in 3 days", normalize to ISO format
   */
  private extractDates(content: string): Entity[] {
    const entities: Entity[] = [];

    // Pattern: ISO dates (2024-03-15, 2024/03/15)
    const isoPattern = /\b(\d{4}[-/]\d{2}[-/]\d{2})\b/g;
    const isoMatches = content.matchAll(isoPattern);
    for (const match of isoMatches) {
      if (match[1]) {
        entities.push({
          type: 'date',
          value: match[1].replace(/\//g, '-'),
          raw: match[1],
          count: 1,
          confidence: 0.95,
        });
      }
    }

    // Pattern: Month name dates ("March 15th", "January 1st", "December 25, 2023")
    const monthPattern =
      /\b((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)\b/gi;
    const monthMatches = content.matchAll(monthPattern);
    for (const match of monthMatches) {
      if (match[1]) {
        entities.push({
          type: 'date',
          value: match[1].toLowerCase(),
          raw: match[1],
          count: 1,
          confidence: 0.9,
        });
      }
    }

    // Pattern: Relative dates ("tomorrow", "next week", "in 3 days")
    const relativePatterns = [
      /\btomorrow\b/gi,
      /\byesterday\b/gi,
      /\bnext\s+week\b/gi,
      /\blast\s+week\b/gi,
      /\bin\s+(\d+)\s+days?\b/gi,
      /\b(\d+)\s+days?\s+ago\b/gi,
      /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/gi,
    ];

    for (const pattern of relativePatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        entities.push({
          type: 'date',
          value: match[0].toLowerCase(),
          raw: match[0],
          count: 1,
          confidence: 0.8,
        });
      }
    }

    return entities;
  }

  /**
   * Extract negations using regex patterns
   * Matches: "not", "never", "don't", "can't", "won't", "no longer", "stopped"
   */
  private extractNegations(content: string): Entity[] {
    const entities: Entity[] = [];

    // Pattern: Common negation words/phrases
    const negationPatterns = [
      /\bnot\b/gi,
      /\bnever\b/gi,
      /\bdon't\b/gi,
      /\bdon't\b/gi,
      /\bdoesn't\b/gi,
      /\bdidn't\b/gi,
      /\bcan't\b/gi,
      /\bcannot\b/gi,
      /\bwon't\b/gi,
      /\bno longer\b/gi,
      /\bstopped\b/gi,
      /\bquit\b/gi,
    ];

    for (const pattern of negationPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        entities.push({
          type: 'negation',
          value: match[0].toLowerCase(),
          raw: match[0],
          count: 1,
          confidence: 0.7,
        });
      }
    }

    return entities;
  }

  /**
   * Extract habit/routine markers
   * Matches: every morning, usually, often, on Fridays, each weekend
   */
  private extractHabits(content: string): Entity[] {
    const entities: Entity[] = [];
    const patterns = [
      /\b(?:every|each)\s+(?:morning|afternoon|evening|night|day|week|month|year|weekend)\b/gi,
      /\b(?:usually|often|regularly|typically)\b/gi,
      /\bon\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/gi,
    ];

    for (const pattern of patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        entities.push({
          type: 'preference',
          value: (match[0] ?? '').toLowerCase(),
          raw: match[0] ?? '',
          count: 1,
          confidence: 0.75,
        });
      }
    }

    return entities;
  }

  /**
   * Extract temporal change markers that imply updates/supersession.
   */
  private extractTemporalChanges(content: string): Entity[] {
    const entities: Entity[] = [];
    const patterns = [
      /\bused to\b/gi,
      /\bno longer\b/gi,
      /\bnot anymore\b/gi,
      /\bformerly\b/gi,
      /\bpreviously\b/gi,
      /\bbut now\b/gi,
      /\bnow\s+i\b/gi,
    ];

    for (const pattern of patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        entities.push({
          type: 'date',
          value: (match[0] ?? '').toLowerCase(),
          raw: match[0] ?? '',
          count: 1,
          confidence: 0.8,
        });
      }
    }

    return entities;
  }

  /**
   * Extract comparative preferences such as "I prefer X over Y".
   * We treat these as higher-signal preferences because they encode
   * both positive and negative preference direction.
   */
  private extractPreferenceComparisons(content: string): Entity[] {
    const entities: Entity[] = [];
    const comparePattern =
      /\bi\s+prefer\s+([a-zA-Z0-9+#.-]+(?:\s+[a-zA-Z0-9+#.-]+)?)\s+(?:over|to)\s+([a-zA-Z0-9+#.-]+(?:\s+[a-zA-Z0-9+#.-]+)?)\b/gi;

    const matches = content.matchAll(comparePattern);
    for (const match of matches) {
      if (match[1] && match[2]) {
        entities.push({
          type: 'preference',
          value: `${match[1].toLowerCase()} over ${match[2].toLowerCase()}`,
          raw: match[0] ?? '',
          count: 1,
          confidence: 0.9,
        });
      }
    }

    return entities;
  }

  /**
   * Extract email addresses
   * Matches: user@domain.com patterns
   */
  private extractEmails(content: string): Entity[] {
    const entities: Entity[] = [];

    const emailPattern =
      /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
    const matches = content.matchAll(emailPattern);
    for (const match of matches) {
      if (match[1]) {
        entities.push({
          type: 'person',
          value: match[1].toLowerCase(),
          raw: match[1],
          count: 1,
          confidence: 0.95,
        });
      }
    }

    return entities;
  }

  /**
   * Extract entities after "named" keyword
   * Matches: "named [Name]", "called [Name]" - for pets, people, things
   */
  private extractNamedEntities(content: string): Entity[] {
    const entities: Entity[] = [];

    // Pattern: "named [Name]" or "called [Name]"
    const namedPattern =
      /\b(?:named|called)\s+([A-Z][a-z]+(?:\s+(?:and\s+)?[A-Z][a-z]+)*)/g;
    const matches = content.matchAll(namedPattern);
    for (const match of matches) {
      if (match[1]) {
        entities.push({
          type: 'person',
          value: match[1].toLowerCase(),
          raw: match[1],
          count: 1,
          confidence: 0.85,
        });
      }
    }

    return entities;
  }

  /**
   * Extract first-person possessions using regex patterns
   * Matches: "my [X]", "I have [X]", "I own [X]", "our [X]"
   *
   * NOTE: These are tracked but NOT returned as entities with type='possession'
   * to avoid polluting the Entity.type union. Possessions are indicated via
   * memory metadata instead.
   */
  private extractPossessions(content: string): Entity[] {
    const entities: Entity[] = []; // Return empty to avoid type pollution

    // Pattern: "my [X]" / "our [X]"
    const possessionPatterns = [
      /\bmy\s+([a-z]+(?:\s+[a-z]+)?)\b/gi,
      /\bour\s+([a-z]+(?:\s+[a-z]+)?)\b/gi,
      /\bi\s+(?:have|own)\s+([^.!?]+)/gi,
    ];

    // We track these internally but return empty to avoid 'possession' entity type
    // The presence of possessions is tracked via memoryTypes.push('identity')
    for (const pattern of possessionPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        // Just count matches, don't return entities
        if (match[1]) {
          entities.push({
            type: 'person', // Use person type to avoid union violation
            value: match[1].toLowerCase(),
            raw: match[1],
            count: 1,
            confidence: 0.6,
          });
        }
      }
    }

    return entities;
  }

  /**
   * Classify memory types based on content patterns
   * Identity: name, age, personal details
   * Location: address, city, country
   * Profession: job title, company, role
   * Project: tasks, goals, plans
   * Relational: family, friends, relationships
   * Emotional: feelings, moods, reactions
   */
  private classifyMemoryTypes(content: string, types: MemoryType[]): void {
    const lower = content.toLowerCase();

    // Profession patterns
    const professionPatterns = [
      new RegExp(`\\b(${PROFESSION_KEYWORDS.join('|')})\\b`, 'gi'),
      /\b(?:i\s+work\s+as|i\s+work\s+at|i\s+am\s+a|i\s+am\s+an|i\s+am\s+the|i['’]?m\s+a|i['’]?m\s+an)\b/gi,
    ];
    for (const pattern of professionPatterns) {
      if (pattern.test(lower) && !types.includes('profession')) {
        types.push('profession');
        break;
      }
    }

    // Project patterns
    const projectPatterns = [
      /\b(plan|goal|task|project|deadline|reminder|todo|schedule)\b/gi,
      /\bi\s+need\s+to\b/gi,
      /\bi'm\s+going\s+to\b/gi,
    ];
    for (const pattern of projectPatterns) {
      if (pattern.test(lower) && !types.includes('project')) {
        types.push('project');
        break;
      }
    }

    // Relational patterns
    const relationalFamilyPattern =
      /\b(mother|father|sister|brother|parent|child|son|daughter|friend|wife|husband|partner|family)\b/gi;
    if (relationalFamilyPattern.test(lower) && !types.includes('relational')) {
      types.push('relational');
    }

    const relationalStatusPattern = /\b(married|engaged|divorced|single)\b/gi;
    const isRelationshipIdiom =
      /\bmarried\s+to\s+(?:my\s+)?work\b/.test(lower) ||
      /\bsingle[-\s]handedly\b/.test(lower);
    if (
      !isRelationshipIdiom &&
      relationalStatusPattern.test(lower) &&
      !types.includes('relational')
    ) {
      types.push('relational');
    }

    // Emotional patterns
    const emotionalPatterns = [
      /\b(feel|feeling|happy|sad|angry|excited|nervous|worried|proud|disappointed)\b/gi,
    ];
    for (const pattern of emotionalPatterns) {
      if (pattern.test(lower) && !types.includes('emotional')) {
        types.push('emotional');
        break;
      }
    }
  }

  /**
   * Check if a word is a common word that shouldn't be treated as an entity
   */
  private isCommonWord(word: string): boolean {
    const commonWords = new Set([
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'shall',
      'can',
      'need',
      'dare',
      'ought',
      'used',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'as',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'under',
      'again',
      'further',
      'then',
      'once',
      'and',
      'but',
      'or',
      'nor',
      'so',
      'yet',
      'both',
      'either',
      'neither',
      'not',
      'only',
      'own',
      'same',
      'than',
      'too',
      'very',
      'just',
      'also',
      'now',
      'here',
      'there',
      'when',
      'where',
      'why',
      'how',
      'all',
      'each',
      'few',
      'more',
      'most',
      'other',
      'some',
      'such',
      'no',
      'any',
      'only',
      'that',
      'this',
      'what',
      'which',
      'who',
      'whom',
      'these',
      'those',
      'about',
      'above',
      'across',
      'after',
      'against',
      'along',
      'among',
      'around',
      'before',
      'behind',
      'below',
      'beneath',
      'beside',
      'between',
      'beyond',
      'during',
      'except',
      'inside',
      'onto',
      'outside',
      'over',
      'past',
      'since',
      'through',
      'throughout',
      'till',
      'toward',
      'under',
      'until',
      'upon',
      'within',
      'without',
      'I',
      'you',
      'he',
      'she',
      'it',
      'we',
      'they',
      'me',
      'him',
      'her',
      'us',
      'them',
      'my',
      'your',
      'his',
      'its',
      'our',
      'their',
      'mine',
      'yours',
      'hers',
      'ours',
      'theirs',
      'this',
      'that',
      'these',
      'those',
      'am',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'having',
      'do',
      'does',
      'did',
      'having',
    ]);

    return commonWords.has(word.toLowerCase());
  }

  private isTemporalToken(word: string): boolean {
    const token = word.toLowerCase().replace(/s$/, '');
    return [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
      'today',
      'tomorrow',
      'yesterday',
      'morning',
      'afternoon',
      'evening',
      'night',
    ].includes(token);
  }

  private isProfessionPhrase(value: string): boolean {
    return new RegExp(`\\b(${PROFESSION_KEYWORDS.join('|')})\\b`).test(value);
  }

  private isLikelyWorkValue(
    value: string,
    kind: ProfessionPatternKind,
  ): boolean {
    if (value.length < 2 || value.length > 60) {
      return false;
    }

    if (this.looksLikePersonalIdentityPhrase(value)) {
      return false;
    }

    if (
      /\b(wife|husband|partner|mother|father|friend|family|pizza|steak|gym)\b/.test(
        value,
      )
    ) {
      return false;
    }

    if (kind === 'role') {
      return (
        this.isProfessionPhrase(value) ||
        /^(?:senior|junior|lead|principal|staff)\s+[a-z][a-z\s-]+$/.test(value)
      );
    }

    if (kind === 'industry') {
      return /[a-z]{3,}/.test(value);
    }

    if (kind === 'workMode') {
      return /\b(remote|remotely|home|office|anywhere)\b/.test(value);
    }

    if (kind === 'company' || kind === 'selfEmployment') {
      return !/^(?:my|our|the)\s+/.test(value);
    }

    return false;
  }

  private looksLikePersonalIdentityPhrase(value: string): boolean {
    return /^(?:married|single|engaged|divorced)$/.test(value.trim());
  }

  private isLikelyNameCandidate(value: string): boolean {
    const normalized = value.toLowerCase().trim();
    if (!normalized) {
      return false;
    }

    if (!/^[a-z][a-z'’-]*(?:\s+[a-z][a-z'’-]*){0,2}$/.test(normalized)) {
      return false;
    }

    const blockedPhrases = new Set([
      'married',
      'single',
      'engaged',
      'divorced',
      'happy',
      'sad',
      'tired',
      'hungry',
      'ready',
      'from denmark',
      'software engineer',
      'senior software engineer',
      'new job',
      'my wife',
      'my husband',
    ]);

    if (blockedPhrases.has(normalized)) {
      return false;
    }

    if (
      this.isProfessionPhrase(normalized) ||
      /\b(wife|husband|partner|friend|family|job|career|project|plan)\b/.test(
        normalized,
      )
    ) {
      return false;
    }

    if (
      /^(?:planning\s+to|going\s+to|gonna\s+|need\s+to|want\s+to|working\s+on|work\s+as|work\s+at)/.test(
        normalized,
      )
    ) {
      return false;
    }

    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (tokens.length < 1 || tokens.length > 3) {
      return false;
    }

    const blockedTokens = new Set([
      'and',
      'or',
      'but',
      'you',
      'your',
      'my',
      'the',
      'is',
      'am',
    ]);

    return tokens.every((token) => !blockedTokens.has(token));
  }

  private extractIdentitySignals(content: string): IdentitySignal[] {
    const signals: IdentitySignal[] = [];
    const seen = new Set<string>();

    for (const { pattern, group, kind, confidence } of IDENTITY_PATTERNS) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const captured = (match[group] ?? '').trim();
        if (!captured) {
          continue;
        }

        const normalized = captured.toLowerCase().replace(/\s+/g, ' ').trim();
        if (!this.isValidIdentitySignal(kind, normalized, match[0] ?? '')) {
          continue;
        }

        const key = `${kind}:${normalized}`;
        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        signals.push({
          kind,
          value: normalized,
          confidence,
        });
      }
    }

    return signals;
  }

  private isValidIdentitySignal(
    kind: IdentityPatternKind,
    value: string,
    fullMatch: string,
  ): boolean {
    if (!value) {
      return false;
    }

    if (kind === 'age') {
      const age = Number(value);
      return Number.isInteger(age) && age >= 5 && age <= 120;
    }

    if (kind === 'childrenCount') {
      const count = Number(value);
      return Number.isInteger(count) && count >= 0 && count <= 20;
    }

    if (kind === 'relationshipStatus') {
      if (/married\s+to\s+(?:my\s+)?work/.test(fullMatch.toLowerCase())) {
        return false;
      }
      return true;
    }

    if (kind === 'parentalStatus') {
      return !/\b(?:figure|hen)\b/.test(value);
    }

    if (kind === 'nativeLanguage') {
      return LANGUAGE_ALLOWLIST.has(value);
    }

    if (kind === 'pronouns' || kind === 'ageRange') {
      return true;
    }

    return false;
  }
}
