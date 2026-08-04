# Contributing

## Development

Use Node `20.19` or newer.

```bash
npm ci
npm run check
```

`npm run check` runs linting, formatting, TypeScript, the dependency audit, coverage,
the production build, tarball consumer tests, and package metadata analyzers.

For the browser playground:

```bash
npm run dev
npm run test:e2e
```

## Pull Requests

- Add focused tests for behavioral changes and regressions.
- Keep public types, README examples, and API docs aligned.
- Test both SSR import and browser mount paths for lifecycle changes.
- Do not commit generated `dist`, coverage, browser reports, local MCP/Codex files, or
  production credentials.
- Do not weaken coverage thresholds to land a change.

Changes to widget options should be checked against Cloudflare's current documentation.
Changes to packaging must pass both Publint and Are the Types Wrong.

Maintainers should follow [the release guide](docs/releasing.md); local manual publishes
are not the normal release path.
