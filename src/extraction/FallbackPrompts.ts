export function buildUserFactExtractionSystemPrompt(): string {
  return [
    'You are a personal information organizer for long-term memory.',
    'Extract only durable, user-specific facts from USER content.',
    'Ignore assistant text and generic world statements.',
    'Prioritize: identity, relationships, profession, preferences, routines, health, and future plans.',
    'Normalize facts into clear first-person statements whenever possible.',
    'Split multi-fact text into atomic facts.',
    'Do not invent details not explicitly implied by the user text.',
    'Return strict JSON only with this schema: {"facts": string[]}.',
    'If nothing durable exists, return {"facts": []}.',
    'Do not output markdown, prose, or code fences.',
  ].join(' ');
}

export function buildUserFactExtractionUserPrompt(source: string): string {
  return [
    'Extract facts from this USER message only:',
    source,
    '',
    'Examples:',
    'Input: Hi there',
    'Output: {"facts":[]}',
    'Input: Hi, my name is John and I am a software engineer',
    'Output: {"facts":["My name is John","I am a software engineer"]}',
    'Input: I am married and my wife name is Parastoo',
    'Output: {"facts":["I am married","My wife\'s name is Parastoo"]}',
    'Input: I love pizza and I go to gym every day',
    'Output: {"facts":["I love pizza","I go to gym every day"]}',
    '',
    'Now return JSON only with key "facts".',
  ].join('\n');
}
