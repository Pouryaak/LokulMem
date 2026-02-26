export type TemporalPatternKind =
  | 'absoluteDate'
  | 'dateNumeric'
  | 'dateIso'
  | 'year'
  | 'relativePresent'
  | 'relativePast'
  | 'relativeFuture'
  | 'relativePeriod'
  | 'relativeCount'
  | 'absoluteTime'
  | 'absoluteTime24h'
  | 'timeReference'
  | 'timeOfDay'
  | 'duration'
  | 'durationSince'
  | 'timeRange'
  | 'recurringEvent'
  | 'futurePlan'
  | 'pastEvent'
  | 'temporalRelationship'
  | 'season'
  | 'period';

export interface TemporalPattern {
  pattern: RegExp;
  kind: TemporalPatternKind;
  confidence: number;
  groups?: number[];
}

const MONTHS =
  '(january|february|march|april|may|june|july|august|september|october|november|december)';
const WEEK_DAYS = '(monday|tuesday|wednesday|thursday|friday|saturday|sunday)';

export const TEMPORAL_PATTERNS: TemporalPattern[] = [
  {
    pattern: new RegExp(
      `(?:on\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTHS}(?:,?\\s+(\\d{4}))?(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'absoluteDate',
    confidence: 0.95,
    groups: [1, 2, 3],
  },
  {
    pattern: new RegExp(
      `${MONTHS}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'absoluteDate',
    confidence: 0.94,
    groups: [1, 2, 3],
  },
  {
    pattern: /(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?=$|[,.!?])/gi,
    kind: 'dateNumeric',
    confidence: 0.88,
    groups: [1, 2, 3],
  },
  {
    pattern: /(\d{4})-(\d{2})-(\d{2})(?=$|[,.!?])/gi,
    kind: 'dateIso',
    confidence: 0.96,
    groups: [1, 2, 3],
  },
  {
    pattern: /(?:in|since|during|back in|around|from)\s+(\d{4})(?=$|[,.!?])/gi,
    kind: 'year',
    confidence: 0.84,
    groups: [1],
  },
  {
    pattern:
      /\b(today|tonight|now|currently|right\s+now|at\s+the\s+moment)\b/gi,
    kind: 'relativePresent',
    confidence: 0.93,
    groups: [1],
  },
  {
    pattern: /\b(yesterday|last\s+night)\b/gi,
    kind: 'relativePast',
    confidence: 0.94,
    groups: [1],
  },
  {
    pattern: /\b(tomorrow|tmrw)\b/gi,
    kind: 'relativeFuture',
    confidence: 0.94,
    groups: [1],
  },
  {
    pattern: new RegExp(
      `\\b(last|this|next)\\s+(week|month|year|${WEEK_DAYS})\\b`,
      'gi',
    ),
    kind: 'relativePeriod',
    confidence: 0.91,
    groups: [1, 2],
  },
  {
    pattern: /(\d+)\s+(days?|weeks?|months?|years?)\s+ago(?=$|[,.!?])/gi,
    kind: 'relativeCount',
    confidence: 0.92,
    groups: [1, 2],
  },
  {
    pattern:
      /(?:in\s+)(\d+)\s+(days?|weeks?|months?|years?)(?:\s+from\s+now)?(?=$|[,.!?])/gi,
    kind: 'relativeCount',
    confidence: 0.9,
    groups: [1, 2],
  },
  {
    pattern: /(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?=$|[,.!?])/gi,
    kind: 'absoluteTime',
    confidence: 0.94,
    groups: [1, 2, 3],
  },
  {
    pattern: /(?:at\s+)?(\d{1,2}):(\d{2})(?=$|[,.!?])/gi,
    kind: 'absoluteTime24h',
    confidence: 0.91,
    groups: [1, 2],
  },
  {
    pattern: /\b(noon|midnight|dawn|dusk|sunrise|sunset)\b/gi,
    kind: 'timeReference',
    confidence: 0.89,
    groups: [1],
  },
  {
    pattern:
      /\b(?:in\s+the|this|last|early|late)\s+(morning|afternoon|evening|night)\b/gi,
    kind: 'timeOfDay',
    confidence: 0.82,
    groups: [1],
  },
  {
    pattern:
      /for\s+(?:about\s+|around\s+|approximately\s+)?(\d+(?:\.\d+)?)\s+(seconds?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?)(?=$|[,.!?])/gi,
    kind: 'duration',
    confidence: 0.92,
    groups: [1, 2],
  },
  {
    pattern: new RegExp(
      `since\\s+(${MONTHS}|\\d{4}|yesterday|last\\s+\\w+)(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'durationSince',
    confidence: 0.9,
    groups: [1],
  },
  {
    pattern:
      /(?:from|between)\s+([\w\s:]+?)\s+(?:to|until|and)\s+([\w\s:]+?)(?=$|[,.!?])/gi,
    kind: 'timeRange',
    confidence: 0.87,
    groups: [1, 2],
  },
  {
    pattern:
      /\b(christmas|thanksgiving|new\s+year['’]?s?|easter|halloween|valentine['’]?s?\s+day|independence\s+day|memorial\s+day|labor\s+day)\b/gi,
    kind: 'recurringEvent',
    confidence: 0.92,
    groups: [1],
  },
  {
    pattern:
      /i(?:['’]?m|\s+am)\s+(?:planning|going)\s+to\s+([\w\s]{2,50})\s+(?:in|on|next)\s+([\w\s]{2,20})(?=$|[,.!?])/gi,
    kind: 'futurePlan',
    confidence: 0.88,
    groups: [1, 2],
  },
  {
    pattern:
      /(?:back\s+)?in\s+(\d{4}|the\s+\d{2,4}s)\s+i\s+([\w\s]{2,50})(?=$|[,.!?])/gi,
    kind: 'pastEvent',
    confidence: 0.88,
    groups: [1, 2],
  },
  {
    pattern:
      /(?:before|after|during|while|throughout)\s+([\w\s]{2,30})\s+i\s+([\w\s]{2,50})(?=$|[,.!?])/gi,
    kind: 'temporalRelationship',
    confidence: 0.85,
    groups: [1, 2],
  },
  {
    pattern:
      /\b(?:in\s+)?(?:the\s+)?(spring|summer|fall|autumn|winter)(?:\s+of\s+(\d{4}))?(?=$|[,.!?])/gi,
    kind: 'season',
    confidence: 0.87,
    groups: [1, 2],
  },
  {
    pattern:
      /\b(?:in\s+)?(?:the\s+)?(first|second|third|fourth)\s+quarter(?:\s+of\s+(\d{4}))?(?=$|[,.!?])/gi,
    kind: 'period',
    confidence: 0.89,
    groups: [1, 2],
  },
];
