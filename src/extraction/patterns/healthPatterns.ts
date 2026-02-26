export type HealthPatternKind =
  | 'medicalCondition'
  | 'medicalHistory'
  | 'symptom'
  | 'painLocation'
  | 'medication'
  | 'medicationPrescribed'
  | 'medicationStopped'
  | 'allergy'
  | 'medicalProcedure'
  | 'scheduledProcedure'
  | 'treatment'
  | 'bloodPressure'
  | 'bloodSugar'
  | 'weight'
  | 'height'
  | 'bmi'
  | 'heartRate'
  | 'mentalHealthCondition'
  | 'mentalHealthProvider'
  | 'therapy'
  | 'familyHistory'
  | 'healthcareProvider'
  | 'healthcareVisit'
  | 'medicalAppointment';

export interface HealthPattern {
  pattern: RegExp;
  kind: HealthPatternKind;
  confidence: number;
  sensitive: boolean;
  critical?: boolean;
  groups?: number[];
}

const TERM_TOKEN = "([a-z][a-z0-9&/+' -]{1,50})";

export const HEALTH_PATTERNS: HealthPattern[] = [
  {
    pattern: new RegExp(
      `i\\s+(?:have|have\\s+been\\s+diagnosed\\s+with|was\\s+diagnosed\\s+with|suffer\\s+from)\\s+${TERM_TOKEN}(?=\\s+(?:and|but)\\b|$|[,.!?])`,
      'gi',
    ),
    kind: 'medicalCondition',
    confidence: 0.91,
    sensitive: true,
    groups: [1],
  },
  {
    pattern:
      /i['’]?m\s+(?:a\s+)?(diabetic|asthmatic|hypertensive|epileptic|anemic)(?=$|[,.!?])/gi,
    kind: 'medicalCondition',
    confidence: 0.93,
    sensitive: true,
    groups: [1],
  },
  {
    pattern: new RegExp(
      `i\\s+(?:struggle|deal)\\s+with\\s+${TERM_TOKEN}(?=\\s+(?:and|but)\\b|$|[,.!?])`,
      'gi',
    ),
    kind: 'medicalCondition',
    confidence: 0.85,
    sensitive: true,
    groups: [1],
  },
  {
    pattern:
      /i['’]?m\s+(?:experiencing|having|feeling)\s+([a-z][a-z0-9&/+' -]{1,50})(?=$|[,.!?])/gi,
    kind: 'symptom',
    confidence: 0.82,
    sensitive: true,
    groups: [1],
  },
  {
    pattern:
      /i\s+(?:have|get|experience)\s+(?:frequent|chronic|severe|mild)?\s*([a-z][a-z0-9&/+' -]{1,40})(?:\s+(?:attacks?|episodes?|flare-?ups?))?(?=$|[,.!?])/gi,
    kind: 'symptom',
    confidence: 0.84,
    sensitive: true,
    groups: [1],
  },
  {
    pattern:
      /my\s+(head|chest|stomach|back|neck|throat|joints?|muscles?)\s+(?:hurts?|aches?|is\s+(?:hurting|aching|sore|painful))(?=$|[,.!?])/gi,
    kind: 'painLocation',
    confidence: 0.88,
    sensitive: true,
    groups: [1],
  },
  {
    pattern:
      /i['’]?m\s+(?:taking|on|using)\s+([a-z][a-z0-9&/+' -]{1,40})(?:\s+(?:medication|medicine|pills?|tablets?|drug))?(?=$|[,.!?])/gi,
    kind: 'medication',
    confidence: 0.87,
    sensitive: true,
    groups: [1],
  },
  {
    pattern:
      /i\s+take\s+([a-z][a-z0-9&/+' -]{1,40})(?:\s+(?:daily|every\s+day|twice\s+a\s+day|once\s+a\s+day))?(?=$|[,.!?])/gi,
    kind: 'medication',
    confidence: 0.85,
    sensitive: true,
    groups: [1],
  },
  {
    pattern:
      /my\s+(?:doctor|physician)\s+prescribed\s+([a-z][a-z0-9&/+' -]{1,40})(?=$|[,.!?])/gi,
    kind: 'medicationPrescribed',
    confidence: 0.9,
    sensitive: true,
    groups: [1],
  },
  {
    pattern:
      /i\s+(?:stopped|quit)\s+taking\s+([a-z][a-z0-9&/+' -]{1,40})(?=$|[,.!?])/gi,
    kind: 'medicationStopped',
    confidence: 0.88,
    sensitive: true,
    groups: [1],
  },
  {
    pattern:
      /i['’]?m\s+allergic\s+to\s+([a-z][a-z0-9,&/+' -]{1,60})(?=$|[,.!?])/gi,
    kind: 'allergy',
    confidence: 0.95,
    sensitive: true,
    critical: true,
    groups: [1],
  },
  {
    pattern:
      /i\s+have\s+(?:an?\s+)?allerg(?:y|ies)\s+to\s+([a-z][a-z0-9,&/+' -]{1,60})(?=$|[,.!?])/gi,
    kind: 'allergy',
    confidence: 0.94,
    sensitive: true,
    critical: true,
    groups: [1],
  },
  {
    pattern:
      /i\s+(?:had|underwent|got)\s+(?:a\s+)?([a-z][a-z0-9&/+' -]{1,40})\s+(?:surgery|operation|procedure|transplant)(?=$|[,.!?])/gi,
    kind: 'medicalProcedure',
    confidence: 0.9,
    sensitive: true,
    groups: [1],
  },
  {
    pattern:
      /i['’]?m\s+scheduled\s+for\s+(?:a\s+)?([a-z][a-z0-9&/+' -]{1,40})(?:\s+(?:surgery|operation|procedure))?(?=$|[,.!?])/gi,
    kind: 'scheduledProcedure',
    confidence: 0.89,
    sensitive: true,
    groups: [1],
  },
  {
    pattern: /my\s+blood\s+pressure\s+is\s+(\d{2,3})\/(\d{2,3})(?=$|[,.!?])/gi,
    kind: 'bloodPressure',
    confidence: 0.96,
    sensitive: true,
    groups: [1, 2],
  },
  {
    pattern:
      /my\s+(?:blood\s+)?sugar\s+(?:level\s+)?is\s+(\d{2,3})(?=$|[,.!?])/gi,
    kind: 'bloodSugar',
    confidence: 0.93,
    sensitive: true,
    groups: [1],
  },
  {
    pattern:
      /(?:i\s+weigh|my\s+weight\s+is)\s+(\d{2,3}(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilograms?)(?=$|[,.!?])/gi,
    kind: 'weight',
    confidence: 0.92,
    sensitive: true,
    groups: [1, 2],
  },
  {
    pattern: /i['’]?m\s+(\d+)['’](\d{1,2})\s*(?:tall)?(?=$|[,.!?])/gi,
    kind: 'height',
    confidence: 0.91,
    sensitive: true,
    groups: [1, 2],
  },
  {
    pattern:
      /my\s+height\s+is\s+(\d+(?:\.\d+)?)\s*(cm|meters?|m|feet|ft)(?=$|[,.!?])/gi,
    kind: 'height',
    confidence: 0.92,
    sensitive: true,
    groups: [1, 2],
  },
  {
    pattern:
      /my\s+(?:bmi|body\s+mass\s+index)\s+is\s+(\d{1,2}(?:\.\d+)?)(?=$|[,.!?])/gi,
    kind: 'bmi',
    confidence: 0.94,
    sensitive: true,
    groups: [1],
  },
  {
    pattern:
      /my\s+(?:heart\s+)?(?:rate|pulse)\s+is\s+(\d{2,3})(?:\s+bpm)?(?=$|[,.!?])/gi,
    kind: 'heartRate',
    confidence: 0.93,
    sensitive: true,
    groups: [1],
  },
  {
    pattern:
      /i\s+(?:have|suffer\s+from|struggle\s+with|deal\s+with)\s+(anxiety|depression|ptsd|ocd|adhd|bipolar|panic\s+disorder|eating\s+disorder)(?=$|[,.!?])/gi,
    kind: 'mentalHealthCondition',
    confidence: 0.92,
    sensitive: true,
    groups: [1],
  },
  {
    pattern:
      /i['’]?m\s+(?:seeing|working\s+with)\s+(?:a\s+)?(therapist|psychologist|psychiatrist|counselor)(?=$|[,.!?])/gi,
    kind: 'mentalHealthProvider',
    confidence: 0.91,
    sensitive: true,
    groups: [1],
  },
  {
    pattern:
      /i\s+(?:go\s+to|attend)\s+(therapy|counseling|group\s+therapy)(?=$|[,.!?])/gi,
    kind: 'therapy',
    confidence: 0.9,
    sensitive: true,
    groups: [1],
  },
  {
    pattern:
      /my\s+(mother|father|mom|dad|parent|brother|sister|sibling|grandfather|grandmother|grandparent)\s+(?:has|had)\s+([a-z][a-z0-9&/+' -]{1,50})(?=$|[,.!?])/gi,
    kind: 'familyHistory',
    confidence: 0.88,
    sensitive: true,
    groups: [1, 2],
  },
  {
    pattern:
      /my\s+(doctor|physician|gp|primary\s+care|cardiologist|dermatologist|neurologist|oncologist|endocrinologist)\s+is\s+([a-z][a-z0-9&/+' -]{1,40})(?=$|[,.!?])/gi,
    kind: 'healthcareProvider',
    confidence: 0.91,
    sensitive: true,
    groups: [1, 2],
  },
  {
    pattern:
      /i\s+(?:see|visit)\s+(?:a\s+)?(doctor|physician|specialist|therapist|cardiologist|dermatologist)(?:\s+(?:regularly|monthly|yearly))?(?=$|[,.!?])/gi,
    kind: 'healthcareVisit',
    confidence: 0.86,
    sensitive: true,
    groups: [1],
  },
  {
    pattern:
      /i\s+have\s+(?:a\s+)?(?:doctor['’]?s?\s+)?appointment(?:\s+with\s+(?:my\s+)?([a-z][a-z0-9&/+' -]{1,40}))?(?:\s+on\s+([\w\s,:\d]+))?(?=$|[,.!?])/gi,
    kind: 'medicalAppointment',
    confidence: 0.89,
    sensitive: true,
    groups: [1, 2],
  },
];

export const HEALTH_VALIDATION = {
  medicalConditions: new Set([
    'diabetes',
    'type 1 diabetes',
    'type 2 diabetes',
    'asthma',
    'hypertension',
    'high blood pressure',
    'heart disease',
    'arthritis',
    'cancer',
    'epilepsy',
    'thyroid disorder',
    'kidney disease',
    'celiac disease',
    'migraine',
    'anemia',
    'anxiety',
    'depression',
    'ptsd',
    'ocd',
    'adhd',
    'bipolar disorder',
    'panic disorder',
    'eating disorder',
  ]),
  symptoms: new Set([
    'headache',
    'migraine',
    'dizziness',
    'nausea',
    'fever',
    'cough',
    'sore throat',
    'shortness of breath',
    'chest pain',
    'back pain',
    'fatigue',
    'weakness',
    'insomnia',
  ]),
  medications: new Set([
    'metformin',
    'insulin',
    'lisinopril',
    'ibuprofen',
    'acetaminophen',
    'aspirin',
    'amoxicillin',
    'sertraline',
    'zoloft',
    'albuterol',
    'omeprazole',
  ]),
  allergens: new Set([
    'peanuts',
    'shellfish',
    'fish',
    'eggs',
    'milk',
    'dairy',
    'gluten',
    'penicillin',
    'latex',
    'pollen',
    'dust',
    'bee stings',
  ]),
  invalidTerms: new Set([
    'time',
    'money',
    'car',
    'house',
    'job',
    'work',
    'fun',
    'happiness',
    'a break',
    'a vacation',
    'it',
    'that',
    'this',
    'something',
    'anything',
  ]),
};
