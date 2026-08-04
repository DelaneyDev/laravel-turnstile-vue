import { afterEach, vi } from 'vitest';

afterEach(() => {
    if (typeof document !== 'undefined') {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
    }

    if (typeof window !== 'undefined') {
        delete window.turnstile;
    }

    vi.useRealTimers();
    vi.unstubAllGlobals();
});
