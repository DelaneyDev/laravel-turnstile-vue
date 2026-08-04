# Server-Side Validation

Turnstile is only secure when every token is sent to Cloudflare Siteverify from a
trusted backend. The browser must never receive your secret key.

## Validation Contract

Send a `POST` request to:

```text
https://challenges.cloudflare.com/turnstile/v0/siteverify
```

Fields:

| Field             | Required | Meaning                                              |
| ----------------- | -------- | ---------------------------------------------------- |
| `secret`          | yes      | Private widget secret.                               |
| `response`        | yes      | Token returned to the browser.                       |
| `remoteip`        | no       | User IP address.                                     |
| `idempotency_key` | no       | UUID making a retry of this verification idempotent. |

Cloudflare accepts form-encoded or JSON bodies. Treat network errors, malformed
responses, `success: false`, and policy mismatches as failed validation.

After `success: true`, verify the response belongs to this request:

- `hostname` matches an expected production hostname.
- `action` matches the action supplied by the component.
- `cdata` matches server-issued context when you use it.
- `challenge_ts` is reasonable for the flow.

Tokens expire after 300 seconds and can be validated once. Never cache a successful
decision for a different request and never retry a business mutation merely because
Siteverify or CSRF handling failed.

See Cloudflare's [Siteverify documentation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## TypeScript Example

This example uses only platform APIs and works in Node servers, serverless handlers,
and frameworks that expose standard `fetch`:

```ts
interface SiteverifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
  'error-codes'?: string[];
}

interface VerifyOptions {
  token: string;
  remoteIp?: string;
  expectedHostname: string;
  expectedAction: string;
}

export async function verifyTurnstile({
  token,
  remoteIp,
  expectedHostname,
  expectedAction,
}: VerifyOptions): Promise<SiteverifyResponse> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new Error('TURNSTILE_SECRET_KEY is not configured.');

  const body = new URLSearchParams({
    secret,
    response: token,
    idempotency_key: crypto.randomUUID(),
  });
  if (remoteIp) body.set('remoteip', remoteIp);

  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    throw new Error(`Siteverify returned HTTP ${response.status}.`);
  }

  const result = (await response.json()) as SiteverifyResponse;
  if (
    !result.success ||
    result.hostname !== expectedHostname ||
    result.action !== expectedAction
  ) {
    throw new Error('Turnstile validation failed.');
  }

  return result;
}
```

Choose a timeout supported by your runtime. If `AbortSignal.timeout` is unavailable,
use an `AbortController` timer.

## Laravel Example Without A Third-Party Package

Configuration:

```php
// config/services.php
'turnstile' => [
    'site_key' => env('TURNSTILE_SITE_KEY'),
    'secret_key' => env('TURNSTILE_SECRET_KEY'),
],
```

Validation service:

```php
<?php

namespace App\Support;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use LogicException;
use Throwable;

final class VerifyTurnstile
{
    /** @return array<string, mixed> */
    public function __invoke(
        string $token,
        ?string $ip,
        string $expectedHostname,
        string $expectedAction,
    ): array {
        $secret = config('services.turnstile.secret_key');
        if (! is_string($secret) || trim($secret) === '') {
            throw new LogicException('Turnstile is not configured.');
        }

        $payload = [
            'secret' => $secret,
            'response' => $token,
            'idempotency_key' => (string) Str::uuid(),
        ];

        if ($ip !== null && $ip !== '') {
            $payload['remoteip'] = $ip;
        }

        try {
            $httpResponse = Http::asForm()
                ->connectTimeout(3)
                ->timeout(10)
                ->retry(
                    2,
                    200,
                    fn (Throwable $exception) => $exception instanceof ConnectionException,
                    throw: false,
                )
                ->post('https://challenges.cloudflare.com/turnstile/v0/siteverify', $payload);
        } catch (ConnectionException) {
            Log::warning('Turnstile Siteverify connection failed.');
            $this->fail();
        }

        if (! $httpResponse->successful()) {
            Log::warning('Turnstile Siteverify returned an HTTP failure.', [
                'status' => $httpResponse->status(),
            ]);
            $this->fail();
        }

        $response = $httpResponse->json();

        if (
            ! is_array($response)
            || ($response['success'] ?? false) !== true
            || ($response['hostname'] ?? null) !== $expectedHostname
            || ($response['action'] ?? null) !== $expectedAction
        ) {
            $this->fail();
        }

        return $response;
    }

    private function fail(): never
    {
        throw ValidationException::withMessages([
            'turnstile_token' => 'Human verification failed. Please try again.',
        ]);
    }
}
```

Controller usage:

```php
$validated = $request->validate([
    'turnstile_token' => ['required', 'string', 'max:2048'],
]);

app(VerifyTurnstile::class)(
    $validated['turnstile_token'],
    $request->ip(),
    (string) parse_url(config('app.url'), PHP_URL_HOST),
    'register',
);
```

Adapt failure handling to your application. A validation rule can return a normal
field error instead of aborting. If you use a Laravel Turnstile package, confirm that
it validates server-side, supports the current Siteverify response, has bounded HTTP
timeouts, and lets you enforce `action` and hostname policy.

## Failure Handling

Return a normal validation response and let the client reset the widget. Do not expose
your secret, raw upstream diagnostics, or security policy details to an attacker.

Log enough structured context to diagnose failures without logging tokens:

- application request ID
- expected action
- normalized Cloudflare error codes
- upstream status/timeout category
- hostname mismatch category

Turnstile tokens are credentials. Avoid request-body logging on routes that receive
them.
