# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [2.0.0] - 2026-08-04

### Added

- Complete typed Cloudflare render options and lifecycle callbacks.
- Typed imperative API including `challenge()`, `getResponsePromise()`, and state access.
- Single-flight challenges, stale-token handling, and async execution preflight.
- Shared CSP-aware script loader with existing-script detection, timeouts, and retry.
- Official Cloudflare test sitekey and secret-key constants.
- Unit, SSR, package-boundary, Vite consumer, and browser test infrastructure.
- Framework-agnostic, Laravel/Inertia, SSR, CSRF, testing, and troubleshooting guides.

### Changed

- Rebuilt the component around stable SSR markup and explicit client-side rendering.
- Moved Vue from a bundled dependency to a peer dependency.
- Published explicit ESM/CommonJS exports with matching bundled declarations.
- Changed the default theme from `light` to `auto`.
- Reset emitted tokens consistently across expiry, reset, removal, and form lifecycles.
- Retained the existing npm package name and registry URL.

### Deprecated

- `size="invisible"`; use a Cloudflare Invisible sitekey with deferred execution.
- `disableAutoReload`; use `retry`, `refreshExpired`, and `refreshTimeout`.

### Fixed

- SSR imports and production Node execution no longer depend on browser globals.
- Concurrent component mounts no longer race or inject duplicate API scripts.
- Existing scripts no longer resolve before the Turnstile API is actually ready.
- Unmount during script loading no longer renders into a removed component.
- Exact widget IDs are used for reset and removal in multi-widget applications.
- Pending token promises now reject on errors, reset, removal, timeout, and unsupported
  browsers instead of leaking.
- Public removal now cancels pending preflight work without recreating a widget.
- Synchronous provider callbacks retain their terminal state during rendering.

## [1.0.4] - 2025-05-30

- Previous stable version 1 release.

[2.0.0]: https://github.com/DelaneyDev/laravel-turnstile-vue/compare/4c83df916d25666508b27fc958b34f6da2ab7eff...v2.0.0
[1.0.4]: https://www.npmjs.com/package/@delaneydev/laravel-turnstile-vue/v/1.0.4
