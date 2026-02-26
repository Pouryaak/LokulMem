export function buildUserFactExtractionSystemPrompt(): string {
  return [
    'You are a memory fact extraction system.',
    'Extract concise user facts from USER content only.',
    'Do not include assistant or system information.',
    'Return strict JSON with shape: {"facts": string[]}.',
    'If no relevant user facts exist, return {"facts": []}.',
    'Keep facts atomic and specific.',
    'Do not include explanations or markdown.',
  ].join(' ');
}

export function buildUserFactExtractionUserPrompt(source: string): string {
  return [
    'Input conversation snippet (user-only extraction target):',
    '```',
    source,
    '```',
    'Return JSON only: {"facts": [ ... ]}',
  ].join('\n');
}
