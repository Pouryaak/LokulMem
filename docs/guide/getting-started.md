# Getting Started

## Install

```bash
npm i @lokul/lokulmem
```

## Minimal integration

```ts
import { createLokulMem } from '@lokul/lokulmem';

const lokul = await createLokulMem({
  dbName: 'my-ai-app',
  extractionThreshold: 0.45,
});

const userText = "Hey, I'm Alex and I prefer tea.";

const { messages } = await lokul.augment(userText, history, {
  contextWindowTokens: 8192,
  reservedForResponseTokens: 1024,
});

const assistantText = await llm(messages);

await lokul.learn(
  { role: 'user', content: userText },
  { role: 'assistant', content: assistantText },
);
```

## First-run checklist

- Use a stable `dbName` per product/workspace.
- Run `augment()` before your LLM call.
- Run `learn()` after every completed user+assistant turn.
- Turn on debug mode while integrating to inspect memory decisions.
