# Configuration

## Core options

```ts
const lokul = await createLokulMem({
  dbName: 'my-chat-app',
  extractionThreshold: 0.45,
  contextWindowTokens: 8192,
  reservedForResponseTokens: 1024,
  workerType: 'auto',
  onnxPaths: '/lokulmem/onnx/',
  localModelBaseUrl: '/models/',
});
```

## Practical guidance

- **`dbName`**: use one stable name per environment.
- **`extractionThreshold`**: raise for stricter writes; lower for higher recall.
- **`contextWindowTokens`**: match your model context capacity.
- **`reservedForResponseTokens`**: keep enough room for answer generation.
- **`workerType`**: keep `auto` unless you have runtime constraints.
- **`localModelBaseUrl`**: use for offline/air-gapped deployment.

## Air-gapped mode

When `localModelBaseUrl` is set, make sure model assets are present and served correctly. Missing assets should fail loudly with actionable errors.
