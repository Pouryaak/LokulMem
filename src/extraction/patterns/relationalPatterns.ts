export type RelationalPatternKind =
  | 'namedRelation'
  | 'relationMention'
  | 'relationStatus'
  | 'relationCount';

export interface RelationalPattern {
  pattern: RegExp;
  kind: RelationalPatternKind;
  confidence: number;
  relationGroup?: number;
  relationValue?: string;
  nameGroup?: number;
  countGroup?: number;
}

export const RELATION_TERMS = [
  'mother',
  'mom',
  'father',
  'dad',
  'parent',
  'brother',
  'sister',
  'sibling',
  'son',
  'daughter',
  'child',
  'kid',
  'wife',
  'husband',
  'spouse',
  'partner',
  'girlfriend',
  'boyfriend',
  'fiance',
  'fiancee',
  'friend',
  'roommate',
  'boss',
  'manager',
  'colleague',
  'coworker',
  'mentor',
  'mentee',
  'dog',
  'cat',
  'pet',
] as const;

export const RELATIONAL_IDIOM_BLOCKLIST = [
  'married to my work',
  'married to the job',
  'mother of all',
  'mother of invention',
  'father figure',
  'mother hen',
  'brother in arms',
  'live with anxiety',
  'live with regret',
  'live with pain',
  'live with fear',
  'live with guilt',
  'live with myself',
] as const;

export const RELATIONAL_NAME_BLOCKLIST = [
  'always',
  'never',
  'really',
  'very',
  'quite',
  'just',
  'only',
  'amazing',
  'wonderful',
  'terrible',
  'great',
  'happy',
  'sad',
  'angry',
  'excited',
  'stuff',
  'things',
  'python',
  'java',
  'javascript',
  'react',
  'angular',
  'vue',
] as const;

export const KNOWN_COMPANY_TOKENS = [
  'google',
  'microsoft',
  'apple',
  'amazon',
  'meta',
  'openai',
  'anthropic',
  'netflix',
  'tesla',
  'spacex',
] as const;

const namedRelationPatterns: RelationalPattern[] = [
  {
    pattern:
      /my\s+(mother|mom|father|dad|parent|brother|sister|sibling|son|daughter|child|kid|wife|husband|spouse|partner|girlfriend|boyfriend|fiance|fiancee|friend|roommate|boss|manager|colleague|coworker|mentor|mentee|dog|cat|pet)['’]?s\s+name\s+is\s+([a-z][a-z'’-]{1,30}(?:\s+[a-z][a-z'’-]{1,30}){0,2})(?=$|[,.!?\s])/gi,
    kind: 'namedRelation',
    confidence: 0.95,
    relationGroup: 1,
    nameGroup: 2,
  },
  {
    pattern:
      /my\s+(mother|mom|father|dad|parent|brother|sister|sibling|son|daughter|child|kid|wife|husband|spouse|partner|girlfriend|boyfriend|fiance|fiancee|friend|roommate|boss|manager|colleague|coworker|mentor|mentee|dog|cat|pet)\s+(?:is\s+)?(?:named\s+|called\s+)?([a-z][a-z'’-]{1,30}(?:\s+[a-z][a-z'’-]{1,30}){0,2})(?=$|[,.!?\s])/gi,
    kind: 'namedRelation',
    confidence: 0.91,
    relationGroup: 1,
    nameGroup: 2,
  },
  {
    pattern:
      /([a-z][a-z'’-]{1,30}(?:\s+[a-z][a-z'’-]{1,30}){0,2})\s+is\s+my\s+(mother|mom|father|dad|parent|brother|sister|sibling|son|daughter|child|kid|wife|husband|spouse|partner|girlfriend|boyfriend|fiance|fiancee|friend|roommate|boss|manager|colleague|coworker|mentor|mentee|dog|cat|pet)(?=$|[,.!?\s])/gi,
    kind: 'namedRelation',
    confidence: 0.9,
    relationGroup: 2,
    nameGroup: 1,
  },
  {
    pattern:
      /i['’]?m\s+married\s+to\s+([a-z][a-z'’-]{1,30}(?:\s+[a-z][a-z'’-]{1,30}){0,2})(?=$|[,.!?\s])/gi,
    kind: 'namedRelation',
    confidence: 0.93,
    relationValue: 'spouse',
    nameGroup: 1,
  },
];

const relationMentionPatterns: RelationalPattern[] = [
  {
    pattern:
      /\bmy\s+(mother|mom|father|dad|parent|brother|sister|sibling|son|daughter|child|kid|wife|husband|spouse|partner|girlfriend|boyfriend|fiance|fiancee|friend|roommate|boss|manager|colleague|coworker|mentor|mentee|dog|cat|pet)\b/gi,
    kind: 'relationMention',
    confidence: 0.82,
    relationGroup: 1,
  },
  {
    pattern:
      /i\s+have\s+(?:a|an)\s+(mother|mom|father|dad|parent|brother|sister|sibling|son|daughter|child|kid|wife|husband|spouse|partner|girlfriend|boyfriend|fiance|fiancee|friend|roommate|dog|cat|pet)(?=$|[,.!?\s])/gi,
    kind: 'relationMention',
    confidence: 0.86,
    relationGroup: 1,
  },
  {
    pattern:
      /i\s+live\s+with\s+my\s+(mother|mom|father|dad|parent|brother|sister|sibling|partner|roommate|friend)(?=$|[,.!?\s])/gi,
    kind: 'relationMention',
    confidence: 0.86,
    relationGroup: 1,
  },
];

const relationStatusPatterns: RelationalPattern[] = [
  {
    pattern:
      /(?:i['’]?m|i\s+am)\s+(married|single|divorced|widowed|engaged|in\s+a\s+relationship|dating)(?!\s+to\s+(?:my\s+)?work)(?=$|[,.!?\s])/gi,
    kind: 'relationStatus',
    confidence: 0.89,
    relationGroup: 1,
  },
];

const relationCountPatterns: RelationalPattern[] = [
  {
    pattern:
      /i\s+have\s+(\d{1,2})\s+(brothers?|sisters?|siblings?|sons?|daughters?|children|kids)(?=$|[,.!?\s])/gi,
    kind: 'relationCount',
    confidence: 0.92,
    relationGroup: 2,
    countGroup: 1,
  },
];

export const RELATIONAL_PATTERNS: RelationalPattern[] = [
  ...namedRelationPatterns,
  ...relationMentionPatterns,
  ...relationStatusPatterns,
  ...relationCountPatterns,
];
