export type EducationPatternKind =
  | 'degreeInstitution'
  | 'degreeMajor'
  | 'degreeMajorInstitution'
  | 'majorInstitution'
  | 'currentStudent'
  | 'studying'
  | 'institution'
  | 'graduated'
  | 'academicLevel'
  | 'pursuingDegree'
  | 'certification'
  | 'dropout'
  | 'incomplete'
  | 'honors'
  | 'gpa';

export interface EducationPattern {
  pattern: RegExp;
  kind: EducationPatternKind;
  confidence: number;
  degreeGroup?: number;
  fieldGroup?: number;
  institutionGroup?: number;
  statusGroup?: number;
  yearGroup?: number;
}

const DEGREE_TOKEN =
  "(?:bachelor(?:'s)?|master(?:'s)?|associate(?:'s)?|phd|doctorate|doctoral|mba|md|jd|bs|ba|ms|ma|bsc|msc|dphil)";
const FIELD_TOKEN = "([a-z][a-z0-9&/+'-]*(?:\\s+[a-z0-9][a-z0-9&/+'-]*){0,7})";
const FIELD_TOKEN_LAZY =
  "([a-z][a-z0-9&/+'-]*(?:\\s+[a-z0-9][a-z0-9&/+'-]*){0,7}?)";
const INSTITUTION_TOKEN =
  "([a-z][a-z0-9&.'-]*(?:\\s+[a-z0-9][a-z0-9&.'-]*){0,6})";

