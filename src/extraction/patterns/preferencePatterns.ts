export type PreferenceSentiment =
  | 'very_positive'
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'very_negative'
  | 'restriction';

export type PreferencePatternKind =
  | 'love'
  | 'favorite'
  | 'like'
  | 'enjoy'
  | 'prefer'
  | 'fanOf'
  | 'into'
  | 'hate'
  | 'worst'
  | 'dislike'
  | 'avoid'
  | 'interested'
  | 'hobby'
  | 'activity'
  | 'favoriteFood'
  | 'favoriteDrink'
  | 'dietType'
  | 'favoriteMedia'
  | 'favoriteGenre'
  | 'favoriteColor'
  | 'allergic'
  | 'restriction';

export interface PreferencePattern {
  pattern: RegExp;
  kind: PreferencePatternKind;
  confidence: number;
  sentiment: PreferenceSentiment;
  subjectGroup: number;
  secondarySubjectGroup?: number;
}

const SUBJECT_TOKEN =
  "([a-z][a-z0-9&/+'#.-]*(?:\\s+[a-z0-9][a-z0-9&/+'#.-]*){0,7})";
const SUBJECT_TOKEN_LAZY =
  "([a-z][a-z0-9&/+'#.-]*(?:\\s+[a-z0-9][a-z0-9&/+'#.-]*){0,7}?)";

