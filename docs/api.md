# API Reference

## Component

```ts
import TurnstileWidget from '@delaneydev/laravel-turnstile-vue';
// The same component is also available as a named export.
```

Unknown attributes, classes, ARIA attributes, and DOM listeners are forwarded to the
stable root `<div>`. Its `data-turnstile-state` attribute reflects the current state.

## Props

| Prop                  | Type                                          | Default                                 | Purpose                                                                      |
| --------------------- | --------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------- |
| `sitekey`             | `string`                                      | required                                | Public sitekey created in Cloudflare.                                        |
| `modelValue`          | `string`                                      | `''`                                    | Token binding used by `v-model`.                                             |
| `theme`               | `'auto' \| 'light' \| 'dark'`                 | `'auto'`                                | Widget color scheme.                                                         |
| `size`                | `'normal' \| 'flexible' \| 'compact'`         | `'normal'`                              | Visible layout; flexible retains a 300px minimum width.                      |
| `action`              | `string`                                      | -                                       | Server-verifiable action, 0-32 alphanumeric, `_`, or `-` characters.         |
| `cData`               | `string`                                      | -                                       | Server-verifiable customer data, 0-255 alphanumeric, `_`, or `-` characters. |
| `language`            | `string`                                      | Cloudflare default                      | Auto language or a supported language code.                                  |
| `tabindex`            | `number`                                      | `0` in Cloudflare                       | Iframe tabindex.                                                             |
| `retry`               | `'auto' \| 'never'`                           | `'auto'`                                | Retry after a challenge error.                                               |
| `retryInterval`       | `number`                                      | `8000` in Cloudflare                    | Retry interval in ms; positive integer below `900000`.                       |
| `refreshExpired`      | `'auto' \| 'manual' \| 'never'`               | `'auto'`                                | Behavior after token expiry.                                                 |
| `refreshTimeout`      | `'auto' \| 'manual' \| 'never'`               | `'auto'`                                | Behavior after interactive timeout.                                          |
| `appearance`          | `'always' \| 'execute' \| 'interaction-only'` | `'always'`                              | When a visible widget appears.                                               |
| `execution`           | `'render' \| 'execute'`                       | `'render'`                              | Whether rendering starts the challenge.                                      |
| `responseField`       | `boolean`                                     | `true` in Cloudflare                    | Create a hidden form input.                                                  |
| `responseFieldName`   | `string`                                      | `'cf-turnstile-response'` in Cloudflare | Hidden input name.                                                           |
| `feedbackEnabled`     | `boolean`                                     | `true` in Cloudflare                    | Allow Cloudflare's feedback UI.                                              |
| `offlabelShowPrivacy` | `boolean`                                     | `true` in Cloudflare                    | Show the privacy link on an unbranded widget.                                |
| `offlabelShowHelp`    | `boolean`                                     | `true` in Cloudflare                    | Show the help link on an unbranded widget.                                   |
| `renderOnMount`       | `boolean`                                     | `true`                                  | Render after the Vue component mounts.                                       |
| `injectScript`        | `boolean`                                     | `true`                                  | Inject the Cloudflare script or wait for a consumer-managed copy.            |
| `scriptOptions`       | `TurnstileScriptOptions`                      | `{}`                                    | Script URL, ID, CSP nonce, target, timeout, and attributes.                  |
| `resetOnModelClear`   | `boolean`                                     | `true`                                  | Reset when a parent clears a previously emitted token.                       |
| `beforeExecute`       | `() => void \| PromiseLike<void>`             | -                                       | Async preflight before `execute()` and `challenge()`.                        |
| `disableAutoReload`   | `boolean`                                     | `false`                                 | Deprecated v1 alias for `retry="never"` and manual refresh settings.         |

`size="invisible"` remains a deprecated version 1 compatibility alias. New code must
use a sitekey whose Cloudflare widget mode is Invisible, plus `execution="execute"`.

Options that affect Cloudflare rendering trigger a clean remove-and-render cycle when
they change. Script options are shared and should be treated as immutable after the
first loader call.

## v-model

The token is emitted through `update:modelValue`. It is cleared on challenge errors,
expiry, interactive timeout, unsupported browsers, reset, and removal. Clearing a token
previously emitted by the component resets the widget by default, which is convenient
after server submissions.

