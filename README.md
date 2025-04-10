# Laravel Turnstile Vue

> A reusable, SSR-safe Cloudflare Turnstile CAPTCHA component for Vue 3 — made to pair seamlessly with Laravel via [njoguamos/laravel-turnstile](https://github.com/njoguamos/laravel-turnstile).

[![NPM](https://img.shields.io/npm/v/@delaneydev/laravel-turnstile-vue.svg)](https://www.npmjs.com/package/@delaneydev/laravel-turnstile-vue)  
[![GitHub](https://img.shields.io/github/stars/DelaneyDev/laravel-turnstile-vue.svg?style=social)](https://github.com/DelaneyDev/laravel-turnstile-vue)

---

## ✨ Features

- ✅ **SSR-safe with hydration checks**
- 🔁 Auto-reset on error/expired (optional)
- 🔒 `v-model` for reactive token binding
- 🧩 Exposes `reset()` and `execute()` methods
- 🧠 Designed to work with Laravel (Inertia, Blade, Livewire)
- ⚙️ Server-side validation handled via [`njoguamos/laravel-turnstile`](https://github.com/njoguamos/laravel-turnstile)

---

## 📦 Installation (Frontend)

```bash
npm install @delaneydev/laravel-turnstile-vue
```

---

## ⚙️ Laravel Backend Setup

This component is designed to work alongside:

> [`njoguamos/laravel-turnstile`](https://github.com/njoguamos/laravel-turnstile)

### 1. Install the Laravel Turnstile package

```bash
composer require njoguamos/laravel-turnstile
```

### 2. Publish the config

```bash
php artisan turnstile:install
```

### 3. Add your Turnstile credentials to `.env`

```env
TURNSTILE_SITE_KEY=your-site-key
TURNSTILE_SECRET_KEY=your-secret-key
TURNSTILE_ENABLED=true
# Use TURNSTILE_ENABLED=false to disable in testing/dev
```

### 4. Share the Site Key with Inertia

Update your `HandleInertiaRequests.php` middleware:

```php
public function share(Request $request): array
{
    return array_merge(parent::share($request), [
        'turnstile_site_key' => env('TURNSTILE_SITE_KEY'),
    ]);
}
```

---

## 🔐 Jetstream Integration (with Turnstile Middleware)

To apply Cloudflare Turnstile validation to Jetstream login and password routes, override the default auth routes in `routes/web.php`.

```php
// Override Jetstream login routes to include 'turnstile' middleware
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\Auth\NewPasswordController;

Route::post('/login', [AuthenticatedSessionController::class, 'store'])
    ->middleware(['guest', 'turnstile'])
    ->name('login');

Route::post('/forgot-password', [PasswordResetLinkController::class, 'store'])
    ->middleware(['guest', 'turnstile'])
    ->name('password.email');

Route::post('/reset-password', [NewPasswordController::class, 'store'])
    ->middleware(['guest', 'turnstile'])
    ->name('password.update');
```

> For a full explanation of *why* this override is needed, read this article:  
> **[Integrating Cloudflare Turnstile CAPTCHA with Laravel Jetstream](https://www.linkedin.com/pulse/integrating-cloudflare-turnstile-captcha-laravel-jetstream-wright-fbdaf?utm_source=share&utm_medium=member_ios&utm_campaign=share_via)** by **Delaney Wright**

---

## ✅ Server-Side Validation

### Option A — Using a Form Request

```php
use NjoguAmos\Turnstile\Rules\TurnstileRule;

class RegisterRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'token' => ['required', new TurnstileRule()],
        ];
    }
}
```

### Option B — Inline in a Controller

```php
use NjoguAmos\Turnstile\Rules\TurnstileRule;

public function store(Request $request)
{
    $validated = $request->validate([
        'token' => ['required', new TurnstileRule()],
    ]);
}
```

---

## 💻 Frontend Usage

### Inertia Example

```vue
<script setup lang="ts">
import { TurnstileWidget } from '@delaneydev/laravel-turnstile-vue'
const captchaToken = ref('')
</script>

<template>
  <TurnstileWidget
    v-model="captchaToken"
    :sitekey="$page.props.turnstile_site_key"
    theme="light"
  />
</template>
```

---

### Jetstream Login Example

```vue
<script setup lang="ts">
import { useForm, usePage } from '@inertiajs/vue3'
import { ref, watch } from 'vue'

const captchaToken = ref('')
const form = useForm({
  email: '',
  password: '',
  remember: false,
})

const submit = () => {
  form
    .transform(data => ({
      ...data,
      'cf-turnstile-response': captchaToken.value,
      remember: form.remember ? 'on' : '',
    }))
    .post(route('login'), {
      onFinish: () => {
        form.reset('password')
        captchaToken.value = ''
      },
      onError: () => {
        captchaToken.value = ''
      },
    })
}

const page = usePage()
watch(() => page.props.status, (status) => {
  if (
    status &&
    typeof status === 'string' &&
    status.includes("We couldn't verify if you're human")
  ) {
    window.location.reload()
  }
})
</script>

<template>
  <form @submit.prevent="submit">
    <!-- Email, password, remember fields -->
    <TurnstileWidget
      v-model="captchaToken"
      :sitekey="$page.props.turnstile_site_key"
      theme="dark"
    />
    <button type="submit">Log in</button>
  </form>
</template>
```

---

## 🔐 Props

| Prop               | Type      | Default   | Description |
|--------------------|-----------|-----------|-------------|
| `sitekey`          | `string`  | —         | Your Cloudflare Turnstile site key (required) |
| `modelValue`       | `string`  | —         | Bound CAPTCHA token via `v-model` |
| `theme`            | `string`  | `'light'` | `light` or `dark` |
| `size`             | `string`  | `'normal'`| `normal`, `compact`, or `invisible` |
| `disableAutoReload`| `boolean` | `false`   | Prevents auto-reset on error/expired |

---

## 🎯 Events

| Event              | Payload   | Description                          |
|--------------------|-----------|--------------------------------------|
| `update:modelValue`| `string`  | Token emitted after success          |
| `error`            | —         | Widget failed to load                |
| `expired`          | —         | Widget expired (auto-reset if enabled) |

---

## 🔧 Methods

```vue
<script setup>
const captcha = ref()
</script>

<template>
  <TurnstileWidget ref="captcha" sitekey="..." v-model="token" />
  <button @click="captcha?.execute()">Force Execute</button>
</template>
```

---

## 🧠 SSR Support

✅ Out-of-the-box SSR safe.

- Uses `v-if="hydrated"` to defer rendering until client
- Checks `typeof window !== 'undefined'` to prevent SSR DOM issues
- Compatible with:
  - Nuxt 3
  - Laravel SSR (Inertia)
  - Vite SSR
  - Vue CLI/Nitro setups

---

## 🧪 Usage Outside Laravel

You can use this in **any** Vue 3 project:

```vue
<TurnstileWidget
  sitekey="your-site-key"
  v-model="captchaToken"
/>
```

Just handle the token validation via your own backend logic or API if you're not using Laravel.

---

## 🔖 License

MIT © [DelaneyDev](https://github.com/DelaneyDev)
