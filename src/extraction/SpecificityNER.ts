import type { Entity, MemoryType } from '../types/memory.js';
import {
  classifyMemoryTypes,
  extractEmails,
  extractNamedEntities,
  extractNegations,
  extractNumbers,
  extractPossessions,
} from './specificity/basicExtractors.js';
import { isCommonWord, isTemporalToken } from './specificity/commonTokens.js';
import {
  type ContactSignal,
  extractContactSignals,
} from './specificity/contactExtractor.js';
import {
  type EducationSignal,
  extractEducationSignals,
} from './specificity/educationExtractor.js';
import {
  type HealthSignal,
  extractHealthSignals,
} from './specificity/healthExtractor.js';
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
import {
  type RoutineSignal,
  extractRoutineSignals,
} from './specificity/routineExtractor.js';
import { extractTemporalSignals } from './specificity/temporalExtractor.js';

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
  routineSignals: 0.1,
  negations: 0.2,
  temporalChanges: 0.25,
  emails: 0.4,
  namedEntities: 0.25,
  possessions: 0.1,
  contactSignals: 0.26,
  healthSignals: 0.22,
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

    const contactExtraction = extractContactSignals(content);
    entities.push(...contactExtraction.entities);
    this.applyContactSignals(contactExtraction.signals, memoryTypes);

    const educationExtraction = extractEducationSignals(content);
    entities.push(...educationExtraction.entities);
    if (educationExtraction.signals.length > 0) memoryTypes.push('identity');

    const healthExtraction = extractHealthSignals(content);
    entities.push(...healthExtraction.entities);
    if (healthExtraction.signals.length > 0) memoryTypes.push('identity');
    if (
      healthExtraction.signals.some((signal) =>
        ['mentalHealthCondition', 'mentalHealthProvider', 'therapy'].includes(
          signal.kind,
        ),
      )
    ) {
      memoryTypes.push('emotional');
    }
    if (
      healthExtraction.signals.some((signal) => signal.kind === 'familyHistory')
    ) {
      memoryTypes.push('relational');
    }

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

    const temporalExtraction = extractTemporalSignals(content);
    entities.push(...temporalExtraction.dateEntities);
    if (temporalExtraction.dateEntities.length > 0)
      memoryTypes.push('temporal');

    const routineExtraction = extractRoutineSignals(content);
    entities.push(...routineExtraction.habitEntities);
    const temporalChanges = this.mergeUniqueEntities(
      routineExtraction.temporalEntities,
      temporalExtraction.changeEntities,
    );
    entities.push(...temporalChanges);
    if (routineExtraction.habitEntities.length > 0)
      memoryTypes.push('preference');
    if (temporalChanges.length > 0) memoryTypes.push('temporal');

    const negations = extractNegations(content);
    entities.push(...negations);

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
        dates: temporalExtraction.dateEntities,
        habits: routineExtraction.habitEntities,
        routineSignals: routineExtraction.signals,
        negations,
        temporalChanges,
        emails,
        namedEntities,
        possessions,
        contactSignals: contactExtraction.signals,
        healthSignals: healthExtraction.signals,
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

  private applyContactSignals(
    signals: ContactSignal[],
    memoryTypes: MemoryType[],
  ): void {
    if (signals.length > 0) {
      memoryTypes.push('identity');
    }

    if (
      signals.some((signal) =>
        [
          'streetAddress',
          'cityStateZip',
          'city',
          'state',
          'zipCode',
          'country',
        ].includes(signal.kind),
      )
    ) {
      memoryTypes.push('location');
    }

    if (
      signals.some((signal) =>
        ['relationship', 'contactName', 'contactBirthday'].includes(
          signal.kind,
        ),
      )
    ) {
      memoryTypes.push('relational');
    }

    if (
      signals.some((signal) =>
        ['employment', 'organization'].includes(signal.kind),
      )
    ) {
      memoryTypes.push('profession');
    }
  }

  private mergeUniqueEntities(...groups: Entity[][]): Entity[] {
    const merged: Entity[] = [];
    const seen = new Set<string>();

    for (const group of groups) {
      for (const entity of group) {
        const key = `${entity.type}:${entity.value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(entity);
      }
    }

    return merged;
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
    routineSignals: RoutineSignal[];
    negations: Entity[];
    temporalChanges: Entity[];
    emails: Entity[];
    namedEntities: Entity[];
    possessions: Entity[];
    contactSignals: ContactSignal[];
    healthSignals: HealthSignal[];
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
      (input.routineSignals.length > 0 ? WEIGHTS.routineSignals : 0) +
      (input.negations.length > 0 ? WEIGHTS.negations : 0) +
      (input.temporalChanges.length > 0 ? WEIGHTS.temporalChanges : 0) +
      (input.emails.length > 0 ? WEIGHTS.emails : 0) +
      (input.namedEntities.length > 0 ? WEIGHTS.namedEntities : 0) +
      (input.possessions.length > 0 ? WEIGHTS.possessions : 0) +
      (input.contactSignals.length > 0 ? WEIGHTS.contactSignals : 0) +
      (input.healthSignals.length > 0 ? WEIGHTS.healthSignals : 0) +
      (input.educationSignals.length > 0 ? WEIGHTS.educationSignals : 0) +
      (input.identitySignals.length > 0 ? WEIGHTS.identitySignals : 0) +
      (input.relationalSignals.length > 0 ? WEIGHTS.relationalSignals : 0);

    return Math.min(1.0, rawScore);
  }
}
