# Troubleshooting

## Widget Never Appears

Check these in order:

1. The component mounted in the browser and has a non-empty `sitekey`.
2. The current hostname is allowed by the Cloudflare widget.
3. `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` loads.
4. Content Security Policy and privacy/ad-blocking software allow Cloudflare.
5. The widget's `appearance` and `execution` match the intended flow.

`appearance="execute"` intentionally hides a visible widget until `execute()` or
`challenge()` is called. An Invisible sitekey has no visible widget.

Listen for `error` and inspect `data-turnstile-state`. Package lifecycle errors are
`TurnstileError` objects with a stable `kind`; Cloudflare callback errors are codes.

Cloudflare's `flexible` size fills its container but retains a 300 CSS pixel minimum.
Ensure the widget's content box is at least 300 pixels wide. Use `compact` for narrower
mobile layouts, sidebars, and dialogs; it is 150 pixels wide and taller than normal.

## Content Security Policy

Follow Cloudflare's current [CSP guidance](https://developers.cloudflare.com/turnstile/reference/content-security-policy/).
Turnstile commonly needs its challenge origin in `script-src` and `frame-src`.

For nonce-based script policies:

```vue
<TurnstileWidget sitekey="..." :script-options="{ nonce: cspNonce }" />
```

The nonce permits the API script element; it does not replace required frame/network
directives. If Rocket Loader is present, pass the documented `data-cfasync` attribute:

```ts
scriptOptions: {
  attributes: { 'data-cfasync': 'false' },
}
```

## Script Loaded More Than Once

Do not add an implicit-render script (`api.js` without `render=explicit`) alongside the
component loader. Either let the package own one explicit script or add one explicit
script with the default ID `cf-turnstile-script` and set `injectScript=false`.

The loader reuses an official script by ID or URL and rejects a conflicting element ID.
The first concurrent call owns nonce, URL, target, and custom attributes.

## SSR Process Fails

Version 2 is safe to import with no browser globals and is tested from the packed
artifact. Confirm the SSR process is resolving version 2 rather than a stale lockfile
or cached version 1 artifact:

```bash
npm ls @delaneydev/laravel-turnstile-vue
```

With Vite, default externalization is preferred. A version 1 app may need:

```ts
ssr: {
  noExternal: ['@delaneydev/laravel-turnstile-vue'],
}
```

Version 2 also supports that bundled path. If only one path fails, retain the complete
Node stack trace and generated SSR entry when filing an issue.

## Hydration Warning

Do not put browser-only conditions around the root widget unless the server and first
client render produce the same tree. The component already renders a stable empty
`<div data-turnstile-state="idle">` during SSR and starts Cloudflare after mount.

For conditional forms, ensure the condition comes from SSR page props or another value
that is identical during hydration.

## Token Is Missing On The Server

Choose one submission strategy:

- Bind with `v-model` and put that value in your request, usually with
  `responseField=false`.
- Keep Cloudflare's hidden field and submit a native/DOM-based form. Its default name
  is `cf-turnstile-response`; customize it with `responseFieldName`.

Inspect the actual request payload, not only Vue state. Deferred widgets do not return
a token until `execute()` or `challenge()` runs.

## Token Is Expired Or Already Used

Tokens expire after 300 seconds and Siteverify accepts each token once. Reset after
every request that may verify it:

```ts
onFinish: () => turnstile.value?.reset();
```

Use `challenge({ force: true })` for sensitive deferred submissions. The component
also detects an expired cached response and refreshes it before waiting.

Do not retry a business request with the same token.

## Form Returns Laravel 419

The browser session/CSRF token expired, independently of Turnstile. Resetting only the
widget cannot repair it. Use the deferred
[session preflight pattern](laravel-inertia.md#long-lived-forms-and-csrf-expiry) so the
session is checked before a challenge starts.

Preserve the user's fields. Do not blindly replay non-idempotent requests after 419.

## Invisible Mode Is Visible Or Does Nothing

Invisible mode belongs to the sitekey configured in Cloudflare. `size="invisible"`
was never an official Cloudflare size and is only retained as a compatibility alias.

Use:

```vue
<TurnstileWidget
  sitekey="your-invisible-sitekey"
  execution="execute"
  appearance="execute"
/>
```

Then call `challenge()` from a user action. Do not call it automatically on page load;
that wastes token lifetime and can create poor challenge behavior.

## Expected Console 401

Cloudflare may probe browser Private Access Token support and log a 401 for that probe.
This can be expected when the widget still succeeds. Diagnose against component state,
callbacks, and the Siteverify result rather than treating every challenge-origin 401
as a failed widget.

## Common Cloudflare Error Codes

Cloudflare owns the code taxonomy. Common categories include invalid sitekeys,
hostname restrictions, invalid `action`/`cData`, generic client execution failures,
and challenge platform failures. Codes beginning with `300` or `600` are often generic
and may be retryable.

Use Cloudflare's current [client error documentation](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/)
instead of hard-coding a permanent message for every numeric value. Show users a
recoverable message, reset or allow Cloudflare retry behavior, and log the code without
logging tokens.

## Domain Errors In Development

Add `localhost` to the widget's allowed hostnames or use Cloudflare's official test
keys. Test keys work on any hostname. Production keys and production secrets should be
tested together only on authorized hostnames.

## Inertia Navigation

The component removes its exact Cloudflare widget during unmount. Avoid persisting a
component ref across pages. When Inertia preserves a page component intentionally,
reset after every submitted token and when the logical form identity changes.

Changing a Cloudflare render prop removes and rerenders the widget. Batch related prop
changes in one Vue update where possible.

## Filing A Reproduction

Include:

- package, Vue, Vite, Inertia, Laravel, and Node versions
- browser and operating system
- client-only or SSR mode
- default externalization or `ssr.noExternal`
- widget mode, appearance, execution, and size (never the secret)
- component state, package error kind, and Cloudflare error code
- minimal component and Vite configuration

Never include a production secret or token.
