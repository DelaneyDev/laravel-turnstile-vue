import { describe, expect, it, vi } from 'vitest';

import type { TurnstileError } from '../src/errors';
import { createRenderParameters } from '../src/options';
import type { TurnstileCallbacks } from '../src/options';
import type { TurnstileWidgetProps } from '../src/types';

function createCallbacks(): TurnstileCallbacks {
    return {
        success: vi.fn(),
        error: vi.fn(),
        expired: vi.fn(),
        timeout: vi.fn(),
        beforeInteractive: vi.fn(),
        afterInteractive: vi.fn(),
        unsupported: vi.fn(),
    };
}

describe('createRenderParameters', () => {
    it('uses Cloudflare defaults and wires every callback', () => {
        const callbacks = createCallbacks();
        const parameters = createRenderParameters({ sitekey: 'site-key' }, callbacks);

        expect(parameters).toMatchObject({
            sitekey: 'site-key',
            execution: 'render',
            appearance: 'always',
            retry: 'auto',
            'refresh-expired': 'auto',
            'refresh-timeout': 'auto',
            callback: callbacks.success,
            'error-callback': callbacks.error,
            'expired-callback': callbacks.expired,
            'timeout-callback': callbacks.timeout,
            'before-interactive-callback': callbacks.beforeInteractive,
            'after-interactive-callback': callbacks.afterInteractive,
            'unsupported-callback': callbacks.unsupported,
        });
    });

    it('maps the complete public option surface', () => {
        const props: TurnstileWidgetProps = {
            sitekey: 'site-key',
            action: 'auth_login',
            cData: 'visitor_123',
            theme: 'dark',
            language: 'en-GB',
            tabindex: 4,
            size: 'flexible',
            retry: 'never',
            retryInterval: 12_000,
            refreshExpired: 'manual',
            refreshTimeout: 'never',
            appearance: 'interaction-only',
            execution: 'execute',
            responseField: false,
            responseFieldName: 'turnstile-token',
            feedbackEnabled: false,
            offlabelShowPrivacy: false,
            offlabelShowHelp: false,
        };

        expect(createRenderParameters(props, createCallbacks())).toMatchObject({
            sitekey: 'site-key',
            action: 'auth_login',
            cData: 'visitor_123',
            theme: 'dark',
            language: 'en-GB',
            tabindex: 4,
            size: 'flexible',
            retry: 'never',
            'retry-interval': 12_000,
            'refresh-expired': 'manual',
            'refresh-timeout': 'never',
            appearance: 'interaction-only',
            execution: 'execute',
            'response-field': false,
            'response-field-name': 'turnstile-token',
            'feedback-enabled': false,
            'offlabel-show-privacy': false,
            'offlabel-show-help': false,
        });
    });

    it('keeps v1 invisible usage functional without sending an invalid size', () => {
        const parameters = createRenderParameters(
            { sitekey: 'invisible-key', size: 'invisible' },
            createCallbacks(),
        );

        expect(parameters).not.toHaveProperty('size');
        expect(parameters).toMatchObject({ execution: 'execute', appearance: 'execute' });
    });

    it('maps disableAutoReload to Cloudflare-owned retry controls', () => {
        const parameters = createRenderParameters(
            { sitekey: 'site-key', disableAutoReload: true },
            createCallbacks(),
        );

        expect(parameters).toMatchObject({
            retry: 'never',
            'refresh-expired': 'never',
            'refresh-timeout': 'never',
        });
    });

    it('accepts Cloudflare-documented empty action and customer data values', () => {
        expect(
            createRenderParameters(
                { sitekey: 'site-key', action: '', cData: '' },
                createCallbacks(),
            ),
        ).toMatchObject({ action: '', cData: '' });
    });

    it.each([
        [{ sitekey: 42 } as unknown as TurnstileWidgetProps, '`sitekey`'],
        [{ sitekey: '   ' }, '`sitekey` cannot be empty'],
        [{ sitekey: ' key' }, '`sitekey` cannot contain'],
        [{ sitekey: 'key', action: 42 } as unknown as TurnstileWidgetProps, '`action`'],
        [{ sitekey: 'key', action: 'contains spaces' }, '`action`'],
        [{ sitekey: 'key', action: 'a'.repeat(33) }, '`action`'],
        [{ sitekey: 'key', cData: 42 } as unknown as TurnstileWidgetProps, '`cData`'],
        [{ sitekey: 'key', cData: '!' }, '`cData`'],
        [{ sitekey: 'key', cData: 'a'.repeat(256) }, '`cData`'],
        [
            { sitekey: 'key', theme: 'sepia' } as unknown as TurnstileWidgetProps,
            '`theme`',
        ],
        [{ sitekey: 'key', size: 'wide' } as unknown as TurnstileWidgetProps, '`size`'],
        [
            { sitekey: 'key', retry: 'manual' } as unknown as TurnstileWidgetProps,
            '`retry`',
        ],
        [
            {
                sitekey: 'key',
                refreshExpired: 'sometimes',
            } as unknown as TurnstileWidgetProps,
            '`refreshExpired`',
        ],
        [
            {
                sitekey: 'key',
                refreshTimeout: 'sometimes',
            } as unknown as TurnstileWidgetProps,
            '`refreshTimeout`',
        ],
        [
            {
                sitekey: 'key',
                appearance: 'hidden',
            } as unknown as TurnstileWidgetProps,
            '`appearance`',
        ],
        [
            {
                sitekey: 'key',
                execution: 'manual',
            } as unknown as TurnstileWidgetProps,
            '`execution`',
        ],
        [{ sitekey: 'key', language: ' ' }, '`language`'],
        [
            { sitekey: 'key', language: 42 } as unknown as TurnstileWidgetProps,
            '`language`',
        ],
        [{ sitekey: 'key', tabindex: 1.5 }, '`tabindex`'],
        [{ sitekey: 'key', retryInterval: 0 }, '`retryInterval`'],
        [{ sitekey: 'key', retryInterval: 900_000 }, '`retryInterval`'],
        [{ sitekey: 'key', retryInterval: 1.5 }, '`retryInterval`'],
        [{ sitekey: 'key', responseFieldName: ' ' }, '`responseFieldName`'],
        [
            {
                sitekey: 'key',
                responseFieldName: 42,
            } as unknown as TurnstileWidgetProps,
            '`responseFieldName`',
        ],
    ] satisfies Array<[TurnstileWidgetProps, string]>)(
        'rejects invalid configuration %#',
        (props, message) => {
            expect(() => createRenderParameters(props, createCallbacks())).toThrowError(
                expect.objectContaining<TurnstileError>({
                    name: 'TurnstileError',
                    kind: 'configuration',
                    message: expect.stringContaining(message),
                }),
            );
        },
    );
});
