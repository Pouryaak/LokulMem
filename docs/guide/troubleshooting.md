# Troubleshooting

## Worker fails to load

- Set `workerUrl` explicitly.
- Verify worker artifacts exist in your build output.

## ONNX / WASM asset errors

- Set `onnxPaths` to valid served assets.
- Confirm WASM and JS runtime files are reachable.

## Air-gapped model not found

- Check `localModelBaseUrl` path correctness.
- Confirm model folder layout and file permissions.

## Unexpected memory writes

- Run with verbose diagnostics in `learn()`.
- Validate threshold configuration and policy actions.
- Run `npm run eval:memory:C` to check for known regressions.

## CI failing after dependency updates

- Check whether a major version update changed config schema (for tooling like Biome/Vitest/Vite).
- Use grouped Dependabot PRs and merge only green checks.
