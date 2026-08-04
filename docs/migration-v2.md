# Migrating To Version 2

Version 2 keeps the npm package name and the default/named `TurnstileWidget` exports.
It modernizes the package boundary and aligns behavior with Cloudflare's current API.

Applications remaining on version 1 can use the
[archived version 1.0.4 documentation](https://github.com/DelaneyDev/laravel-turnstile-vue/blob/4c83df916d25666508b27fc958b34f6da2ab7eff/README.md)
and the [version 1.0.4 npm page](https://www.npmjs.com/package/@delaneydev/laravel-turnstile-vue/v/1.0.4).

## Upgrade

```bash
npm install @delaneydev/laravel-turnstile-vue@^2
```

Clear any SSR build cache and rebuild both client and server bundles.

## Package And SSR

- Vue is now only a peer dependency, preventing duplicate Vue runtimes.
- ESM and CommonJS have explicit export conditions and matching bundled declarations.
- Importing and server-rendering the component does not access browser globals.
- Vite's default SSR externalization is the preferred path.
- A bundled `ssr.noExternal` path remains supported and tested.

Remove the version 1 workaround after confirming production SSR:

```diff
- ssr: {
-   noExternal: ['@delaneydev/laravel-turnstile-vue'],
- },
```

## Theme Default

The default theme is now `auto`, matching the user's color-scheme preference. Pin the
old appearance explicitly if required:

```vue
<TurnstileWidget theme="light" />
```

## Invisible Mode

`invisible` is not an official Cloudflare size. The v1 value remains as a deprecated
compatibility alias, but new code should use an Invisible sitekey:

```diff
 <TurnstileWidget
-  size="invisible"
+  sitekey="your-invisible-sitekey"
+  execution="execute"
+  appearance="execute"
 />
```

Cloudflare widget mode is selected in the dashboard or API when the sitekey is created.

## Retry And Refresh

`disableAutoReload` is deprecated. Replace it with explicit Cloudflare behavior:

```diff
 <TurnstileWidget
-  :disable-auto-reload="true"
+  retry="never"
+  refresh-expired="manual"
+  refresh-timeout="manual"
 />
```

The compatibility prop remains in v2 and maps to `never` only when a newer explicit
prop is absent.

## Methods

`render()` and `execute()` are asynchronous. Await them to receive loader, render,
preflight, and execution failures:

```ts
await turnstile.value?.execute();
```

Prefer `challenge()` when a submit flow needs a token:

```ts
const token = await turnstile.value!.challenge({ force: true });
```

`challenge()` deduplicates concurrent calls, returns an existing valid token, refreshes
stale tokens, and has a bounded timeout.

## Events And Errors

The `error` event can carry either a Cloudflare client error code or a
`TurnstileError`. Package errors expose `kind` and retain an underlying `cause`.

All current Cloudflare lifecycle callbacks now have Vue events. If a wrapper forwards
events, update its emits declaration accordingly.

## Form Lifecycle

Version 2 clears `v-model` on challenge errors, expiry, timeout, unsupported browsers,
reset, and removal. When a parent clears a token that the component emitted, the widget
resets by default. Set `resetOnModelClear=false` only when the application owns the
lifecycle itself.

Reset after every request that may have sent a token to Siteverify. Do not reuse a
token after a server validation error.

## Removed Documentation Assumptions

Laravel, Jetstream, and the `njoguamos/laravel-turnstile` package are no longer implied
requirements. Existing backends can continue using them, but frontend behavior and the
core docs are backend-framework agnostic.

Current Laravel TypeScript starter, Inertia `<Form>`, `useForm`, SSR, and long-lived
CSRF examples live in the [Laravel/Inertia guide](laravel-inertia.md).
