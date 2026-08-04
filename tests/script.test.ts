import { describe, expect, it, vi } from 'vitest';

import { TURNSTILE_SCRIPT_ID, TURNSTILE_SCRIPT_URL } from '../src/constants';
import { TurnstileError } from '../src/errors';
import { getTurnstile, isTurnstileAvailable, loadTurnstileScript } from '../src/script';
import type { Turnstile } from '../src/types';
import { createMockTurnstile } from './helpers/mockTurnstile';

async function makeTurnstileReady() {
    const mock = createMockTurnstile();
    window.turnstile = mock.api;
    await vi.advanceTimersByTimeAsync(25);
    return mock;
}

describe('Turnstile script loader', () => {
    it('injects one shared script for concurrent callers', async () => {
        vi.useFakeTimers();
        const first = loadTurnstileScript();
        const second = loadTurnstileScript();

        expect(first).toBe(second);
        expect(document.querySelectorAll(`script#${TURNSTILE_SCRIPT_ID}`)).toHaveLength(
            1,
        );
        expect(document.querySelector('script')?.src).toBe(TURNSTILE_SCRIPT_URL);

        const mock = await makeTurnstileReady();
        await expect(first).resolves.toBe(mock.api);
        await expect(second).resolves.toBe(mock.api);
        expect(mock.ready).not.toHaveBeenCalled();
    });

    it('waits for a consumer-owned script instead of resolving early', async () => {
        vi.useFakeTimers();
        const script = document.createElement('script');
        script.id = TURNSTILE_SCRIPT_ID;
        script.src = TURNSTILE_SCRIPT_URL;
        document.head.appendChild(script);

        let resolved = false;
        const loading = loadTurnstileScript({ injectScript: false }).then((api) => {
            resolved = true;
            return api;
        });

        await vi.advanceTimersByTimeAsync(100);
        expect(resolved).toBe(false);
        expect(document.scripts).toHaveLength(1);

        const mock = await makeTurnstileReady();
        await expect(loading).resolves.toBe(mock.api);
    });

    it('discovers an existing official script by URL without calling ready', async () => {
        vi.useFakeTimers();
        const script = document.createElement('script');
        script.id = 'consumer-turnstile-script';
        script.src = TURNSTILE_SCRIPT_URL;
        document.head.appendChild(script);
        const loading = loadTurnstileScript();
        const mock = createMockTurnstile();
        mock.ready.mockImplementation(() => {
            throw new Error('ready failed');
        });
        window.turnstile = mock.api;

        await vi.advanceTimersByTimeAsync(25);

        await expect(loading).resolves.toBe(mock.api);
        expect(document.scripts).toHaveLength(1);
        expect(mock.ready).not.toHaveBeenCalled();
    });

    it('waits until a partial global becomes the complete runtime API', async () => {
        vi.useFakeTimers();
        const loading = loadTurnstileScript({ injectScript: false });
        let resolved = false;
        void loading.then(() => {
            resolved = true;
        });
        window.turnstile = {
            ready: vi.fn(),
        } as unknown as Turnstile;

        await vi.advanceTimersByTimeAsync(25);
        expect(resolved).toBe(false);

        const mock = createMockTurnstile();
        window.turnstile = mock.api;

        await vi.advanceTimersByTimeAsync(25);

        await expect(loading).resolves.toBe(mock.api);
    });

    it('waits for a manually injected script that appears later', async () => {
        vi.useFakeTimers();
        const loading = loadTurnstileScript({ injectScript: false });

        expect(document.scripts).toHaveLength(0);
        const mock = await makeTurnstileReady();
        await expect(loading).resolves.toBe(mock.api);
    });

    it('applies CSP and script element options', async () => {
        vi.useFakeTimers();
        const loading = loadTurnstileScript({
            id: 'custom-turnstile',
            nonce: 'nonce-value',
            async: false,
            defer: false,
            appendTo: 'body',
            crossOrigin: 'anonymous',
            attributes: { 'data-cfasync': 'false', 'data-test': 'script' },
        });
        const script = document.querySelector<HTMLScriptElement>('#custom-turnstile');

        expect(script).not.toBeNull();
        expect(script?.parentElement).toBe(document.body);
        expect(script?.nonce).toBe('nonce-value');
        expect(script?.async).toBe(false);
        expect(script?.defer).toBe(false);
        expect(script?.crossOrigin).toBe('anonymous');
        expect(script?.dataset.cfasync).toBe('false');
        expect(script?.dataset.test).toBe('script');

        await makeTurnstileReady();
        await loading;
    });

    it('rejects conflicting element and script IDs', async () => {
        const element = document.createElement('div');
        element.id = TURNSTILE_SCRIPT_ID;
        document.body.appendChild(element);

        await expect(loadTurnstileScript()).rejects.toMatchObject({
            kind: 'script-id-conflict',
        });

        element.remove();
        const script = document.createElement('script');
        script.id = TURNSTILE_SCRIPT_ID;
        script.src = 'https://example.com/not-turnstile.js';
        document.head.appendChild(script);

        await expect(loadTurnstileScript()).rejects.toMatchObject({
            kind: 'script-id-conflict',
        });

        script.src = TURNSTILE_SCRIPT_URL;
        await expect(
            loadTurnstileScript({ src: 'https://example.com/custom-turnstile.js' }),
        ).rejects.toMatchObject({ kind: 'script-id-conflict' });

        script.src =
            'https://challenges.cloudflare.com:444/turnstile/v0/api.js?render=explicit';
        await expect(loadTurnstileScript()).rejects.toMatchObject({
            kind: 'script-id-conflict',
        });
    });

    it('removes a failed owned script and permits a retry', async () => {
        vi.useFakeTimers();
        const first = loadTurnstileScript();
        const firstScript = document.querySelector<HTMLScriptElement>('script');
        const assertion = expect(first).rejects.toMatchObject({ kind: 'script-load' });
        firstScript?.dispatchEvent(new Event('error'));
        await assertion;

        expect(firstScript?.isConnected).toBe(false);
        const second = loadTurnstileScript();
        const secondScript = document.querySelector<HTMLScriptElement>('script');
        expect(secondScript).not.toBe(firstScript);

        await makeTurnstileReady();
        await expect(second).resolves.toBe(window.turnstile);
    });

    it('times out and validates timeout values', async () => {
        vi.useFakeTimers();
        const loading = loadTurnstileScript({ timeoutMs: 100 });
        const assertion = expect(loading).rejects.toMatchObject({
            kind: 'script-timeout',
        });
        await vi.advanceTimersByTimeAsync(100);
        await assertion;

        await expect(loadTurnstileScript({ timeoutMs: 0 })).rejects.toBeInstanceOf(
            TurnstileError,
        );
        await expect(loadTurnstileScript({ src: 'http://[' })).rejects.toMatchObject({
            kind: 'configuration',
        });
        await expect(loadTurnstileScript({ id: ' ' })).rejects.toMatchObject({
            kind: 'configuration',
        });
        await expect(
            loadTurnstileScript({ src: 'data:text/javascript,' }),
        ).rejects.toMatchObject({ kind: 'configuration' });
    });

    it('reports when the requested script parent is unavailable', async () => {
        const body = document.body;
        body.remove();

        try {
            await expect(loadTurnstileScript({ appendTo: 'body' })).rejects.toMatchObject(
                { kind: 'script-load' },
            );
        } finally {
            document.documentElement.appendChild(body);
        }
    });

    it('reports an existing global without touching the DOM', async () => {
        const mock = createMockTurnstile();
        window.turnstile = mock.api;

        expect(getTurnstile()).toBe(mock.api);
        expect(isTurnstileAvailable()).toBe(true);
        await expect(loadTurnstileScript()).resolves.toBe(mock.api);
        expect(document.scripts).toHaveLength(0);
    });

    it('ignores a hostile or broken global API getter', () => {
        Object.defineProperty(window, 'turnstile', {
            configurable: true,
            get: () => {
                throw new Error('blocked global');
            },
        });

        expect(getTurnstile()).toBeUndefined();
        expect(isTurnstileAvailable()).toBe(false);
    });
});
