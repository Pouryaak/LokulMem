export type ContactPatternKind =
  | 'userName'
  | 'contactName'
  | 'nickname'
  | 'phoneNumber'
  | 'phoneInternational'
  | 'email'
  | 'streetAddress'
  | 'cityStateZip'
  | 'city'
  | 'state'
  | 'zipCode'
  | 'country'
  | 'socialHandle'
  | 'website'
  | 'relationship'
  | 'contactEmployment'
  | 'employment'
  | 'organization'
  | 'contactBirthday'
  | 'anniversary'
  | 'preferredContactMethod'
  | 'contactMethodAvoid'
  | 'availability';

export interface ContactPattern {
  pattern: RegExp;
  kind: ContactPatternKind;
  confidence: number;
  pii: boolean;
  groups?: number[];
}

const NAME_TOKEN = '([A-Z][a-z]+(?:\\s+[A-Z][a-z]+){0,2})';

export const CONTACT_PATTERNS: ContactPattern[] = [
  {
    pattern: new RegExp(`my\\s+name\\s+is\\s+${NAME_TOKEN}(?=$|[,.!?])`, 'g'),
    kind: 'userName',
    confidence: 0.94,
    pii: true,
    groups: [1],
  },
  {
    pattern: new RegExp(`i['’]?m\\s+${NAME_TOKEN}(?=$|[,.!?])`, 'g'),
    kind: 'userName',
    confidence: 0.85,
    pii: true,
    groups: [1],
  },
  {
    pattern:
      /my\s+(?:nickname|alias)\s+is\s+([a-zA-Z0-9_]{2,30})(?=$|[,.!?])/gi,
    kind: 'nickname',
    confidence: 0.91,
    pii: true,
    groups: [1],
  },
  {
    pattern: /(?:call|known\s+as)\s+me\s+([a-zA-Z0-9_]{2,30})(?=$|[,.!?])/gi,
    kind: 'nickname',
    confidence: 0.88,
    pii: true,
    groups: [1],
  },
  {
    pattern:
      /(?:\+?1[-.\s]?)?\(?([2-9]\d{2})\)?[-.\s]?([2-9]\d{2})[-.\s]?(\d{4})(?=$|[,.!?\s])/g,
    kind: 'phoneNumber',
    confidence: 0.88,
    pii: true,
    groups: [1, 2, 3],
  },
  {
    pattern:
      /(?:international|intl)(?:\s+number)?:?\s*(\+\d{1,3}[-.\s]?\d{1,14})(?=$|[,.!?\s])/gi,
    kind: 'phoneInternational',
    confidence: 0.9,
    pii: true,
    groups: [1],
  },
  {
    pattern: /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
    kind: 'email',
    confidence: 0.96,
    pii: true,
    groups: [1],
  },
  {
    pattern:
      /\b(\d{1,5})\s+([A-Za-z][A-Za-z\s]{1,40})\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\.?\b(?:\s+(?:Apt|Apartment|Unit|Suite|Ste)\.?\s*#?(\w+))?/gi,
    kind: 'streetAddress',
    confidence: 0.91,
    pii: true,
    groups: [1, 2, 3, 4],
  },
  {
    pattern:
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)(?=$|[,.!?\s])/g,
    kind: 'cityStateZip',
    confidence: 0.94,
    pii: true,
    groups: [1, 2, 3],
  },
  {
    pattern:
      /(?:twitter|x\.com|instagram|ig|github)\s*(?:handle|username|is|:)?\s*@?([a-zA-Z0-9_.-]{1,39})(?=$|[,.!?\s])/gi,
    kind: 'socialHandle',
    confidence: 0.9,
    pii: true,
    groups: [1],
  },
  {
    pattern:
      /\b((?:https?:\/\/)?(?:www\.)?(?<!@)[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)\b/g,
    kind: 'website',
    confidence: 0.88,
    pii: false,
    groups: [1],
  },
  {
    pattern:
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+is\s+my\s+(friend|best\s+friend|colleague|coworker|boss|manager|mentor|partner|spouse|wife|husband|girlfriend|boyfriend|brother|sister|mother|father|mom|dad|son|daughter|cousin|uncle|aunt|nephew|niece|grandparent|grandfather|grandmother)(?=$|[,.!?\s])/g,
    kind: 'relationship',
    confidence: 0.91,
    pii: true,
    groups: [1, 2],
  },
  {
    pattern:
      /my\s+(friend|best\s+friend|colleague|coworker|boss|manager|mentor|partner|spouse|wife|husband|girlfriend|boyfriend|brother|sister|mother|father|mom|dad|son|daughter|cousin|uncle|aunt|nephew|niece|grandparent|grandfather|grandmother)\s+(?:is\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?=$|[,.!?\s])/g,
    kind: 'relationship',
    confidence: 0.9,
    pii: true,
    groups: [1, 2],
  },
  {
    pattern:
      /i\s+work\s+(?:at|for)\s+([A-Za-z0-9&.\s]{2,50}?)(?:\s+as\s+([A-Za-z0-9\s]{2,40}))?(?=$|[,.!?])/gi,
    kind: 'employment',
    confidence: 0.88,
    pii: true,
    groups: [1, 2],
  },
  {
    pattern:
      /i['’]?m\s+(?:a|an)\s+([A-Za-z0-9\s]{2,40})\s+at\s+([A-Za-z0-9&.\s]{2,50})(?=$|[,.!?])/gi,
    kind: 'employment',
    confidence: 0.89,
    pii: true,
    groups: [1, 2],
  },
  {
    pattern:
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)'?s?\s+birthday\s+is\s+(?:on\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?=$|[,.!?\s])/gi,
    kind: 'contactBirthday',
    confidence: 0.94,
    pii: true,
    groups: [1, 2, 3],
  },
  {
    pattern:
      /(?:prefer|best\s+way)\s+to\s+(?:contact|reach)\s+me\s+is\s+(?:via|by|through)\s+(email|phone|text|call|social\s+media|linkedin|twitter)(?=$|[,.!?\s])/gi,
    kind: 'preferredContactMethod',
    confidence: 0.9,
    pii: false,
    groups: [1],
  },
  {
    pattern:
      /i\s+(?:don['’]?t|do\s+not)\s+(?:use|have|check)\s+(email|phone|text|social\s+media|facebook|twitter|instagram)(?=$|[,.!?\s])/gi,
    kind: 'contactMethodAvoid',
    confidence: 0.87,
    pii: false,
    groups: [1],
  },
];

export const CONTACT_VALIDATION = {
  commonFirstNames: new Set([
    'james',
    'john',
    'robert',
    'michael',
    'mary',
    'jennifer',
    'sarah',
    'emily',
    'emma',
    'olivia',
    'ava',
    'sophia',
    'isabella',
    'charlotte',
  ]),
  invalidNames: new Set([
    'american',
    'british',
    'canadian',
    'happy',
    'sad',
    'angry',
    'excited',
    'tired',
    'today',
    'tomorrow',
    'yesterday',
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ]),
  usStates: new Set([
    'AL',
    'AK',
    'AZ',
    'AR',
    'CA',
    'CO',
    'CT',
    'DE',
    'FL',
    'GA',
    'HI',
    'ID',
    'IL',
    'IN',
    'IA',
    'KS',
    'KY',
    'LA',
    'ME',
    'MD',
    'MA',
    'MI',
    'MN',
    'MS',
    'MO',
    'MT',
    'NE',
    'NV',
    'NH',
    'NJ',
    'NM',
    'NY',
    'NC',
    'ND',
    'OH',
    'OK',
    'OR',
    'PA',
    'RI',
    'SC',
    'SD',
    'TN',
    'TX',
    'UT',
    'VT',
    'VA',
    'WA',
    'WV',
    'WI',
    'WY',
    'DC',
  ]),
  relationshipTypes: new Set([
    'friend',
    'best friend',
    'colleague',
    'coworker',
    'boss',
    'manager',
    'mentor',
    'partner',
    'spouse',
    'wife',
    'husband',
    'girlfriend',
    'boyfriend',
    'brother',
    'sister',
    'mother',
    'father',
    'mom',
    'dad',
    'son',
    'daughter',
    'cousin',
    'uncle',
    'aunt',
    'nephew',
    'niece',
    'grandparent',
    'grandfather',
    'grandmother',
  ]),
};
