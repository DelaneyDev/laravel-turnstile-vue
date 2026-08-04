export const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script';
export const TURNSTILE_SCRIPT_URL =
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
export const TURNSTILE_SCRIPT_TIMEOUT = 30_000;

export const TURNSTILE_TEST_SITEKEYS = Object.freeze({
    visibleAlwaysPasses: '1x00000000000000000000AA',
    visibleAlwaysFails: '2x00000000000000000000AB',
    invisibleAlwaysPasses: '1x00000000000000000000BB',
    invisibleAlwaysFails: '2x00000000000000000000BB',
    visibleForcesInteractive: '3x00000000000000000000FF',
});

export const TURNSTILE_TEST_SECRET_KEYS = Object.freeze({
    alwaysPasses: '1x0000000000000000000000000000000AA',
    alwaysFails: '2x0000000000000000000000000000000AA',
    tokenAlreadySpent: '3x0000000000000000000000000000000AA',
});