export const EDUCATION_PATTERNS: EducationPattern[] = [
  {
    pattern: new RegExp(
      `i\\s+(?:have|got|earned|received|hold)\\s+(?:a|an|my)\\s+(${DEGREE_TOKEN}(?:\\s+degree)?)\\s+in\\s+${FIELD_TOKEN}\\s+(?:from|at)\\s+${INSTITUTION_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'degreeMajorInstitution',
    confidence: 0.95,
    degreeGroup: 1,
    fieldGroup: 2,
    institutionGroup: 3,
  },
  {
    pattern: new RegExp(
      `i\\s+(?:have|got|earned|received|hold)\\s+(?:a|an|my)\\s+(${DEGREE_TOKEN}(?:\\s+degree)?)\\s+(?:from|at)\\s+${INSTITUTION_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'degreeInstitution',
    confidence: 0.93,
    degreeGroup: 1,
    institutionGroup: 2,
  },
  {
    pattern: new RegExp(
      `i\\s+(?:have|got|earned|received|hold)\\s+(?:a|an|my)\\s+(${DEGREE_TOKEN}(?:\\s+degree)?)\\s+in\\s+${FIELD_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'degreeMajor',
    confidence: 0.92,
    degreeGroup: 1,
    fieldGroup: 2,
  },
  {
    pattern: new RegExp(
      `i\\s+studied\\s+${FIELD_TOKEN}\\s+at\\s+${INSTITUTION_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'majorInstitution',
    confidence: 0.89,
    fieldGroup: 1,
    institutionGroup: 2,
  },
  {
    pattern: new RegExp(
      `i(?:['’]?m|\\s+am)\\s+(?:currently\\s+)?(?:a|an)\\s+(undergraduate|graduate|phd|doctoral|master(?:'s)?|bachelor(?:'s)?)\\s+student(?:\\s+at\\s+${INSTITUTION_TOKEN})?(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'currentStudent',
    confidence: 0.91,
    statusGroup: 1,
    institutionGroup: 2,
  },
  {
    pattern: new RegExp(
      `i(?:['’]?m|\\s+am)\\s+(?:currently\\s+)?studying\\s+${FIELD_TOKEN_LAZY}(?:\\s+at\\s+${INSTITUTION_TOKEN})?(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'studying',
    confidence: 0.88,
    fieldGroup: 1,
    institutionGroup: 2,
  },
  {
    pattern: new RegExp(
      `i\\s+(?:went|go|attended)\\s+to\\s+${INSTITUTION_TOKEN}(?:\\s+(?:university|college|school))?(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'institution',
    confidence: 0.85,
    institutionGroup: 1,
  },
  {
    pattern: new RegExp(
      `i\\s+graduated\\s+from\\s+${INSTITUTION_TOKEN}(?:\\s+(?:university|college|school))?(?:\\s+in\\s+(\\d{4}))?(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'graduated',
    confidence: 0.92,
    institutionGroup: 1,
    yearGroup: 2,
  },
  {
    pattern:
      /i(?:['’]?m|\s+am)\s+(?:a|an)\s+(freshman|sophomore|junior|senior|first-year|second-year|third-year|fourth-year|postdoc|postdoctoral\s+(?:researcher|fellow)|grad(?:uate)?\s+student)(?=$|[,.!?])/gi,
    kind: 'academicLevel',
    confidence: 0.9,
    statusGroup: 1,
  },
  {
    pattern: new RegExp(
      `i(?:['’]?m|\\s+am)\\s+(?:working\\s+on|pursuing|doing)\\s+my\\s+(${DEGREE_TOKEN})(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'pursuingDegree',
    confidence: 0.91,
    degreeGroup: 1,
  },
  {
    pattern: new RegExp(
      `i\\s+(?:have|got|earned|received|completed)\\s+(?:a|an|my)\\s+(certification|certificate|diploma)\\s+in\\s+${FIELD_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'certification',
    confidence: 0.88,
    statusGroup: 1,
    fieldGroup: 2,
  },
  {
    pattern: new RegExp(
      `i\\s+(?:dropped\\s+out|left)\\s+(?:of|from)\\s+${INSTITUTION_TOKEN}(?:\\s+(?:university|college|school))?(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'dropout',
    confidence: 0.9,
    institutionGroup: 1,
  },
  {
    pattern: new RegExp(
      `i\\s+(?:didn['’]?t|did\\s+not)\\s+(?:finish|complete|graduate\\s+from)\\s+${INSTITUTION_TOKEN}(?=$|[,.!?])`,
      'gi',
    ),
    kind: 'incomplete',
    confidence: 0.88,
    institutionGroup: 1,
  },
  {
    pattern:
      /i\s+graduated\s+(?:with\s+)?(summa\s+cum\s+laude|magna\s+cum\s+laude|cum\s+laude|honors|distinction)(?=$|[,.!?])/gi,
    kind: 'honors',
    confidence: 0.92,
    statusGroup: 1,
  },
  {
    pattern: /i\s+(?:have|hold)\s+a\s+(\d+\.\d+)\s+gpa(?=$|[,.!?])/gi,
    kind: 'gpa',
    confidence: 0.91,
    statusGroup: 1,
  },
];

export const EDUCATION_VALIDATION = {
  degreeTypes: new Set([
    'bachelor',
    'bachelors',
    "bachelor's",
    'bs',
    'ba',
    'bsc',
    'associate',
    'associates',
    "associate's",
    'master',
    'masters',
    "master's",
    'ms',
    'ma',
    'msc',
    'mba',
    'phd',
    'doctorate',
    'doctoral',
    'dphil',
    'md',
    'jd',
    'certificate',
    'certification',
    'diploma',
  ]),
  fieldsOfStudy: new Set([
    'computer science',
    'cs',
    'software engineering',
    'data science',
    'machine learning',
    'artificial intelligence',
    'electrical engineering',
    'mechanical engineering',
    'physics',
    'chemistry',
    'biology',
    'mathematics',
    'statistics',
    'business',
    'finance',
    'economics',
    'marketing',
    'psychology',
    'history',
    'law',
    'medicine',
    'nursing',
    'education',
    'architecture',
  ]),
  institutions: new Set([
    'mit',
    'stanford',
    'harvard',
    'yale',
    'princeton',
    'columbia',
    'berkeley',
    'uc berkeley',
    'caltech',
    'cmu',
    'carnegie mellon',
    'oxford',
    'cambridge',
    'imperial',
    'ucl',
    'toronto',
    'mcgill',
    'waterloo',
    'nus',
    'ntu',
  ]),
  invalidFields: new Set([
    'life',
    'hard knocks',
    'partying',
    'procrastination',
    'sleeping',
    'hard',
    'abroad',
    'online',
    'home',
    'years',
    'my exam',
    'for my exam',
  ]),
  invalidInstitutions: new Set([
    'sleep',
    'bed',
    'work',
    'school',
    'college',
    'university',
    'hell',
    'heaven',
    'life',
    'home',
    'town',
    'trouble',
    'gym',
  ]),
  idioms: [
    'school of hard knocks',
    'university of life',
    'college of life',
    'phd in procrastination',
    'degree in life',
    'graduated from life',
    'studied hard',
    'studied abroad',
    'studied for years',
  ] as const,
};
