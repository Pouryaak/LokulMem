export type RoutinePatternKind =
  | 'morningRoutine'
  | 'eveningRoutine'
  | 'bedtimeRoutine'
  | 'frequentActivity'
  | 'occasionalActivity'
  | 'neverActivity'
  | 'dailyActivity'
  | 'countedFrequency'
  | 'scheduledActivity'
  | 'anchoredActivity'
  | 'weeklyActivity'
  | 'weeklyPattern'
  | 'workHours'
  | 'workSchedule'
  | 'commute'
  | 'exerciseFrequency'
  | 'mealRoutine'
  | 'sleepRoutine'
  | 'habitRestriction'
  | 'temporalChange';

export type RoutineFrequencyType =
  | 'daily'
  | 'regular'
  | 'weekly'
  | 'specific'
  | 'variable'
  | 'never'
  | 'change';

export interface RoutinePattern {
  pattern: RegExp;
  kind: RoutinePatternKind;
  confidence: number;
  frequencyType: RoutineFrequencyType;
  activityGroup?: number;
  frequencyGroup?: number;
  timeGroup?: number;
  anchorGroup?: number;
  dayGroup?: number;
  countGroup?: number;
  periodGroup?: number;
}

const ACTIVITY_TOKEN =
  "([a-z][a-z0-9&/+'-]*(?:\\s+[a-z0-9][a-z0-9&/+'-]*){0,7})";

