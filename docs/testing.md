# Testing

Cloudflare provides deterministic sitekeys and secret keys for automated tests. Test
credentials work on any hostname and cannot be used for production verification.

The package exports them to prevent copied-key mistakes:

```ts
import {
  TURNSTILE_TEST_SECRET_KEYS,
  TURNSTILE_TEST_SITEKEYS,
} from '@delaneydev/laravel-turnstile-vue';
```

## Sitekeys

| Constant                   | Cloudflare behavior                             |
| -------------------------- | ----------------------------------------------- |
| `visibleAlwaysPasses`      | Visible widget, always passes.                  |
| `visibleAlwaysFails`       | Visible widget, always fails.                   |
| `invisibleAlwaysPasses`    | Invisible widget, always passes.                |
| `invisibleAlwaysFails`     | Invisible widget, always fails.                 |
| `visibleForcesInteractive` | Visible widget forces an interactive challenge. |

## Secret Keys

| Constant            | Cloudflare behavior                                   |
| ------------------- | ----------------------------------------------------- |
| `alwaysPasses`      | Siteverify always returns success.                    |
| `alwaysFails`       | Siteverify always returns failure.                    |
| `tokenAlreadySpent` | Siteverify returns a duplicate/expired style failure. |

Use a matching test sitekey and test secret. A production secret rejects dummy tokens,
and a test secret must never be selected in production.

Official values and behavior are documented in Cloudflare's
[testing guide](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).

## Environment Separation

Prefer explicit environment configuration:

```env
# .env.testing; never production
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

Fail startup when production accidentally receives a known test key. Do not disable
all server validation in tests; exercise success, failure, timeout/network handling,
action mismatch, duplicate token, and missing token paths.

## Component Tests

For unit tests, mock `window.turnstile` or the exported loader and invoke the captured
callbacks. Assert application behavior for:

- success followed by request completion and reset
- expiry before submit
- Cloudflare error callbacks
- preflight rejection
- duplicate clicks while a challenge is pending
- component unmount during script loading
- server validation errors that preserve form input

Use Cloudflare test keys in browser tests where loading the real iframe adds value.
Unit tests should remain deterministic and should not depend on a third-party network.

## Playwright

Cloudflare's test keys are designed to work with browser automation. Wait for your own
application state (`success`, enabled submit, or emitted token), not private iframe DOM
or Cloudflare implementation details.

Example assertion:

```ts
await expect(page.locator('[data-turnstile-state="success"]')).toBeVisible();
await expect(page.getByRole('button', { name: 'Submit' })).toBeEnabled();
```

Keep a separate live integration job if your primary CI environment blocks Cloudflare.
Network-dependent tests should not replace mocked lifecycle coverage.

This repository's manual live job runs the same visible, invisible, console, and
320-pixel layout assertions in Chromium, Firefox, and WebKit.

## SSR Tests

Test the built package, not only source files:

1. Pack it with `npm pack`.
2. Install the tarball in an empty consumer project.
3. import and `require` it.
4. run Vue `renderToString`.
5. build and execute Vite SSR with default externalization.
6. repeat with `ssr.noExternal`.

This repository's package-consumer test follows that matrix and also checks the
tarball allowlist so local agent, test, and source files are not published.
