import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TurnstileError } from '../src/errors';
import type {
    Turnstile,
    TurnstileRenderParameters,
    TurnstileWidgetInstance,
} from '../src/types';
import { createMockTurnstile, deferred } from './helpers/mockTurnstile';

const scriptMocks = vi.hoisted(() => ({
    load: vi.fn<() => Promise<Turnstile>>(),
    get: vi.fn<() => Turnstile | undefined>(),
}));

vi.mock('../src/script', () => ({
    loadTurnstileScript: scriptMocks.load,
    getTurnstile: scriptMocks.get,
}));

import TurnstileWidget from '../src/TurnstileWidget.vue';

function instance(wrapper: ReturnType<typeof mount>): TurnstileWidgetInstance {
    return wrapper.vm as unknown as TurnstileWidgetInstance;
}

function latestParameters(
    parameters: Map<string, TurnstileRenderParameters>,
): TurnstileRenderParameters {
    const latest = Array.from(parameters.values()).at(-1);

    if (!latest) throw new Error('No widget was rendered.');
    return latest;
}

describe('TurnstileWidget', () => {
    let mock: ReturnType<typeof createMockTurnstile>;

    beforeEach(() => {
        mock = createMockTurnstile();
        scriptMocks.load.mockResolvedValue(mock.api);
        scriptMocks.get.mockReturnValue(mock.api);
    });

    it('renders on mount with official defaults and emits lifecycle events', async () => {
        const wrapper = mount(TurnstileWidget, { props: { sitekey: 'site-key' } });
        await flushPromises();

        expect(scriptMocks.load).toHaveBeenCalledWith({ injectScript: true });
        expect(mock.render).toHaveBeenCalledOnce();
        expect(wrapper.emitted('loaded')).toHaveLength(1);
        expect(wrapper.emitted('widget-load')?.[0]).toEqual(['widget-1']);
        expect(wrapper.attributes('data-turnstile-state')).toBe('ready');
        expect(latestParameters(mock.parameters)).toMatchObject({
            theme: 'auto',
            size: 'normal',
            execution: 'render',
            appearance: 'always',
        });
    });

    it('preserves state from a synchronous provider callback during render', async () => {
        mock.render.mockImplementationOnce((_container, parameters) => {
            parameters.callback?.('synchronous-token');
            return 'synchronous-widget';
        });
        const wrapper = mount(TurnstileWidget, { props: { sitekey: 'site-key' } });
        await flushPromises();

        expect(instance(wrapper).getWidgetId()).toBe('synchronous-widget');
        expect(instance(wrapper).getState()).toBe('success');
        expect(wrapper.emitted('success')).toEqual([['synchronous-token']]);
    });

    it('surfaces a synchronous unsupported callback without waiting for timeout', async () => {
        mock.render.mockImplementationOnce((_container, parameters) => {
            parameters['unsupported-callback']?.();
            return 'unsupported-widget';
        });
        const wrapper = mount(TurnstileWidget, {
            props: { sitekey: 'site-key', renderOnMount: false },
        });

        await expect(instance(wrapper).challenge()).rejects.toMatchObject({
            kind: 'unsupported',
        });
        expect(instance(wrapper).getState()).toBe('unsupported');
    });

    it('forwards attrs and every render option', async () => {
        const wrapper = mount(TurnstileWidget, {
            attrs: { class: 'captcha', 'aria-label': 'Verification' },
            props: {
                sitekey: 'site-key',
                theme: 'dark',
                size: 'compact',
                action: 'contact',
                cData: 'visitor_1',
                language: 'fr',
                tabindex: 3,
                retry: 'never',
                retryInterval: 5000,
                refreshExpired: 'manual',
                refreshTimeout: 'never',
                appearance: 'interaction-only',
                execution: 'execute',
                responseField: false,
                responseFieldName: 'token',
                feedbackEnabled: false,
                offlabelShowPrivacy: false,
                offlabelShowHelp: false,
                scriptOptions: { nonce: 'nonce' },
            },
        });
        await flushPromises();

        expect(wrapper.classes()).toContain('captcha');
        expect(wrapper.attributes('aria-label')).toBe('Verification');
        expect(scriptMocks.load).toHaveBeenCalledWith({
            nonce: 'nonce',
            injectScript: true,
        });
        expect(latestParameters(mock.parameters)).toMatchObject({
            theme: 'dark',
            size: 'compact',
            action: 'contact',
            cData: 'visitor_1',
            language: 'fr',
            tabindex: 3,
            retry: 'never',
            'retry-interval': 5000,
            'refresh-expired': 'manual',
            'refresh-timeout': 'never',
            appearance: 'interaction-only',
            execution: 'execute',
            'response-field': false,
            'response-field-name': 'token',
            'feedback-enabled': false,
            'offlabel-show-privacy': false,
            'offlabel-show-help': false,
        });
    });

    it('emits token and all Cloudflare callbacks', async () => {
        const wrapper = mount(TurnstileWidget, { props: { sitekey: 'site-key' } });
        await flushPromises();
        const callbacks = latestParameters(mock.parameters);

        callbacks['before-interactive-callback']?.();
        await nextTick();
        expect(wrapper.attributes('data-turnstile-state')).toBe('interactive');
        callbacks['after-interactive-callback']?.();
        callbacks.callback?.('token-value');
        callbacks['error-callback']?.('200500');
        callbacks['expired-callback']?.();
        callbacks['timeout-callback']?.();
        callbacks['unsupported-callback']?.();
        await nextTick();

        expect(wrapper.emitted('update:modelValue')).toEqual([['token-value'], ['']]);
        expect(wrapper.emitted('success')).toEqual([['token-value']]);
        expect(wrapper.emitted('error')?.[0]).toEqual(['200500']);
        expect(wrapper.emitted('expired')).toHaveLength(1);
        expect(wrapper.emitted('timeout')).toHaveLength(1);
        expect(wrapper.emitted('before-interactive')).toHaveLength(1);
        expect(wrapper.emitted('after-interactive')).toHaveLength(1);
        expect(wrapper.emitted('unsupported')).toHaveLength(1);
        expect(wrapper.attributes('data-turnstile-state')).toBe('unsupported');
    });

    it('does not let after-interactive erase a terminal callback state', async () => {
        const wrapper = mount(TurnstileWidget, { props: { sitekey: 'site-key' } });
        await flushPromises();
        const callbacks = latestParameters(mock.parameters);

        callbacks['before-interactive-callback']?.();
        callbacks['timeout-callback']?.();
        callbacks['after-interactive-callback']?.();
        await nextTick();

        expect(instance(wrapper).getState()).toBe('timeout');
    });

    it('supports manual rendering and the complete imperative API', async () => {
        const wrapper = mount(TurnstileWidget, {
            props: { sitekey: 'site-key', renderOnMount: false },
        });
        await flushPromises();

        expect(mock.render).not.toHaveBeenCalled();
        await expect(instance(wrapper).render()).resolves.toBe('widget-1');
        expect(instance(wrapper).getWidgetId()).toBe('widget-1');
        expect(instance(wrapper).getState()).toBe('ready');

        mock.responses.set('widget-1', 'response');
        expect(instance(wrapper).getResponse()).toBe('response');
        expect(instance(wrapper).isExpired()).toBe(false);
        await expect(instance(wrapper).getResponsePromise()).resolves.toBe('response');

        instance(wrapper).reset();
        expect(mock.reset).toHaveBeenCalledWith('widget-1');
        expect(wrapper.emitted('reset')).toHaveLength(1);

        instance(wrapper).remove();
        expect(mock.remove).toHaveBeenCalledWith('widget-1');
        expect(wrapper.emitted('removed')).toHaveLength(1);
        expect(instance(wrapper).getWidgetId()).toBeUndefined();
    });

    it('runs async preflight before invisible execution and resolves challenge tokens', async () => {
        const order: string[] = [];
        const beforeExecute = vi.fn(async () => {
            order.push('preflight');
        });
        mock.execute.mockImplementation(() => {
            order.push('execute');
        });
        const wrapper = mount(TurnstileWidget, {
            props: {
                sitekey: 'invisible-key',
                execution: 'execute',
                appearance: 'execute',
                beforeExecute,
            },
        });
        await flushPromises();

        const challenge = instance(wrapper).challenge({ timeoutMs: 1000 });
        await flushPromises();
        expect(order).toEqual(['preflight', 'execute']);

        latestParameters(mock.parameters).callback?.('fresh-token');
        await expect(challenge).resolves.toBe('fresh-token');
    });

    it('supports the v1 invisible alias without passing an invalid size', async () => {
        const wrapper = mount(TurnstileWidget, {
            props: { sitekey: 'invisible-key', size: 'invisible' },
        });
        await flushPromises();

        const parameters = latestParameters(mock.parameters);
        expect(parameters.size).toBeUndefined();
        expect(parameters.execution).toBe('execute');
        expect(parameters.appearance).toBe('execute');

        await instance(wrapper).execute();
        expect(mock.execute).toHaveBeenCalledWith('widget-1');
    });

    it('surfaces preflight and configuration failures', async () => {
        const preflightFailure = new Error('session refresh failed');
        const wrapper = mount(TurnstileWidget, {
            props: {
                sitekey: 'site-key',
                execution: 'execute',
                beforeExecute: () => Promise.reject(preflightFailure),
            },
        });
        await flushPromises();

        await expect(instance(wrapper).execute()).rejects.toMatchObject({
            kind: 'preflight',
        });
        expect(wrapper.emitted('error')?.at(-1)?.[0]).toBeInstanceOf(TurnstileError);

        const invalid = mount(TurnstileWidget, {
            props: { sitekey: 'site-key', action: 'not valid' },
        });
        await flushPromises();
        expect(invalid.emitted('error')?.[0]?.[0]).toMatchObject({
            kind: 'configuration',
        });
    });

    it('cancels an async preflight when the public widget is removed', async () => {
        const preflight = deferred<void>();
        const beforeExecute = vi.fn(() => preflight.promise);
        const wrapper = mount(TurnstileWidget, {
            props: {
                sitekey: 'invisible-key',
                execution: 'execute',
                beforeExecute,
            },
        });
        await flushPromises();

        const challenge = instance(wrapper).challenge();
        await nextTick();
        instance(wrapper).remove();
        preflight.resolve();

        await expect(challenge).rejects.toMatchObject({ kind: 'removed' });
        expect(beforeExecute).toHaveBeenCalledOnce();
        expect(mock.execute).not.toHaveBeenCalled();
        expect(mock.render).toHaveBeenCalledOnce();
    });

    it('does not run preflight through a stale unmounted component ref', async () => {
        const beforeExecute = vi.fn();
        const wrapper = mount(TurnstileWidget, {
            props: { sitekey: 'site-key', beforeExecute },
        });
        await flushPromises();
        const widget = instance(wrapper);
        wrapper.unmount();

        await expect(widget.execute()).rejects.toMatchObject({ kind: 'unmounted' });
        expect(beforeExecute).not.toHaveBeenCalled();
    });

    it('resets when a consumed v-model token is cleared by its parent', async () => {
        const wrapper = mount(TurnstileWidget, {
            props: { sitekey: 'site-key', modelValue: '' },
        });
        await flushPromises();
        latestParameters(mock.parameters).callback?.('one-use-token');
        await wrapper.setProps({ modelValue: 'one-use-token' });
        await wrapper.setProps({ modelValue: '' });

        expect(mock.reset).toHaveBeenCalledWith('widget-1');
        expect(wrapper.emitted('reset')).toHaveLength(1);
    });

    it('can disable reset-on-clear for externally managed lifecycles', async () => {
        const wrapper = mount(TurnstileWidget, {
            props: { sitekey: 'site-key', modelValue: '', resetOnModelClear: false },
        });
        await flushPromises();
        latestParameters(mock.parameters).callback?.('token');
        await wrapper.setProps({ modelValue: 'token' });
        await wrapper.setProps({ modelValue: '' });

        expect(mock.reset).not.toHaveBeenCalled();
    });

    it('removes and re-renders when Cloudflare options change', async () => {
        const wrapper = mount(TurnstileWidget, {
            props: { sitekey: 'site-key', theme: 'light' },
        });
        await flushPromises();
        await wrapper.setProps({ theme: 'dark', action: 'login' });
        await flushPromises();

        expect(mock.remove).toHaveBeenCalledWith('widget-1');
        expect(mock.render).toHaveBeenCalledTimes(2);
        expect(latestParameters(mock.parameters)).toMatchObject({
            theme: 'dark',
            action: 'login',
        });
    });

    it('does not render after unmounting during a pending script load', async () => {
        const loading = deferred<Turnstile>();
        scriptMocks.load.mockReturnValue(loading.promise);
        const wrapper = mount(TurnstileWidget, { props: { sitekey: 'site-key' } });
        await nextTick();
        wrapper.unmount();
        loading.resolve(mock.api);
        await flushPromises();

        expect(mock.render).not.toHaveBeenCalled();
        expect(mock.remove).not.toHaveBeenCalled();
    });

    it('does not render after public removal during a pending script load', async () => {
        const loading = deferred<Turnstile>();
        scriptMocks.load.mockReturnValue(loading.promise);
        const wrapper = mount(TurnstileWidget, { props: { sitekey: 'site-key' } });
        await nextTick();

        instance(wrapper).remove();
        loading.resolve(mock.api);
        await flushPromises();

        expect(mock.render).not.toHaveBeenCalled();
        expect(instance(wrapper).getState()).toBe('removed');
        expect(wrapper.emitted('error')).toBeUndefined();
    });

    it('removes its exact widget on unmount', async () => {
        const wrapper = mount(TurnstileWidget, { props: { sitekey: 'site-key' } });
        await flushPromises();
        wrapper.unmount();

        expect(mock.remove).toHaveBeenCalledOnce();
        expect(mock.remove).toHaveBeenCalledWith('widget-1');
    });

    it('times out response promises deterministically', async () => {
        vi.useFakeTimers();
        const wrapper = mount(TurnstileWidget, { props: { sitekey: 'site-key' } });
        await flushPromises();
        const response = instance(wrapper).getResponsePromise(100);
        const assertion = expect(response).rejects.toMatchObject({
            kind: 'challenge-timeout',
        });
        await vi.advanceTimersByTimeAsync(100);
        await assertion;

        await expect(instance(wrapper).getResponsePromise(0)).rejects.toMatchObject({
            kind: 'configuration',
        });
    });

    it('rejects pending response waiters when Cloudflare reports a failure', async () => {
        const wrapper = mount(TurnstileWidget, { props: { sitekey: 'site-key' } });
        await flushPromises();
        const response = instance(wrapper).getResponsePromise(1000);
        const assertion = expect(response).rejects.toMatchObject({ kind: 'challenge' });

        latestParameters(mock.parameters)['error-callback']?.('300030');

        await assertion;
        expect(instance(wrapper).getState()).toBe('error');
    });

    it('reports invalid render results and rejects calls after unmount', async () => {
        mock.render.mockImplementationOnce(() => '');
        const wrapper = mount(TurnstileWidget, {
            props: { sitekey: 'site-key', renderOnMount: false },
        });
        const widget = instance(wrapper);

        await expect(widget.render()).rejects.toMatchObject({ kind: 'render' });
        expect(wrapper.emitted('error')?.[0]?.[0]).toMatchObject({ kind: 'render' });

        wrapper.unmount();
        await expect(widget.render()).rejects.toMatchObject({ kind: 'unmounted' });
    });

    it('handles unavailable and throwing Cloudflare methods defensively', async () => {
        const wrapper = mount(TurnstileWidget, { props: { sitekey: 'site-key' } });
        await flushPromises();
        const widget = instance(wrapper);
        latestParameters(mock.parameters).callback?.('local-token');

        mock.getResponse.mockImplementationOnce(() => {
            throw new Error('getResponse failed');
        });
        expect(widget.getResponse()).toBe('local-token');

        mock.isExpired.mockImplementationOnce(() => {
            throw new Error('isExpired failed');
        });
        expect(widget.isExpired()).toBe(true);

        mock.reset.mockImplementationOnce(() => {
            throw new Error('reset failed');
        });
        widget.reset();
        expect(widget.getState()).toBe('error');
        expect(wrapper.emitted('error')?.at(-1)?.[0]).toMatchObject({
            kind: 'challenge',
        });

        mock.remove.mockImplementationOnce(() => {
            throw new Error('remove failed');
        });
        widget.remove();
        expect(wrapper.emitted('error')?.at(-1)?.[0]).toMatchObject({
            kind: 'removed',
        });

        scriptMocks.get.mockReturnValue(undefined);
        expect(widget.getResponse()).toBeUndefined();
        expect(widget.isExpired()).toBe(true);
    });

    it('surfaces missing APIs and synchronous execute failures', async () => {
        const wrapper = mount(TurnstileWidget, {
            props: { sitekey: 'site-key', renderOnMount: false },
        });

        scriptMocks.get.mockReturnValue(undefined);
        await expect(instance(wrapper).execute()).rejects.toMatchObject({
            kind: 'execute',
        });
        expect(wrapper.emitted('error')?.at(-1)?.[0]).toMatchObject({
            kind: 'execute',
        });

        scriptMocks.get.mockReturnValue(mock.api);
        mock.execute.mockImplementationOnce(() => {
            throw new Error('execute failed');
        });
        await expect(instance(wrapper).execute()).rejects.toMatchObject({
            kind: 'execute',
        });
    });

    it('handles a failed deferred challenge without leaking its response promise', async () => {
        mock.execute.mockImplementationOnce(() => {
            throw new Error('execute failed');
        });
        const wrapper = mount(TurnstileWidget, {
            props: {
                sitekey: 'invisible-key',
                execution: 'execute',
                appearance: 'execute',
            },
        });
        await flushPromises();

        await expect(instance(wrapper).challenge()).rejects.toMatchObject({
            kind: 'execute',
        });
    });

    it('reuses valid tokens and can force a fresh invisible challenge', async () => {
        const wrapper = mount(TurnstileWidget, {
            props: { sitekey: 'invisible-key', size: 'invisible' },
        });
        await flushPromises();
        mock.responses.set('widget-1', 'cached-token');

        await expect(instance(wrapper).challenge({ timeoutMs: 0 })).rejects.toMatchObject(
            { kind: 'configuration' },
        );
        await expect(instance(wrapper).challenge()).resolves.toBe('cached-token');
        expect(mock.execute).not.toHaveBeenCalled();

        const freshToken = instance(wrapper).challenge({ force: true, timeoutMs: 1000 });
        await flushPromises();
        expect(mock.reset).toHaveBeenCalledWith('widget-1');
        expect(mock.execute).toHaveBeenCalledWith('widget-1');
        latestParameters(mock.parameters).callback?.('fresh-token');
        await expect(freshToken).resolves.toBe('fresh-token');
    });

    it('does not reuse a token when a forced reset fails', async () => {
        const wrapper = mount(TurnstileWidget, {
            props: { sitekey: 'invisible-key', size: 'invisible' },
        });
        await flushPromises();
        mock.responses.set('widget-1', 'possibly-consumed-token');
        mock.reset.mockImplementationOnce(() => {
            throw new Error('reset failed');
        });

        await expect(instance(wrapper).challenge({ force: true })).rejects.toMatchObject({
            kind: 'challenge',
        });
        await expect(instance(wrapper).getResponsePromise()).rejects.toMatchObject({
            kind: 'challenge',
        });
        expect(mock.execute).not.toHaveBeenCalled();
    });

    it('deduplicates concurrent challenges and refreshes stale tokens', async () => {
        const wrapper = mount(TurnstileWidget, {
            props: {
                sitekey: 'invisible-key',
                execution: 'execute',
                appearance: 'execute',
            },
        });
        await flushPromises();
        mock.responses.set('widget-1', 'expired-token');
        mock.expired.set('widget-1', true);

        const first = instance(wrapper).challenge({ timeoutMs: 1000 });
        const second = instance(wrapper).challenge({ timeoutMs: 1000 });
        expect(first).toBe(second);
        await flushPromises();

        expect(mock.reset).toHaveBeenCalledOnce();
        expect(mock.execute).toHaveBeenCalledOnce();
        latestParameters(mock.parameters).callback?.('replacement-token');
        await expect(first).resolves.toBe('replacement-token');
        await expect(second).resolves.toBe('replacement-token');
    });

    it('can begin rendering when renderOnMount is enabled later', async () => {
        const wrapper = mount(TurnstileWidget, {
            props: { sitekey: 'site-key', renderOnMount: false },
        });
        await flushPromises();
        expect(mock.render).not.toHaveBeenCalled();

        await wrapper.setProps({ renderOnMount: true });
        await flushPromises();
        expect(mock.render).toHaveBeenCalledOnce();
    });

    it('contains failures raised by an option-driven rerender', async () => {
        const wrapper = mount(TurnstileWidget, {
            props: { sitekey: 'site-key', theme: 'light' },
        });
        await flushPromises();
        scriptMocks.load.mockRejectedValueOnce(new Error('loader unavailable'));

        await wrapper.setProps({ theme: 'dark' });
        await flushPromises();

        expect(wrapper.emitted('error')?.at(-1)?.[0]).toMatchObject({ kind: 'render' });
        expect(instance(wrapper).getState()).toBe('error');
    });

    it('ignores callbacks from a widget replaced by a reactive rerender', async () => {
        const wrapper = mount(TurnstileWidget, {
            props: { sitekey: 'site-key', theme: 'light' },
        });
        await flushPromises();
        const staleCallbacks = latestParameters(mock.parameters);

        await wrapper.setProps({ theme: 'dark' });
        await flushPromises();
        staleCallbacks.callback?.('stale-token');
        staleCallbacks['error-callback']?.('200500');
        staleCallbacks['expired-callback']?.();
        staleCallbacks['timeout-callback']?.();
        staleCallbacks['before-interactive-callback']?.();
        staleCallbacks['after-interactive-callback']?.();
        staleCallbacks['unsupported-callback']?.();
        await nextTick();

        expect(wrapper.emitted('success')).toBeUndefined();
        expect(wrapper.emitted('error')).toBeUndefined();
        expect(wrapper.emitted('expired')).toBeUndefined();
        expect(wrapper.emitted('timeout')).toBeUndefined();
        expect(wrapper.emitted('before-interactive')).toBeUndefined();
        expect(wrapper.emitted('after-interactive')).toBeUndefined();
        expect(wrapper.emitted('unsupported')).toBeUndefined();
        latestParameters(mock.parameters).callback?.('current-token');
        expect(wrapper.emitted('success')).toEqual([['current-token']]);
    });

    it('rejects response waits immediately after unmount', async () => {
        const wrapper = mount(TurnstileWidget, { props: { sitekey: 'site-key' } });
        await flushPromises();
        const widget = instance(wrapper);
        wrapper.unmount();

        await expect(widget.getResponsePromise()).rejects.toMatchObject({
            kind: 'unmounted',
        });
    });

    it('deduplicates concurrent render calls', async () => {
        const loading = deferred<Turnstile>();
        scriptMocks.load.mockReturnValue(loading.promise);
        const wrapper = mount(TurnstileWidget, {
            props: { sitekey: 'site-key', renderOnMount: false },
        });
        const first = instance(wrapper).render();
        const second = instance(wrapper).render();
        expect(first).toBe(second);
        loading.resolve(mock.api);
        await expect(first).resolves.toBe('widget-1');
        expect(mock.render).toHaveBeenCalledOnce();
    });
});