export const ROUTINE_PATTERNS: RoutinePattern[] = [
  {
    pattern: new RegExp(
      `i\\s+(?:usually|always|typically|normally|generally)\\s+${ACTIVITY_TOKEN}\\s+(?:in\\s+the\\s+morning|every\\s+morning|each\\s+morning)(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'morningRoutine',
    confidence: 0.89,
    frequencyType: 'regular',
    activityGroup: 1,
  },
  {
    pattern: new RegExp(
      `(?:every|each)\\s+morning\\s+i\\s+${ACTIVITY_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'morningRoutine',
    confidence: 0.9,
    frequencyType: 'daily',
    activityGroup: 1,
  },
  {
    pattern: new RegExp(
      `i\\s+${ACTIVITY_TOKEN}\\s+(?:every|each)\\s+morning(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'morningRoutine',
    confidence: 0.89,
    frequencyType: 'daily',
    activityGroup: 1,
  },
  {
    pattern: new RegExp(
      `i\\s+(?:usually|always|typically)\\s+${ACTIVITY_TOKEN}\\s+(?:in\\s+the\\s+evening|every\\s+evening|at\\s+night)(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'eveningRoutine',
    confidence: 0.88,
    frequencyType: 'regular',
    activityGroup: 1,
  },
  {
    pattern: new RegExp(
      `(?:before\\s+bed|before\\s+sleeping|at\\s+bedtime)\\s+i\\s+(?:usually\\s+|always\\s+)?${ACTIVITY_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'bedtimeRoutine',
    confidence: 0.9,
    frequencyType: 'regular',
    activityGroup: 1,
  },
  {
    pattern: new RegExp(
      `i\\s+(always|usually|often|frequently|regularly|typically|generally)\\s+${ACTIVITY_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'frequentActivity',
    confidence: 0.85,
    frequencyType: 'variable',
    frequencyGroup: 1,
    activityGroup: 2,
  },
  {
    pattern: new RegExp(
      `i\\s+(sometimes|occasionally|rarely|seldom|never)\\s+${ACTIVITY_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'occasionalActivity',
    confidence: 0.83,
    frequencyType: 'variable',
    frequencyGroup: 1,
    activityGroup: 2,
  },
  {
    pattern: new RegExp(
      `i\\s+${ACTIVITY_TOKEN}\\s+(every\\s+day|daily|everyday)(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'dailyActivity',
    confidence: 0.88,
    frequencyType: 'daily',
    activityGroup: 1,
    frequencyGroup: 2,
  },
  {
    pattern: new RegExp(
      `i\\s+${ACTIVITY_TOKEN}\\s+(\\d{1,2})\\s+times?\\s+(?:a|per)\\s+(day|week|month|year)(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'countedFrequency',
    confidence: 0.91,
    frequencyType: 'specific',
    activityGroup: 1,
    countGroup: 2,
    periodGroup: 3,
  },
  {
    pattern: new RegExp(
      `i\\s+${ACTIVITY_TOKEN}\\s+(?:at|around)\\s+(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)\\b`,
      'gi',
    ),
    kind: 'scheduledActivity',
    confidence: 0.92,
    frequencyType: 'regular',
    activityGroup: 1,
    timeGroup: 2,
  },
  {
    pattern: new RegExp(
      `i\\s+${ACTIVITY_TOKEN}\\s+(?:after|before)\\s+(work|school|breakfast|lunch|dinner|bed)(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'anchoredActivity',
    confidence: 0.87,
    frequencyType: 'regular',
    activityGroup: 1,
    anchorGroup: 2,
  },
  {
    pattern: new RegExp(
      `(?:every|each)\\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\s+i\\s+${ACTIVITY_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'weeklyActivity',
    confidence: 0.9,
    frequencyType: 'weekly',
    dayGroup: 1,
    activityGroup: 2,
  },
  {
    pattern: new RegExp(
      `(?:on\\s+)?(?:the\\s+)?(weekends?|weekdays?)\\s+i\\s+(?:usually\\s+|often\\s+|always\\s+)?${ACTIVITY_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'weeklyPattern',
    confidence: 0.86,
    frequencyType: 'weekly',
    dayGroup: 1,
    activityGroup: 2,
  },
  {
    pattern:
      /i\s+work\s+(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+(?:to|until|-)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)(?=$|[,.!?])/gi,
    kind: 'workHours',
    confidence: 0.93,
    frequencyType: 'regular',
    timeGroup: 1,
    anchorGroup: 2,
  },
  {
    pattern:
      /i\s+(?:work\s+out|exercise|train|practice)\s+(\d{1,2})\s+times?\s+(?:a|per)\s+week(?=$|[,.!?])/gi,
    kind: 'exerciseFrequency',
    confidence: 0.92,
    frequencyType: 'specific',
    activityGroup: 0,
    countGroup: 1,
    periodGroup: 0,
  },
  {
    pattern:
      /i\s+(?:usually|always|typically)\s+(?:have|eat)\s+([a-z][a-z0-9&/+' -]{1,40})\s+for\s+(breakfast|lunch|dinner)(?=$|[,.!?])/gi,
    kind: 'mealRoutine',
    confidence: 0.88,
    frequencyType: 'regular',
    activityGroup: 1,
    anchorGroup: 2,
  },
  {
    pattern:
      /i\s+(?:usually|typically|normally)\s+(?:go\s+to\s+bed|sleep|wake\s+up)\s+(?:at|around)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)(?=$|[,.!?])/gi,
    kind: 'sleepRoutine',
    confidence: 0.92,
    frequencyType: 'regular',
    activityGroup: 0,
    timeGroup: 1,
  },
  {
    pattern:
      /i\s+(?:smoke|drink|vape)\s+(?:every\s+day|daily|regularly|often|rarely|occasionally)?(?=$|[,.!?])/gi,
    kind: 'habitRestriction',
    confidence: 0.86,
    frequencyType: 'regular',
    activityGroup: 0,
  },
  {
    pattern:
      /\b(?:used\s+to|no\s+longer|not\s+anymore|formerly|previously|but\s+now|now\s+i|started|stopped|quit)\b/gi,
    kind: 'temporalChange',
    confidence: 0.84,
    frequencyType: 'change',
    activityGroup: 0,
  },
];

export const ROUTINE_VALID_ACTIVITIES = new Set([
  'exercise',
  'work out',
  'run',
  'jog',
  'walk',
  'hike',
  'swim',
  'bike',
  'cycle',
  'lift weights',
  'yoga',
  'wake up',
  'shower',
  'brush teeth',
  'cook',
  'eat',
  'drink coffee',
  'have breakfast',
  'have lunch',
  'have dinner',
  'work',
  'study',
  'read',
  'write',
  'code',
  'commute',
  'meditate',
  'journal',
  'sleep',
  'go to bed',
  'play guitar',
  'draw',
  'paint',
]);

export const ROUTINE_INVALID_ACTIVITIES = new Set([
  'think',
  'believe',
  'feel',
  'know',
  'understand',
  'remember',
  'forget',
  'wonder',
  'imagine',
  'am',
  'is',
  'are',
  'be',
  'being',
  'been',
]);

export const ROUTINE_FREQUENCY_SCORE: Record<string, number> = {
  always: 1.0,
  usually: 0.8,
  typically: 0.8,
  normally: 0.8,
  generally: 0.8,
  often: 0.7,
  frequently: 0.7,
  regularly: 0.7,
  sometimes: 0.5,
  occasionally: 0.3,
  rarely: 0.2,
  seldom: 0.2,
  never: 0.0,
};
