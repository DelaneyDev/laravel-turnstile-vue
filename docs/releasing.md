# Releasing

Only maintainers with npm and GitHub release access should follow this guide.

## One-Time npm Setup

Configure a trusted publisher in the npm package settings:

- provider: GitHub Actions
- organization/user: `DelaneyDev`
- repository: `laravel-turnstile-vue`
- workflow filename: `publish.yml`
- environment: `npm`
- allowed action: `npm publish`

The repository must remain public for npm provenance. In npm publishing access, require
two-factor authentication and disallow traditional write tokens after the OIDC flow has
been proven.

Keep `repository.url` in `package.json` as the exact GitHub HTTPS repository URL. The
OIDC-only workflow must not set `registry-url` in `actions/setup-node`, which would create
token-oriented npm configuration before trusted publishing runs.

In GitHub, protect the `npm` environment with required maintainer approval and protect
release tags. The publish workflow uses a GitHub-hosted runner, Node 24, npm 11, and the
required `id-token: write` permission. It does not use `NPM_TOKEN`.

See npm's [trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).

## Release Checklist

1. Ensure CI is green on `main`.
2. Update `CHANGELOG.md` and replace `Unreleased` with the release date.
3. Set the intended version in `package.json` and `package-lock.json`.
4. Run `npm ci` and `npm run check` from a clean worktree.
5. Inspect `npm pack --dry-run` and the generated declaration/API surface.
6. Commit the release changes and create the matching signed tag, such as `v2.0.0`.
7. Publish a non-prerelease GitHub Release for that tag.
8. Approve the protected `npm` environment deployment.
9. Verify npm provenance, files, README rendering, install, and SSR from the registry.

The workflow refuses to publish when the GitHub release tag does not exactly equal
`v` plus `package.json` version. Prereleases need a deliberate separate workflow and
npm dist-tag policy; they are not published as `latest` by this workflow.

## Rollback

npm versions are immutable. Do not unpublish a widely consumed release except under
npm policy for an urgent security incident. Deprecate a broken version with an
actionable message, publish a corrected patch, and document the incident.
