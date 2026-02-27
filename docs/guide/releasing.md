# Releasing to npm

LokulMem uses Changesets for safe, predictable versioning and release automation.

## Release model

1. Contributor adds a changeset in their PR.
2. After merge to `main`, the Release workflow opens/updates a "release package(s)" PR.
3. Merging that PR bumps versions and updates changelog files.
4. Workflow publishes to npm after quality gates pass.

## Contributor flow

```bash
npm run changeset
```

Choose one bump type:

- `patch`: bug fix, no API break
- `minor`: backward-compatible feature
- `major`: breaking change

## Scripts

- `npm run changeset` - create release note file
- `npm run version-packages` - apply version bumps from changesets
- `npm run release` - publish packages with Changesets

## Manual setup required once

1. npm account access
   - ensure you are maintainer of `@lokul/lokulmem` package name
2. npm trusted publishing (recommended)
   - in npm package settings, connect GitHub repository `Pouryaak/LokulMem`
   - allow GitHub Actions trusted publishing
3. GitHub Actions permission
   - keep workflow `id-token: write` enabled
4. Optional fallback token
   - add `NPM_TOKEN` in GitHub repo secrets (only if not using trusted publishing)

## Safety gates before publish

Release workflow runs:

- `npm run ci`
- `npm run eval:memory:C`
- `npm run verify:package`

If any step fails, publish is blocked.
