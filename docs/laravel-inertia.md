# Laravel And Inertia

This guide targets current Laravel Vue starter kits: TypeScript, Vue 3, Inertia, and
Vite. The component does not require Jetstream, Fortify, or a Laravel Turnstile
package.

## Install

```bash
npm install @delaneydev/laravel-turnstile-vue
```

Import the component in each Vue file that uses it. No Vue plugin registration,
Blade directive, or Vite alias is required.

## Configuration

```env
TURNSTILE_SITE_KEY=your-public-sitekey
TURNSTILE_SECRET_KEY=your-private-secret
```

```php
// config/services.php
'turnstile' => [
    'site_key' => env('TURNSTILE_SITE_KEY'),
    'secret_key' => env('TURNSTILE_SECRET_KEY'),
],
```

Read environment variables through configuration so `php artisan config:cache` works
in production. Never expose `secret_key` through Inertia or a `VITE_*` variable.

Share the public sitekey:

```php
// app/Http/Middleware/HandleInertiaRequests.php
public function share(Request $request): array
{
    return [
        ...parent::share($request),
        'turnstile' => [
            'siteKey' => config('services.turnstile.site_key'),
        ],
    ];
}
```

Add the type to the starter's existing Inertia module augmentation:

```ts
// resources/js/types/global.d.ts
import type { Auth } from '@/types/auth';

declare module '@inertiajs/core' {
  export interface InertiaConfig {
    sharedPageProps: {
      name: string;
      auth: Auth;
      sidebarOpen: boolean;
      turnstile: {
        siteKey: string;
      };
      [key: string]: unknown;
    };
  }
}
```

Merge `turnstile` into the existing `sharedPageProps` object; do not replace the
starter's current fields. Older applications that define a custom `SharedData` type
can add the same property there instead.

## Inertia useForm

This pattern works for login, registration, password reset, and ordinary application
forms. Reset in `onFinish`, because the backend may have consumed the token even when
other validation fails.

```vue
<script setup lang="ts">
import { useForm, usePage } from '@inertiajs/vue3';
import { ref } from 'vue';
import {
  TurnstileWidget,
  type TurnstileWidgetInstance,
} from '@delaneydev/laravel-turnstile-vue';

const page = usePage();
const turnstile = ref<TurnstileWidgetInstance | null>(null);

const form = useForm({
  email: '',
  password: '',
  remember: false,
  turnstile_token: '',
});

function submit() {
  if (form.processing || !form.turnstile_token) return;

  form.post('/login', {
    preserveScroll: true,
    onFinish: () => {
      form.reset('password');
      turnstile.value?.reset();
    },
  });
}
</script>

<template>
  <form @submit.prevent="submit">
    <!-- Email, password, remember, and validation messages -->

    <TurnstileWidget
      ref="turnstile"
      v-model="form.turnstile_token"
      :sitekey="page.props.turnstile.siteKey"
      action="login"
      size="flexible"
      :response-field="false"
    />

    <p v-if="form.errors.turnstile_token" role="alert">
      {{ form.errors.turnstile_token }}
    </p>

    <button type="submit" :disabled="form.processing || !form.turnstile_token">
      Log in
    </button>
  </form>
</template>
```

Validate `turnstile_token` before performing the protected action. See
[server-side validation](server-validation.md).

## Inertia Form Component

Cloudflare creates a hidden `cf-turnstile-response` input by default. Inertia's
DOM-based `<Form>` component submits that input directly. The local `v-model` below is
used only to disable submission until verification and to clear UI state on reset:

```vue
<script setup lang="ts">
import { Form, usePage } from '@inertiajs/vue3';
import { ref } from 'vue';
import {
  TurnstileWidget,
  type TurnstileWidgetInstance,
} from '@delaneydev/laravel-turnstile-vue';

const page = usePage();
const token = ref('');
const turnstile = ref<TurnstileWidgetInstance | null>(null);
</script>

<template>
  <Form
    action="/register"
    method="post"
    #default="{ errors, processing }"
    @finish="turnstile?.reset()"
  >
    <!-- Registration fields -->
    <TurnstileWidget
      ref="turnstile"
      v-model="token"
      :sitekey="page.props.turnstile.siteKey"
      action="register"
      size="flexible"
      response-field-name="turnstile_token"
    />
    <p v-if="errors.turnstile_token" role="alert">
      {{ errors.turnstile_token }}
    </p>
    <button type="submit" :disabled="processing || !token">Create account</button>
  </Form>
</template>
```

The `finish` event runs for successful and failed visits, so the example never leaves a
consumed token enabled after backend validation.

Do not add another named hidden input for the `v-model` token unless the backend
intentionally accepts two Turnstile fields.

## Long-Lived Forms And CSRF Expiry

A user can leave a tab open longer than the Laravel session lifetime, solve a CAPTCHA,
and then receive a `419 Page Expired` response. A generic Vue package cannot safely
renew framework sessions by itself. The robust opt-in pattern is:

1. Render Turnstile with deferred execution.
2. Refresh/confirm the session through a same-origin endpoint.
3. Start the challenge only after that preflight succeeds.
4. Submit immediately and reset after the request.

