import { vi } from 'vitest';

import type {
    Turnstile,
    TurnstileRenderParameters,
    TurnstileWidgetId,
    TurnstileWidgetTarget,
} from '../../src/types';

export function createMockTurnstile() {
    const parameters = new Map<TurnstileWidgetId, TurnstileRenderParameters>();
    const responses = new Map<TurnstileWidgetId, string>();
    const expired = new Map<TurnstileWidgetId, boolean>();
    let nextWidgetId = 1;

    const ready = vi.fn((callback: () => void) => callback());
    const render = vi.fn(
        (_container: string | HTMLElement, options: TurnstileRenderParameters) => {
            const id = `widget-${nextWidgetId++}`;
            parameters.set(id, options);
            responses.set(id, '');
            expired.set(id, false);
            return id;
        },
    );
    const execute = vi.fn(() => undefined);
    const reset = vi.fn((target?: TurnstileWidgetTarget) => {
        if (typeof target === 'string') {
            responses.set(target, '');
            expired.set(target, false);
        }
    });
    const remove = vi.fn((target?: TurnstileWidgetTarget) => {
        if (typeof target === 'string') {
            responses.delete(target);
            expired.delete(target);
        }
    });
    const getResponse = vi.fn((target?: TurnstileWidgetTarget) =>
        typeof target === 'string' ? responses.get(target) : undefined,
    );
    const isExpired = vi.fn((target?: TurnstileWidgetTarget) =>
        typeof target === 'string' ? (expired.get(target) ?? true) : true,
    );

    const api: Turnstile = {
        ready,
        render,
        execute,
        reset,
        remove,
        getResponse,
        isExpired,
    };

    return {
        api,
        parameters,
        responses,
        expired,
        ready,
        render,
        execute,
        reset,
        remove,
        getResponse,
        isExpired,
    };
}

export function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });

    return { promise, resolve, reject };
}