Tokens expire after five minutes and are single-use. Reset after every request that
may have submitted the token to Siteverify, including validation failures.

## Events

| Event                | Payload                                      | Meaning                                                      |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| `update:modelValue`  | `string`                                     | Token or `''` when cleared.                                  |
| `success`            | `string`                                     | Cloudflare returned a token.                                 |
| `error`              | `TurnstileClientErrorCode \| TurnstileError` | Cloudflare callback or package lifecycle failure.            |
| `expired`            | none                                         | The current token expired.                                   |
| `timeout`            | none                                         | An interactive challenge timed out.                          |
| `before-interactive` | none                                         | Interactive mode is about to appear.                         |
| `after-interactive`  | none                                         | Interactive mode finished or was dismissed.                  |
| `unsupported`        | none                                         | Cloudflare does not support the browser.                     |
| `loaded`             | none                                         | The global Turnstile API became ready.                       |
| `widget-load`        | `string`                                     | A widget rendered; payload is its widget ID.                 |
| `reset`              | none                                         | `reset()` ran, including model-clear and stale-token resets. |
| `removed`            | none                                         | Public `remove()` ran.                                       |

The `loaded` event can occur again after an option-driven rerender. Use `widget-load`
when code needs the newly rendered widget ID.

## Exposed Methods

Type template refs as `TurnstileWidgetInstance`.

### `render(): Promise<TurnstileWidgetId>`

Loads the shared script and renders once. Concurrent calls share the same promise.
Returns an existing widget ID when already rendered.

### `execute(): Promise<void>`

Runs `beforeExecute`, renders if necessary, and calls Cloudflare `execute`.

### `challenge(options?): Promise<string>`

Returns an existing unexpired response or waits for the next response. It executes
the widget when `execution="execute"`. Concurrent calls share one in-flight challenge.

Options:

- `timeoutMs`: positive response timeout; default `30000`. Invalid values reject even
  when a cached token exists.
- `force`: reset before waiting so a consumed response is never reused.

An expired cached response and explicit expired/timeout states are reset automatically.
Removing or unmounting the component while its preflight is pending cancels the
operation and never recreates the removed widget.

### `reset(): void`

Resets the exact widget, clears `v-model`, and rejects pending response promises.

### `remove(): void`

Removes the exact widget, clears state, and rejects pending response promises. Vue
unmount performs equivalent cleanup without emitting the public `removed` event.

### Read Methods

- `getResponse()` returns the current response when available.
- `getResponsePromise(timeoutMs?)` resolves on the next response without executing.
- `isExpired()` returns `true` if the widget is absent, inaccessible, or expired.
- `getWidgetId()` returns Cloudflare's widget ID.
- `getState()` returns the package lifecycle state.

## States

`idle`, `loading`, `ready`, `interactive`, `success`, `expired`, `timeout`, `error`,
`unsupported`, or `removed`.

## Script Loader

```ts
import {
  getTurnstile,
  isTurnstileAvailable,
  loadTurnstileScript,
} from '@delaneydev/laravel-turnstile-vue';

const api = await loadTurnstileScript({
  nonce: window.__CSP_NONCE__,
  timeoutMs: 15_000,
  attributes: { 'data-cfasync': 'false' },
});
```

`loadTurnstileScript()` is browser-only and returns a typed `server` error when called
during SSR. Calls share one pending load. Existing official scripts are detected by
ID or URL; conflicting IDs are rejected instead of silently using the wrong script.

To own script injection in your app shell:

```html
<script
  id="cf-turnstile-script"
  src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
  async
  defer
></script>
```

```vue
<TurnstileWidget sitekey="..." :inject-script="false" />
```

The first shared loader call owns script element options. Use one configuration per
document.

## Errors

`TurnstileError` extends `Error` and has a stable `kind`:

`configuration`, `script-id-conflict`, `script-load`, `script-timeout`, `server`,
`unmounted`, `render`, `execute`, `challenge`, `challenge-timeout`, `expired`,
`timeout`, `unsupported`, `removed`, or `preflight`.

Unknown failures are retained as `error.cause` where supported.

## Exported Test Constants

`TURNSTILE_TEST_SITEKEYS` and `TURNSTILE_TEST_SECRET_KEYS` contain Cloudflare's
official visible, invisible, interactive, pass, and fail test credentials. They are
safe only for automated tests and never produce production-valid tokens.