export const PREFERENCE_PATTERNS: PreferencePattern[] = [
  {
    pattern: new RegExp(
      `i\\s+(?:really\\s+|absolutely\\s+|totally\\s+)?love\\s+${SUBJECT_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'love',
    confidence: 0.94,
    sentiment: 'very_positive',
    subjectGroup: 1,
  },
  {
    pattern: new RegExp(
      `i(?:['’]?m|\\s+am)\\s+(?:really\\s+|absolutely\\s+)?(?:in\\s+love\\s+with|obsessed\\s+with|passionate\\s+about)\\s+${SUBJECT_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'love',
    confidence: 0.92,
    sentiment: 'very_positive',
    subjectGroup: 1,
  },
  {
    pattern: new RegExp(
      `(?:my\\s+(?:absolute\\s+)?)?favorite\\s+(?:food|drink|movie|film|show|series|book|author|band|artist|musician|singer|sport|activity|exercise|workout|music\\s+genre|genre|color)\\s+is\\s+${SUBJECT_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'favorite',
    confidence: 0.92,
    sentiment: 'very_positive',
    subjectGroup: 1,
  },
  {
    pattern: new RegExp(
      `${SUBJECT_TOKEN}\\s+is\\s+(?:my\\s+)?(?:absolute\\s+)?favorite(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'favorite',
    confidence: 0.9,
    sentiment: 'very_positive',
    subjectGroup: 1,
  },
  {
    pattern: new RegExp(
      `i\\s+(?:really\\s+|quite\\s+|kind\\s+of\\s+|kinda\\s+)?like\\s+${SUBJECT_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'like',
    confidence: 0.87,
    sentiment: 'positive',
    subjectGroup: 1,
  },
  {
    pattern: new RegExp(
      `i\\s+(?:really\\s+|truly\\s+)?enjoy\\s+${SUBJECT_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'enjoy',
    confidence: 0.88,
    sentiment: 'positive',
    subjectGroup: 1,
  },
  {
    pattern: new RegExp(
      `i\\s+(?:usually\\s+)?(?:drink|eat|use)\\s+${SUBJECT_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'enjoy',
    confidence: 0.85,
    sentiment: 'positive',
    subjectGroup: 1,
  },
  {
    pattern: new RegExp(
      `i\\s+prefer\\s+${SUBJECT_TOKEN_LAZY}(?:\\s+(?:over|to)\\s+${SUBJECT_TOKEN})?(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'prefer',
    confidence: 0.9,
    sentiment: 'positive',
    subjectGroup: 1,
    secondarySubjectGroup: 2,
  },
  {
    pattern: new RegExp(
      `i(?:['’]?m|\\s+am)\\s+(?:really\\s+|quite\\s+)?(?:a\\s+)?(?:big\\s+)?fan\\s+of\\s+${SUBJECT_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'fanOf',
    confidence: 0.89,
    sentiment: 'positive',
    subjectGroup: 1,
  },
  {
    pattern: new RegExp(
      `i(?:['’]?m|\\s+am)\\s+(?:really\\s+)?into\\s+${SUBJECT_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'into',
    confidence: 0.86,
    sentiment: 'positive',
    subjectGroup: 1,
  },
  {
    pattern: new RegExp(
      `i\\s+(?:really\\s+|absolutely\\s+|totally\\s+)?hate\\s+${SUBJECT_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'hate',
    confidence: 0.93,
    sentiment: 'very_negative',
    subjectGroup: 1,
  },
  {
    pattern: new RegExp(
      `i\\s+(?:really\\s+|absolutely\\s+)?(?:can['’]?t\\s+stand|cannot\\s+stand|despise|loathe|detest)\\s+${SUBJECT_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'hate',
    confidence: 0.92,
    sentiment: 'very_negative',
    subjectGroup: 1,
  },
  {
    pattern: new RegExp(
      `${SUBJECT_TOKEN}\\s+is\\s+(?:my\\s+)?(?:absolute\\s+)?(?:worst|least\\s+favorite)(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'worst',
    confidence: 0.9,
    sentiment: 'very_negative',
    subjectGroup: 1,
  },
  {
    pattern: new RegExp(
      `i\\s+(?:really\\s+|kinda\\s+|kind\\s+of\\s+)?(?:don['’]?t|do\\s+not)\\s+like\\s+${SUBJECT_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'dislike',
    confidence: 0.88,
    sentiment: 'negative',
    subjectGroup: 1,
  },
  {
    pattern: new RegExp(
      `i\\s+(?:really\\s+)?dislike\\s+${SUBJECT_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'dislike',
    confidence: 0.89,
    sentiment: 'negative',
    subjectGroup: 1,
  },
  {
    pattern: new RegExp(
      `i(?:['’]?m|\\s+am)\\s+not\\s+(?:really\\s+)?(?:a\\s+)?(?:big\\s+)?fan\\s+of\\s+${SUBJECT_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'dislike',
    confidence: 0.86,
    sentiment: 'negative',
    subjectGroup: 1,
  },
  {
    pattern: new RegExp(
      `i\\s+(?:tend\\s+to\\s+)?avoid\\s+${SUBJECT_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'avoid',
    confidence: 0.87,
    sentiment: 'negative',
    subjectGroup: 1,
  },
  {
    pattern: new RegExp(
      `i(?:['’]?m|\\s+am)\\s+(?:really\\s+|very\\s+)?interested\\s+in\\s+${SUBJECT_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'interested',
    confidence: 0.88,
    sentiment: 'positive',
    subjectGroup: 1,
  },
  {
    pattern: new RegExp(
      `my\\s+(?:main\\s+)?(?:hobby|hobbies|interest|interests|passion|passions)\\s+(?:is|are|include|includes)\\s+${SUBJECT_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'hobby',
    confidence: 0.9,
    sentiment: 'positive',
    subjectGroup: 1,
  },
  {
    pattern: new RegExp(
      `i\\s+(?:like\\s+to|love\\s+to|enjoy)\\s+${SUBJECT_TOKEN}(?:\\s+in\\s+my\\s+(?:free\\s+time|spare\\s+time))?(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'activity',
    confidence: 0.84,
    sentiment: 'positive',
    subjectGroup: 1,
  },
  {
    pattern:
      /i(?:['’]?m|\s+am)\s+(?:a|an)\s+(vegetarian|vegan|pescatarian|carnivore|omnivore)(?=$|[,.!?])/gi,
    kind: 'dietType',
    confidence: 0.94,
    sentiment: 'neutral',
    subjectGroup: 1,
  },
  {
    pattern: new RegExp(
      `my\\s+favorite\\s+color\\s+is\\s+${SUBJECT_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'favoriteColor',
    confidence: 0.93,
    sentiment: 'very_positive',
    subjectGroup: 1,
  },
  {
    pattern: new RegExp(
      `i(?:['’]?m|\\s+am)\\s+allergic\\s+to\\s+${SUBJECT_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'allergic',
    confidence: 0.95,
    sentiment: 'restriction',
    subjectGroup: 1,
  },
  {
    pattern: new RegExp(
      `i\\s+(?:can['’]?t|cannot)\\s+(?:have|eat|drink|consume)\\s+${SUBJECT_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'restriction',
    confidence: 0.89,
    sentiment: 'restriction',
    subjectGroup: 1,
  },
];

export const PREFERENCE_FALSE_POSITIVE_PATTERNS: Partial<
  Record<PreferencePatternKind, string[]>
> = {
  like: [
    'like to think',
    'like to believe',
    'like to say',
    'like to mention',
    'like that idea',
    "i'd like to",
    'i would like to',
  ],
  love: [
    "i'd love to",
    'i would love to',
    'love to hate',
    'love to see',
    'love you',
    'love him',
    'love her',
  ],
  hate: ['hate to say', 'hate to admit', 'hate to tell', 'hate to break'],
  into: [
    'into trouble',
    'into debt',
    'into pieces',
    'into account',
    'into consideration',
  ],
};

export const PREFERENCE_INVALID_SUBJECTS = new Set([
  'it',
  'that',
  'this',
  'these',
  'those',
  'them',
  'they',
  'everything',
  'nothing',
  'something',
  'anything',
  'people',
  'everyone',
  'someone',
  'anyone',
  'nobody',
  'life',
  'death',
  'myself',
]);

export const PREFERENCE_KNOWN_CATEGORIES: Record<string, Set<string>> = {
  food: new Set(['pizza', 'pasta', 'sushi', 'tacos', 'burgers', 'salad']),
  drinks: new Set(['coffee', 'tea', 'water', 'juice', 'soda', 'wine']),
  music: new Set(['rock', 'pop', 'jazz', 'classical', 'hip hop', 'edm']),
  sports: new Set([
    'soccer',
    'football',
    'basketball',
    'tennis',
    'running',
    'hiking',
    'yoga',
  ]),
  activities: new Set([
    'reading',
    'writing',
    'cooking',
    'gaming',
    'photography',
    'traveling',
  ]),
  colors: new Set([
    'red',
    'blue',
    'green',
    'yellow',
    'orange',
    'purple',
    'pink',
    'black',
    'white',
  ]),
};