Create a GET endpoint that obtains the current session token. Do not rotate a healthy
session token on every preflight; doing so can invalidate another open tab.

```php
// routes/web.php
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/session/turnstile-preflight', function (Request $request) {
    return response()->json([
        'csrfToken' => $request->session()->token(),
    ])->header('Cache-Control', 'no-store, private');
})->middleware('throttle:30,1')
  ->name('turnstile.preflight');
```

Routes in `routes/web.php` already receive Laravel's `web` middleware group. Apply the
group explicitly only if this endpoint lives in a route file that does not.

If the protected form requires authentication, apply your normal `auth` middleware.
That lets the preflight fail or redirect before the user is challenged when their
authenticated session has expired.

Client helper:

```ts
async function refreshSession(): Promise<void> {
  const response = await fetch('/session/turnstile-preflight', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  if (
    !response.ok ||
    !response.headers.get('content-type')?.includes('application/json')
  ) {
    throw new Error('Your session could not be refreshed. Reload and try again.');
  }

  const payload: unknown = await response.json();
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('csrfToken' in payload) ||
    typeof payload.csrfToken !== 'string' ||
    payload.csrfToken === ''
  ) {
    throw new Error('Your session returned an invalid CSRF token. Reload and try again.');
  }

  const csrfToken = payload.csrfToken;
  document
    .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
    ?.setAttribute('content', csrfToken);
}
```

Laravel's XSRF cookie is refreshed on the same-origin response. Axios/Inertia normally
reads that cookie for the next request. If your app pins an `X-CSRF-TOKEN` default
header from a meta tag at bootstrap, update that header alongside the meta element.

Deferred Inertia submit:

```vue
<script setup lang="ts">
import { useForm, usePage } from '@inertiajs/vue3';
import { ref } from 'vue';
import {
  TurnstileWidget,
  type TurnstileWidgetInstance,
} from '@delaneydev/laravel-turnstile-vue';

const page = usePage();
const turnstile = ref<TurnstileWidgetInstance | null>(null);
const preparing = ref(false);
const form = useForm({ message: '', turnstile_token: '' });

async function submit() {
  if (!turnstile.value || form.processing || preparing.value) return;
  preparing.value = true;

  try {
    form.turnstile_token = await turnstile.value.challenge({ force: true });
    form.post('/contact', {
      preserveScroll: true,
      onFinish: () => turnstile.value?.reset(),
    });
  } catch {
    // Show application-appropriate session/challenge feedback.
  } finally {
    preparing.value = false;
  }
}
</script>

<template>
  <form @submit.prevent="submit">
    <!-- Fields -->
    <TurnstileWidget
      ref="turnstile"
      v-model="form.turnstile_token"
      :sitekey="page.props.turnstile.siteKey"
      execution="execute"
      appearance="execute"
      action="contact"
      :before-execute="refreshSession"
      :response-field="false"
    />
    <button type="submit" :disabled="preparing || form.processing">Send</button>
  </form>
</template>
```

This option is useful for visible deferred and invisible widgets. A widget using the
default `execution="render"` may already have challenged the user, so attaching a
preflight hook alone does not solve long-lived session expiry.

Do not automatically replay an arbitrary mutation after a 419 response. The server
may have completed a side effect before the response was interrupted. Preserve the
form, obtain a fresh challenge, and ask the user to submit again.

## Inertia SSR

The package is safe in the Laravel SSR entry:

```ts
// resources/js/ssr.ts
import { createInertiaApp } from '@inertiajs/vue3';
// Components importing TurnstileWidget can be resolved normally.
```

No conditional import, `<ClientOnly>`, hydration flag, or global `window` shim is
required. The server renders:

```html
<div data-turnstile-state="idle"></div>
```

Vue mounts the same container and the package renders Cloudflare afterward.

For version 2, use normal Vite SSR externalization. The package's packed artifact is
tested in both configurations:

```ts
// Preferred: no package-specific SSR configuration.
import vue from '@vitejs/plugin-vue';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    laravel({
      input: 'resources/js/app.ts',
      ssr: 'resources/js/ssr.ts',
      refresh: true,
    }),
    vue(),
  ],
});
```

Keep the Tailwind, Wayfinder, and other plugins already present in your starter's
configuration; only the absence of a Turnstile-specific `ssr.noExternal` entry matters.

```ts
// Add this to the same config only when the wider SSR build intentionally bundles it.
export default defineConfig({
  // Keep the starter's existing plugins here.
  ssr: {
    noExternal: ['@delaneydev/laravel-turnstile-vue'],
  },
});
```

If a version 1 production SSR process fails unless `noExternal` is present, keep that
workaround until upgrading. Version 2 publishes unambiguous ESM/CJS entries and bundled
types, so the default external path is the primary supported setup.

Run the production path locally before release:

```bash
npm run build
php artisan inertia:start-ssr
```

Test direct SSR requests, hydration, Inertia navigation to and from the form, repeated
mount/unmount, and process logs for unhandled rejections.

## Authentication Routes

Current Laravel starter kits and Fortify versions do not all register authentication
routes the same way. Apply Turnstile validation at your existing request/controller or
pipeline boundary instead of copying vendor controllers or redefining routes from an
older Jetstream guide. This keeps starter-kit updates maintainable.
