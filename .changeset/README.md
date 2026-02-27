# Changesets

This folder stores release notes for versioning.

For any user-facing change, add a changeset file:

```bash
npm run changeset
```

Then commit the generated markdown file.

On `main`, GitHub Actions opens/updates a "Version Packages" PR that bumps versions and updates changelogs.
