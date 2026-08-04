import {
    TURNSTILE_SCRIPT_ID,
    TURNSTILE_SCRIPT_TIMEOUT,
    TURNSTILE_SCRIPT_URL,
} from './constants';
import { TurnstileError } from './errors';
import type { LoadTurnstileOptions, Turnstile, TurnstileScriptOptions } from './types';

interface ActiveLoad {
    promise: Promise<Turnstile>;
    script?: HTMLScriptElement;
    status: 'pending' | 'resolved';
}

let activeLoad: ActiveLoad | undefined;

function isTurnstileApi(value: unknown): value is Turnstile {
    if (!value || typeof value !== 'object') {
        return false;
    }

    try {
        return [
            'ready',
            'render',
            'execute',
            'reset',
            'remove',
            'getResponse',
            'isExpired',
        ].every((method) => typeof Reflect.get(value, method) === 'function');
    } catch {
        return false;
    }
}

export function getTurnstile(): Turnstile | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }

    try {
        const turnstile = window.turnstile;
        return isTurnstileApi(turnstile) ? turnstile : undefined;
    } catch {
        return undefined;
    }
}

export function isTurnstileAvailable(): boolean {
    return getTurnstile() !== undefined;
}

function validateTimeout(timeoutMs: number): void {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new TurnstileError(
            'configuration',
            '`scriptOptions.timeoutMs` must be a positive finite number.',
        );
    }
}

function normalizeUrl(src: string): string {
    try {
        if (src.trim() === '') {
            throw new TypeError('URL is empty.');
        }

        const url = new URL(src, document.baseURI);

        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            throw new TypeError('URL protocol is not HTTP or HTTPS.');
        }

        return url.href;
    } catch (error: unknown) {
        throw new TurnstileError(
            'configuration',
            '`scriptOptions.src` must be a valid URL.',
            error,
        );
    }
}

function isOfficialTurnstileUrl(src: string): boolean {
    try {
        const url = new URL(src, document.baseURI);

        return (
            url.origin === 'https://challenges.cloudflare.com' &&
            url.pathname === '/turnstile/v0/api.js'
        );
    } catch {
        return false;
    }
}

function findExistingScript(src: string, id: string): HTMLScriptElement | undefined {
    const normalizedSrc = normalizeUrl(src);
    const byId = document.getElementById(id);

    if (byId && !(byId instanceof HTMLScriptElement)) {
        throw new TurnstileError(
            'script-id-conflict',
            `An element with id "${id}" already exists and is not a script.`,
        );
    }

    if (byId instanceof HTMLScriptElement) {
        if (
            byId.src === normalizedSrc ||
            (isOfficialTurnstileUrl(src) && isOfficialTurnstileUrl(byId.src))
        ) {
            return byId;
        }

        throw new TurnstileError(
            'script-id-conflict',
            `A different script already uses the id "${id}".`,
        );
    }

    return Array.from(document.scripts).find(
        (script) =>
            script.src === normalizedSrc ||
            (isOfficialTurnstileUrl(src) && isOfficialTurnstileUrl(script.src)),
    );
}

function waitForTurnstile(
    script: HTMLScriptElement | undefined,
    timeoutMs: number,
): Promise<Turnstile> {
    return new Promise((resolve, reject) => {
        let settled = false;

        const finish = (callback: () => void): void => {
            if (settled) {
                return;
            }

            settled = true;
            window.clearInterval(pollTimer);
            window.clearTimeout(timeoutTimer);
            script?.removeEventListener('error', onScriptError);
            callback();
        };

        const onScriptError = (): void => {
            finish(() =>
                reject(
                    new TurnstileError(
                        'script-load',
                        'Cloudflare Turnstile failed to load. Check the network and Content Security Policy.',
                    ),
                ),
            );
        };

        const check = (): void => {
            const turnstile = getTurnstile();

            if (!turnstile) {
                return;
            }

            finish(() => resolve(turnstile));
        };

        const pollTimer = window.setInterval(check, 25);
        const timeoutTimer = window.setTimeout(() => {
            finish(() =>
                reject(
                    new TurnstileError(
                        'script-timeout',
                        `Cloudflare Turnstile was not ready within ${timeoutMs}ms.`,
                    ),
                ),
            );
        }, timeoutMs);

        script?.addEventListener('error', onScriptError, { once: true });
        check();
    });
}

function createScript(options: TurnstileScriptOptions): HTMLScriptElement {
    const script = document.createElement('script');

    for (const [name, value] of Object.entries(options.attributes ?? {})) {
        script.setAttribute(name, value);
    }

    script.id = options.id ?? TURNSTILE_SCRIPT_ID;
    script.src = options.src ?? TURNSTILE_SCRIPT_URL;
    script.async = options.async ?? true;
    script.defer = options.defer ?? true;
    script.dataset.turnstileLoader = 'laravel-turnstile-vue';

    if (options.nonce !== undefined) {
        script.nonce = options.nonce;
    }

    if (options.crossOrigin !== undefined) {
        script.crossOrigin = options.crossOrigin;
    }

    const parent = options.appendTo === 'body' ? document.body : document.head;

    if (!parent) {
        throw new TurnstileError(
            'script-load',
            `The document ${options.appendTo ?? 'head'} is not available yet.`,
        );
    }

    parent.appendChild(script);

    return script;
}

export function loadTurnstileScript(
    options: LoadTurnstileOptions = {},
): Promise<Turnstile> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return Promise.reject(
            new TurnstileError(
                'server',
                'Cloudflare Turnstile can only be loaded in a browser.',
            ),
        );
    }

    const available = getTurnstile();

    if (available) {
        return Promise.resolve(available);
    }

    if (activeLoad?.status === 'pending') {
        return activeLoad.promise;
    }

    if (activeLoad?.status === 'resolved') {
        activeLoad = undefined;
    }

    const timeoutMs = options.timeoutMs ?? TURNSTILE_SCRIPT_TIMEOUT;
    let script: HTMLScriptElement | undefined;
    let ownsScript = false;

    try {
        validateTimeout(timeoutMs);

        const src = options.src ?? TURNSTILE_SCRIPT_URL;
        const id = options.id ?? TURNSTILE_SCRIPT_ID;

        if (typeof id !== 'string' || id.trim() === '') {
            throw new TurnstileError(
                'configuration',
                '`scriptOptions.id` cannot be empty.',
            );
        }

        script = findExistingScript(src, id);

        if (!script && (options.injectScript ?? true)) {
            script = createScript(options);
            ownsScript = true;
        }
    } catch (error) {
        return Promise.reject(error);
    }

    const promise = waitForTurnstile(script, timeoutMs).catch((error: unknown) => {
        if (ownsScript) {
            script?.remove();
        }

        if (activeLoad?.promise === promise) {
            activeLoad = undefined;
        }

        throw error;
    });

    const load: ActiveLoad = {
        promise,
        status: 'pending',
        ...(script ? { script } : {}),
    };
    activeLoad = load;
    void promise.then(
        () => {
            load.status = 'resolved';
        },
        () => undefined,
    );

    return promise;
}
