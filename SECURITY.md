# Security Policy

## Supported Versions

Security fixes are provided for the latest version 2 release. Version 1 users should
upgrade before reporting behavior already addressed by version 2.

## Reporting A Vulnerability

Use the repository's private **Security > Report a vulnerability** flow on GitHub.
Do not disclose a vulnerability in a public issue before a fix is available.

Include affected versions, impact, a minimal reproduction, and any suggested
mitigation. Remove production Turnstile secrets, tokens, session cookies, personal
data, and unrelated credentials from the report.

## Integration Responsibilities

This package handles the Vue/browser lifecycle. Applications must still:

- keep the Turnstile secret on a trusted server
- validate every token with Cloudflare Siteverify
- enforce expected hostname, action, and customer-data policy
- protect application sessions and CSRF boundaries
- avoid logging or replaying tokens
- keep dependencies and server-side verification code patched

See [server-side validation](docs/server-validation.md).
