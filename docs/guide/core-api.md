# Core API

LokulMem centers around three methods.

## `augment(userMessage, history, options)`

Retrieves relevant memories and returns a new `messages[]` payload to send to your model.

```ts
const { messages, debug } = await lokul.augment(userText, history, {
  contextWindowTokens: 8192,
  reservedForResponseTokens: 1024,
  debug: true,
});
```

Use this when preparing model input.

## `learn(userTurn, assistantTurn, options?)`

Extracts candidate memories from a turn, runs policy/risk checks, and persists accepted facts.

```ts
const result = await lokul.learn(
  { role: 'user', content: userText },
  { role: 'assistant', content: assistantText },
  { verbose: true },
);
```

Useful return fields:

- `result.extracted`
- `result.persisted`
- `result.diagnostics`

## `manage()`

Returns management methods for list/search/edit/pin/export/import/clear.

```ts
const manager = lokul.manage();
const active = await manager.list({ status: 'active' });
const exported = await manager.export('json');
```

## Event surface

LokulMem can emit memory lifecycle events for UI updates and instrumentation. Check the TypeScript exports for available event payload types.
