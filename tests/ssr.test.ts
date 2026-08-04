// @vitest-environment node

import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { describe, expect, it } from 'vitest';

import TurnstileWidget from '../src/TurnstileWidget.vue';
import { getTurnstile, isTurnstileAvailable, loadTurnstileScript } from '../src/script';

describe('SSR', () => {
    it('imports and renders stable markup without browser globals', async () => {
        const app = createSSRApp(TurnstileWidget, { sitekey: 'site-key' });

        await expect(renderToString(app)).resolves.toContain(
            'data-turnstile-state="idle"',
        );
    });

    it('returns an actionable error if the script loader is called on the server', async () => {
        expect(getTurnstile()).toBeUndefined();
        expect(isTurnstileAvailable()).toBe(false);
        await expect(loadTurnstileScript()).rejects.toMatchObject({
            kind: 'server',
        });
    });
});
