import type { Entity } from '../../types/memory.js';
import {
  ROUTINE_FREQUENCY_SCORE,
  ROUTINE_INVALID_ACTIVITIES,
  ROUTINE_PATTERNS,
  ROUTINE_VALID_ACTIVITIES,
  type RoutineFrequencyType,
  type RoutinePatternKind,
} from '../patterns/routinePatterns.js';

export interface RoutineSignal {
  kind: RoutinePatternKind;
  frequencyType: RoutineFrequencyType;
  confidence: number;
  activity?: string;
  frequency?: string;
  frequencyScore?: number;
  time?: string;
  anchor?: string;
  day?: string;
  count?: number;
  period?: string;
}

export function extractRoutineSignals(content: string): {
  signals: RoutineSignal[];
  habitEntities: Entity[];
  temporalEntities: Entity[];
} {
  const signals: RoutineSignal[] = [];
  const habitEntities: Entity[] = [];
  const temporalEntities: Entity[] = [];
  const seenSignals = new Set<string>();
  const seenHabits = new Set<string>();
  const seenTemporal = new Set<string>();

  for (const routinePattern of ROUTINE_PATTERNS) {
    for (const match of content.matchAll(routinePattern.pattern)) {
      const fullMatch = (match[0] ?? '').trim();
      if (!fullMatch) continue;

      const activityRaw =
        routinePattern.activityGroup !== undefined
          ? (match[routinePattern.activityGroup] ?? '').trim()
          : '';
      const frequencyRaw =
        routinePattern.frequencyGroup !== undefined
          ? (match[routinePattern.frequencyGroup] ?? '').trim()
          : '';
      const timeRaw =
        routinePattern.timeGroup !== undefined
          ? (match[routinePattern.timeGroup] ?? '').trim()
          : '';
      const anchorRaw =
        routinePattern.anchorGroup !== undefined
          ? (match[routinePattern.anchorGroup] ?? '').trim()
          : '';
      const dayRaw =
        routinePattern.dayGroup !== undefined
          ? (match[routinePattern.dayGroup] ?? '').trim()
          : '';
      const countRaw =
        routinePattern.countGroup !== undefined
          ? (match[routinePattern.countGroup] ?? '').trim()
          : '';
      const periodRaw =
        routinePattern.periodGroup !== undefined
          ? (match[routinePattern.periodGroup] ?? '').trim()
          : '';

      const activity = normalizeActivity(activityRaw);
      const frequency = normalizeToken(frequencyRaw);
      const time = normalizeTime(timeRaw);
      const anchor = normalizeToken(anchorRaw);
      const day = normalizeToken(dayRaw);
      const period = normalizeToken(periodRaw);
      const count = /^\d{1,2}$/.test(countRaw) ? Number(countRaw) : undefined;

      if (
        routinePattern.kind !== 'temporalChange' &&
        activity !== undefined &&
        !isValidActivity(activity)
      ) {
        continue;
      }

      if (time !== undefined && !isValidTime(time)) {
        continue;
      }

      if (count !== undefined && (count < 1 || count > 20)) {
        continue;
      }

      const frequencyScore =
        frequency !== undefined ? getFrequencyScore(frequency) : undefined;
      const confidence = adjustConfidence(routinePattern.confidence, {
        activity,
        frequency,
        time,
      });

      const key = `${routinePattern.kind}:${activity ?? ''}:${frequency ?? ''}:${time ?? ''}:${anchor ?? ''}:${day ?? ''}:${count ?? ''}:${period ?? ''}`;
      if (seenSignals.has(key)) continue;
      seenSignals.add(key);

      signals.push({
        kind: routinePattern.kind,
        frequencyType: routinePattern.frequencyType,
        confidence,
        ...(activity !== undefined && { activity }),
        ...(frequency !== undefined && { frequency }),
        ...(frequencyScore !== undefined && { frequencyScore }),
        ...(time !== undefined && { time }),
        ...(anchor !== undefined && { anchor }),
        ...(day !== undefined && { day }),
        ...(count !== undefined && { count }),
        ...(period !== undefined && { period }),
      });

      if (routinePattern.kind === 'temporalChange') {
        const temporalToken = normalizeToken(fullMatch);
        if (temporalToken !== undefined && !seenTemporal.has(temporalToken)) {
          seenTemporal.add(temporalToken);
          temporalEntities.push({
            type: 'date',
            value: temporalToken,
            raw: fullMatch,
            count: 1,
            confidence,
          });
        }
        continue;
      }

      if (activity !== undefined && !seenHabits.has(activity)) {
        seenHabits.add(activity);
        habitEntities.push({
          type: 'preference',
          value: activity,
          raw: activityRaw || fullMatch,
          count: 1,
          confidence,
        });
      }
    }
  }

  return { signals, habitEntities, temporalEntities };
}

function normalizeActivity(value: string): string | undefined {
  const normalized = value
    .toLowerCase()
    .replace(/^to\s+/, '')
    .replace(/[,.!?]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeToken(value: string): string | undefined {
  const normalized = value.toLowerCase().replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeTime(value: string): string | undefined {
  const normalized = value.toLowerCase().replace(/\s+/g, '').trim();
  return normalized.length > 0 ? normalized : undefined;
}

function isValidActivity(activity: string): boolean {
  if (ROUTINE_INVALID_ACTIVITIES.has(activity)) {
    return false;
  }

  if (ROUTINE_VALID_ACTIVITIES.has(activity)) {
    return true;
  }

  const verbs = [
    'go ',
    'do ',
    'make ',
    'take ',
    'have ',
    'get ',
    'play ',
    'watch ',
    'listen ',
    'read ',
    'write ',
    'cook ',
    'eat ',
    'drink ',
    'exercise ',
    'work ',
    'study ',
    'practice ',
    'meditate ',
    'run ',
    'walk ',
    'swim ',
  ];
  if (verbs.some((verb) => activity.startsWith(verb))) {
    return true;
  }

  return activity.endsWith('ing') && activity.length > 5;
}

function isValidTime(time: string): boolean {
  const match = time.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/i);
  if (!match) return false;

  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const hasPeriod = match[3] !== undefined;

  if (hasPeriod) {
    if (hour < 1 || hour > 12) return false;
  } else if (hour < 0 || hour > 23) {
    return false;
  }

  return minute >= 0 && minute <= 59;
}

function getFrequencyScore(frequency: string): number {
  return ROUTINE_FREQUENCY_SCORE[frequency] ?? 0.5;
}

function adjustConfidence(
  baseConfidence: number,
  input: {
    activity?: string | undefined;
    frequency?: string | undefined;
    time?: string | undefined;
  },
): number {
  let confidence = baseConfidence;

  if (input.activity !== undefined && !isValidActivity(input.activity)) {
    confidence -= 0.2;
  }

  if (
    input.activity !== undefined &&
    ROUTINE_VALID_ACTIVITIES.has(input.activity)
  ) {
    confidence += 0.05;
  }

  if (input.time !== undefined && isValidTime(input.time)) {
    confidence += 0.05;
  }

  if (
    input.frequency !== undefined &&
    getFrequencyScore(input.frequency) >= 0.7
  ) {
    confidence += 0.03;
  }

  return Math.max(0.5, Math.min(0.98, confidence));
}
