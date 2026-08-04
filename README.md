# Laravel Turnstile Vue

<p align="center">
  <a href="https://delaneyindustries.co.uk">
    <img src="https://raw.githubusercontent.com/DelaneyDev/laravel-turnstile-vue/main/.github/assets/delaney-industries-logo.webp" alt="Delaney Industries Ltd" width="180">
  </a>
</p>

Free and open source software from
[Delaney Industries Ltd](https://delaneyindustries.co.uk).

[![npm version](https://img.shields.io/npm/v/@delaneydev/laravel-turnstile-vue.svg)](https://www.npmjs.com/package/@delaneydev/laravel-turnstile-vue)
[![npm downloads](https://img.shields.io/npm/dm/@delaneydev/laravel-turnstile-vue.svg)](https://www.npmjs.com/package/@delaneydev/laravel-turnstile-vue)
[![CI](https://github.com/DelaneyDev/laravel-turnstile-vue/actions/workflows/ci.yml/badge.svg)](https://github.com/DelaneyDev/laravel-turnstile-vue/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@delaneydev/laravel-turnstile-vue.svg)](LICENSE)

A typed, production-ready Cloudflare Turnstile component for Vue 3. It is safe to
import during SSR, supports visible and invisible widgets, and works with any
backend that validates Turnstile tokens.

The npm name is retained for existing users, but Laravel and Inertia are optional.

## Highlights

- Stable SSR markup with no browser globals accessed during import or server render
- Shared, race-safe script loader with CSP nonce and consumer-managed script support
- Every current Cloudflare render option and lifecycle callback
- Visible, deferred, and invisible challenge flows
- Typed `v-model`, events, errors, methods, props, and `window.turnstile`
- Single-flight `challenge()` calls and stale-token protection
- Optional async preflight before a challenge, useful for refreshing long-lived sessions
- Automatic cleanup across Vue and Inertia navigation
- ESM and CommonJS artifacts with bundled declarations
- Official Cloudflare test keys exported for deterministic integration tests

## Install

```bash
npm install @delaneydev/laravel-turnstile-vue
```

Vue is a peer dependency. Vue `3.2` and newer are supported.

Create a widget in the [Cloudflare Turnstile dashboard](https://dash.cloudflare.com/?to=/:account/turnstile),
allow your hostnames, and keep the secret key on the server. The sitekey is public.

## Basic Usage

```vue
<script setup lang="ts">
import { ref } from 'vue';
import {
  TurnstileWidget,
  type TurnstileWidgetInstance,
} from '@delaneydev/laravel-turnstile-vue';

const token = ref('');
const turnstile = ref<TurnstileWidgetInstance | null>(null);
const submitting = ref(false);

async function submit() {
  if (!token.value || submitting.value) return;
  submitting.value = true;

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnstileToken: token.value }),
    });
    if (!response.ok) throw new Error('Submission failed.');
  } finally {
    // Tokens are single-use. Reset after every request that may verify one.
    turnstile.value?.reset();
    submitting.value = false;
  }
}
</script>

<template>
  <form @submit.prevent="submit">
    <!-- Your fields -->
    <TurnstileWidget
      ref="turnstile"
      v-model="token"
      sitekey="your-public-sitekey"
      action="contact"
      size="flexible"
      :response-field="false"
    />
    <button type="submit" :disabled="!token || submitting">Send</button>
  </form>
</template>
```

Every token must be validated by your backend with Cloudflare Siteverify. Client-side
success alone is not a security control. See [server-side validation](docs/server-validation.md).

`size="flexible"` fills a container but keeps Cloudflare's 300-pixel minimum. Use
`size="compact"` when the form's content box can be narrower.

## Invisible And Deferred Challenges

Invisible mode is configured on the Cloudflare widget/sitekey. It is not a widget
`size`. Pair an invisible sitekey with deferred execution:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import {
  TurnstileWidget,
  type TurnstileWidgetInstance,
} from '@delaneydev/laravel-turnstile-vue';

const turnstile = ref<TurnstileWidgetInstance | null>(null);
const submitting = ref(false);

async function submit() {
  if (!turnstile.value || submitting.value) return;
  submitting.value = true;

  try {
    const token = await turnstile.value.challenge({
      force: true,
      timeoutMs: 30_000,
    });

    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnstileToken: token }),
    });
    if (!response.ok) throw new Error('Submission failed.');
  } finally {
    // The request may have consumed the token even when it failed.
    turnstile.value?.reset();
    submitting.value = false;
  }
}
</script>

<template>
  <TurnstileWidget
    ref="turnstile"
    sitekey="your-invisible-sitekey"
    execution="execute"
    appearance="execute"
    action="checkout"
    :response-field="false"
  />
  <button type="button" :disabled="submitting" @click="submit">Pay</button>
</template>
```

`challenge()` returns an existing valid token or waits for a fresh one. Concurrent
calls share one challenge. `force: true` resets a potentially consumed token first.

Cloudflare requires sites using Invisible Turnstile to reference its
[Turnstile Privacy Addendum](https://www.cloudflare.com/cloudflare-customer-dpa/).

## Session And CSRF Preflight

Long-lived forms can outlive a server session. With deferred execution, use
`beforeExecute` to refresh the session before asking the user to complete a challenge:

```vue
<TurnstileWidget
  ref="turnstile"
  sitekey="your-sitekey"
  execution="execute"
  appearance="execute"
  :before-execute="refreshSession"
/>
```

The hook runs before `execute()` and `challenge()`. If it rejects, no challenge starts
and the component emits a typed `preflight` error. This avoids earning a short-lived,
single-use token only to discover that the request will fail with an expired CSRF
session. The package does not make framework-specific network requests on its own.

See the complete [Laravel and Inertia session-refresh pattern](docs/laravel-inertia.md#long-lived-forms-and-csrf-expiry).

## SSR And Vite

The package can be imported and rendered on the server. It emits a stable empty
container and loads Cloudflare only after Vue mounts in the browser.

Vite SSR should use its normal dependency externalization in version 2:

```ts
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  // No Turnstile-specific ssr.noExternal entry is required.
});
```

Both default externalization and a bundled `ssr.noExternal` build are tested against
the packed npm artifact. The following was a version 1 workaround and can be removed
after upgrading:

```ts
ssr: {
  noExternal: ['@delaneydev/laravel-turnstile-vue'],
}
```

See [Laravel/Inertia SSR](docs/laravel-inertia.md#inertia-ssr) and the
[version 2 migration guide](docs/migration-v2.md).

## API At A Glance

The component supports all current Cloudflare options, including:

`theme`, `language`, `tabindex`, `size`, `action`, `cData`, `retry`,
`retryInterval`, `refreshExpired`, `refreshTimeout`, `appearance`, `execution`,
`responseField`, `responseFieldName`, `feedbackEnabled`, `offlabelShowPrivacy`, and
`offlabelShowHelp`.

Package behavior is controlled with `renderOnMount`, `injectScript`, `scriptOptions`,
`resetOnModelClear`, and `beforeExecute`.

Imperative methods:

```ts
render(): Promise<string>
execute(): Promise<void>
challenge(options?): Promise<string>
reset(): void
remove(): void
getResponse(): string | undefined
getResponsePromise(timeoutMs?): Promise<string>
isExpired(): boolean
getWidgetId(): string | undefined
getState(): TurnstileWidgetState
```

Events include `success`, `error`, `expired`, `timeout`, `before-interactive`,
`after-interactive`, `unsupported`, `loaded`, `widget-load`, `reset`, and `removed`.

See the [complete API reference](docs/api.md).

## Framework Guides

- [Laravel and Inertia, including TypeScript starters, forms, SSR, and CSRF expiry](docs/laravel-inertia.md)
- [Framework-agnostic server-side validation](docs/server-validation.md)
- [Testing with Cloudflare's official keys](docs/testing.md)
- [Troubleshooting production and integration failures](docs/troubleshooting.md)
- [Migrating from version 1](docs/migration-v2.md)
- [Version 1.0.4 documentation (archived)](https://github.com/DelaneyDev/laravel-turnstile-vue/blob/4c83df916d25666508b27fc958b34f6da2ab7eff/README.md)

## Browser Support

Turnstile's supported browsers and environments are controlled by Cloudflare. The
component reports Cloudflare's `unsupported-callback` as an `unsupported` event and
state. Do not block form recovery behind a widget that cannot load; provide a support
or fallback path appropriate to your application.

## Security

Report vulnerabilities through GitHub's private security advisory flow. Do not put a
Turnstile secret key in Vue props, Vite `VITE_*` variables, browser code, logs, or the
repository. See [SECURITY.md](SECURITY.md).

## License

This is a free and open source product from
[Delaney Industries Ltd](https://delaneyindustries.co.uk), released under the
[MIT License](LICENSE). Contributions are welcome through GitHub issues and pull
requests.

This project is independently developed and is not affiliated with, endorsed by,
or sponsored by Cloudflare.
