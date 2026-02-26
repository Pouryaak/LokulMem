import type { Entity, MemoryType } from '../types/memory.js';
import {
  classifyMemoryTypes,
  extractDates,
  extractEmails,
  extractHabits,
  extractNamedEntities,
  extractNegations,
  extractNumbers,
  extractPossessions,
  extractTemporalChanges,
} from './specificity/basicExtractors.js';
import { isCommonWord, isTemporalToken } from './specificity/commonTokens.js';
import {
  type EducationSignal,
  extractEducationSignals,
} from './specificity/educationExtractor.js';
import {
  type IdentitySignal,
  extractIdentitySignals,
} from './specificity/identityExtractor.js';
import { extractPlaces } from './specificity/locationExtractor.js';
import {
  extractNames,
  isLikelyNameCandidate,
} from './specificity/nameExtractor.js';
import {
  type PreferenceSignal,
  extractPreferenceSignals,
} from './specificity/preferenceExtractor.js';
import {
  extractJobs,
  isProfessionPhrase,
} from './specificity/professionExtractor.js';
import {
  type RelationalSignal,
  extractRelationalSignals,
} from './specificity/relationalExtractor.js';

export interface SpecificityResult {
  score: number;
  entities: Entity[];
  memoryTypes: MemoryType[];
}

const WEIGHTS = {
  names: 0.3,
  places: 0.25,
  jobs: 0.3,
  numbers: 0.2,
  preferences: 0.25,
  preferenceComparisons: 0.2,
  preferenceSignals: 0.12,
  dates: 0.2,
  habits: 0.2,
  negations: 0.2,
  temporalChanges: 0.25,
  emails: 0.4,
  namedEntities: 0.25,
  possessions: 0.1,
  educationSignals: 0.24,
  identitySignals: 0.2,
  relationalSignals: 0.22,
} as const;

export class SpecificityNER {
  analyze(content: string): SpecificityResult {
    const entities: Entity[] = [];
    const memoryTypes: MemoryType[] = [];

    const names = extractNames(content, isCommonWord);
    entities.push(...names);
    if (names.length > 0) memoryTypes.push('identity');

    const identitySignals = extractIdentitySignals(content);
    this.applyIdentitySignals(identitySignals, memoryTypes);

    const educationExtraction = extractEducationSignals(content);
    entities.push(...educationExtraction.entities);
    if (educationExtraction.signals.length > 0) memoryTypes.push('identity');

    const relationalExtraction = extractRelationalSignals(
      content,
      isLikelyNameCandidate,
    );
    entities.push(...relationalExtraction.entities);
    if (relationalExtraction.signals.length > 0) memoryTypes.push('relational');

    const places = extractPlaces(content, isCommonWord, isTemporalToken);
    entities.push(...places);
    if (places.length > 0) memoryTypes.push('location');

    const jobs = extractJobs(content);
    entities.push(...jobs);
    if (jobs.length > 0) memoryTypes.push('profession');

    const numbers = extractNumbers(content);
    entities.push(...numbers);

    const preferenceExtraction = extractPreferenceSignals(content);
    entities.push(...preferenceExtraction.preferenceEntities);
    entities.push(...preferenceExtraction.comparisonEntities);
    if (
      preferenceExtraction.preferenceEntities.length > 0 ||
      preferenceExtraction.comparisonEntities.length > 0
    ) {
      memoryTypes.push('preference');
    }

    const dates = extractDates(content);
    entities.push(...dates);
    if (dates.length > 0) memoryTypes.push('temporal');

    const habits = extractHabits(content);
    entities.push(...habits);
    if (habits.length > 0) memoryTypes.push('preference');

    const negations = extractNegations(content);
    entities.push(...negations);

    const temporalChanges = extractTemporalChanges(content);
    entities.push(...temporalChanges);
    if (temporalChanges.length > 0) memoryTypes.push('temporal');

    const emails = extractEmails(content);
    entities.push(...emails);
    if (emails.length > 0) memoryTypes.push('identity');

    const namedEntities = extractNamedEntities(content);
    entities.push(...namedEntities);
    if (namedEntities.length > 0) memoryTypes.push('relational');

    const possessions = extractPossessions(content);
    if (possessions.length > 0) memoryTypes.push('identity');

    classifyMemoryTypes(content, memoryTypes, isProfessionPhrase);

    return {
      score: this.computeScore({
        names,
        places,
        jobs,
        numbers,
        preferences: preferenceExtraction.preferenceEntities,
        preferenceComparisons: preferenceExtraction.comparisonEntities,
        preferenceSignals: preferenceExtraction.signals,
        dates,
        habits,
        negations,
        temporalChanges,
        emails,
        namedEntities,
        possessions,
        educationSignals: educationExtraction.signals,
        identitySignals,
        relationalSignals: relationalExtraction.signals,
      }),
      entities,
      memoryTypes: memoryTypes.length ? [...new Set(memoryTypes)] : [],
    };
  }

  private applyIdentitySignals(
    signals: IdentitySignal[],
    memoryTypes: MemoryType[],
  ): void {
    if (signals.length > 0 && !memoryTypes.includes('identity')) {
      memoryTypes.push('identity');
    }

    if (
      signals.some((signal) =>
        ['relationshipStatus', 'childrenCount', 'parentalStatus'].includes(
          signal.kind,
        ),
      )
    ) {
      memoryTypes.push('relational');
    }
  }

  private computeScore(input: {
    names: Entity[];
    places: Entity[];
    jobs: Entity[];
    numbers: Entity[];
    preferences: Entity[];
    preferenceComparisons: Entity[];
    preferenceSignals: PreferenceSignal[];
    dates: Entity[];
    habits: Entity[];
    negations: Entity[];
    temporalChanges: Entity[];
    emails: Entity[];
    namedEntities: Entity[];
    possessions: Entity[];
    educationSignals: EducationSignal[];
    identitySignals: IdentitySignal[];
    relationalSignals: RelationalSignal[];
  }): number {
    const rawScore =
      (input.names.length > 0 ? WEIGHTS.names : 0) +
      (input.places.length > 0 ? WEIGHTS.places : 0) +
      (input.jobs.length > 0 ? WEIGHTS.jobs : 0) +
      (input.numbers.length > 0 ? WEIGHTS.numbers : 0) +
      (input.preferences.length > 0 ? WEIGHTS.preferences : 0) +
      (input.preferenceComparisons.length > 0
        ? WEIGHTS.preferenceComparisons
        : 0) +
      (input.preferenceSignals.length > 0 ? WEIGHTS.preferenceSignals : 0) +
      (input.dates.length > 0 ? WEIGHTS.dates : 0) +
      (input.habits.length > 0 ? WEIGHTS.habits : 0) +
      (input.negations.length > 0 ? WEIGHTS.negations : 0) +
      (input.temporalChanges.length > 0 ? WEIGHTS.temporalChanges : 0) +
      (input.emails.length > 0 ? WEIGHTS.emails : 0) +
      (input.namedEntities.length > 0 ? WEIGHTS.namedEntities : 0) +
      (input.possessions.length > 0 ? WEIGHTS.possessions : 0) +
      (input.educationSignals.length > 0 ? WEIGHTS.educationSignals : 0) +
      (input.identitySignals.length > 0 ? WEIGHTS.identitySignals : 0) +
      (input.relationalSignals.length > 0 ? WEIGHTS.relationalSignals : 0);

    return Math.min(1.0, rawScore);
  }
}
