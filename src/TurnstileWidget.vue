<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { TurnstileError, toTurnstileError } from './errors';
import { createRenderParameters } from './options';
import type { TurnstileCallbacks } from './options';
import { getTurnstile, loadTurnstileScript } from './script';
import type {
    TurnstileChallengeOptions,
    TurnstileClientErrorCode,
    TurnstileWidgetId,
    TurnstileWidgetInstance,
    TurnstileWidgetProps,
    TurnstileWidgetState,
} from './types';

defineOptions({
    name: 'TurnstileWidget',
});

const props = withDefaults(defineProps<TurnstileWidgetProps>(), {
    modelValue: '',
    theme: 'auto',
    size: 'normal',
    renderOnMount: true,
    injectScript: true,
    resetOnModelClear: true,
    disableAutoReload: false,
});

const emit = defineEmits<{
    (event: 'update:modelValue', value: string): void;
    (event: 'success', token: string): void;
    (event: 'error', error: TurnstileClientErrorCode | TurnstileError): void;
    (event: 'expired'): void;
    (event: 'timeout'): void;
    (event: 'before-interactive'): void;
    (event: 'after-interactive'): void;
    (event: 'unsupported'): void;
    (event: 'loaded'): void;
    (event: 'widget-load', widgetId: TurnstileWidgetId): void;
    (event: 'reset'): void;
    (event: 'removed'): void;
}>();

interface ResponseWaiter {
    resolve(token: string): void;
    reject(error: TurnstileError): void;
    timer: number;
}

const containerRef = ref<HTMLDivElement>();
const state = ref<TurnstileWidgetState>('idle');
const effectiveExecution = computed(() =>
    props.size === 'invisible'
        ? (props.execution ?? 'execute')
        : (props.execution ?? 'render'),
);

let mounted = false;
let widgetId: TurnstileWidgetId | undefined;
let currentToken = '';
let lastResponseError: TurnstileError | undefined;
let lastEmittedModelValue: string | undefined;
let renderPromise: Promise<TurnstileWidgetId> | undefined;
let challengePromise: Promise<string> | undefined;
let rerenderVersion = 0;
let widgetLifecycleVersion = 0;
let operationVersion = 0;
const responseWaiters = new Set<ResponseWaiter>();

function assertOperationActive(version: number): void {
    if (!mounted) {
        throw new TurnstileError('unmounted', 'The Turnstile component is not mounted.');
    }

    if (version !== operationVersion) {
        throw new TurnstileError(
            'removed',
            'The Turnstile widget was removed while an operation was pending.',
        );
    }
}

function emitModelValue(value: string): void {
    currentToken = value;
    lastEmittedModelValue = value;
    emit('update:modelValue', value);
}

function resolveResponseWaiters(token: string): void {
    for (const waiter of responseWaiters) {
        window.clearTimeout(waiter.timer);
        waiter.resolve(token);
    }

    responseWaiters.clear();
}

function rejectResponseWaiters(error: TurnstileError): void {
    for (const waiter of responseWaiters) {
        window.clearTimeout(waiter.timer);
        waiter.reject(error);
    }

    responseWaiters.clear();
}

const callbackHandlers: TurnstileCallbacks = {
    success(token: string): void {
        lastResponseError = undefined;
        state.value = 'success';
        emitModelValue(token);
        resolveResponseWaiters(token);
        emit('success', token);
    },
    error(errorCode: TurnstileClientErrorCode): void {
        const error = new TurnstileError(
            'challenge',
            `Turnstile challenge failed (${errorCode}).`,
        );
        lastResponseError = error;
        state.value = 'error';
        clearWidgetToken();
        rejectResponseWaiters(error);
        emit('error', errorCode);
    },
    expired(): void {
        const error = new TurnstileError('expired', 'The Turnstile token expired.');
        lastResponseError = error;
        state.value = 'expired';
        clearWidgetToken();
        rejectResponseWaiters(error);
        emit('expired');
    },
    timeout(): void {
        const error = new TurnstileError(
            'timeout',
            'The interactive Turnstile challenge timed out.',
        );
        lastResponseError = error;
        state.value = 'timeout';
        clearWidgetToken();
        rejectResponseWaiters(error);
        emit('timeout');
    },
    beforeInteractive(): void {
        lastResponseError = undefined;
        state.value = 'interactive';
        emit('before-interactive');
    },
    afterInteractive(): void {
        if (state.value === 'interactive') {
            state.value = currentToken === '' ? 'ready' : 'success';
        }
        emit('after-interactive');
    },
    unsupported(): void {
        const error = new TurnstileError(
            'unsupported',
            'This browser is not supported by Turnstile.',
        );
        lastResponseError = error;
        state.value = 'unsupported';
        clearWidgetToken();
        rejectResponseWaiters(error);
        emit('unsupported');
    },
};

function createCallbacks(version: number): TurnstileCallbacks {
    const current = (): boolean => mounted && version === widgetLifecycleVersion;

    return {
        success: (token) => {
            if (current()) callbackHandlers.success(token);
        },
        error: (errorCode) => {
            if (current()) callbackHandlers.error(errorCode);
        },
        expired: () => {
            if (current()) callbackHandlers.expired();
        },
        timeout: () => {
            if (current()) callbackHandlers.timeout();
        },
        beforeInteractive: () => {
            if (current()) callbackHandlers.beforeInteractive();
        },
        afterInteractive: () => {
            if (current()) callbackHandlers.afterInteractive();
        },
        unsupported: () => {
            if (current()) callbackHandlers.unsupported();
        },
    };
}

async function performRender(version: number): Promise<TurnstileWidgetId> {
    if (!mounted || !containerRef.value) {
        throw new TurnstileError('unmounted', 'The Turnstile component is not mounted.');
    }

    state.value = 'loading';
    lastResponseError = undefined;

    try {
        const turnstile = await loadTurnstileScript({
            ...props.scriptOptions,
            injectScript: props.injectScript,
        });

        if (!mounted || !containerRef.value) {
            throw new TurnstileError(
                'unmounted',
                'The Turnstile component was removed while its script was loading.',
            );
        }

        if (version !== widgetLifecycleVersion) {
            throw new TurnstileError(
                'removed',
                'The Turnstile widget was removed while its script was loading.',
            );
        }

        emit('loaded');

        const renderedId = turnstile.render(
            containerRef.value,
            createRenderParameters(props, createCallbacks(version)),
        );

        if (!renderedId) {
            throw new TurnstileError(
                'render',
                'Cloudflare Turnstile did not return a widget ID.',
            );
        }

        widgetId = renderedId;
        if (state.value === 'loading') {
            state.value = 'ready';
        }
        emit('widget-load', renderedId);

        return renderedId;
    } catch (error: unknown) {
        const turnstileError = toTurnstileError(
            error,
            'render',
            'Cloudflare Turnstile could not be rendered.',
        );

        if (turnstileError.kind !== 'unmounted' && turnstileError.kind !== 'removed') {
            lastResponseError = turnstileError;
            state.value = 'error';
            rejectResponseWaiters(turnstileError);
            emit('error', turnstileError);
        }

        throw turnstileError;
    }
}

function renderWidget(): Promise<TurnstileWidgetId> {
    if (widgetId !== undefined) {
        return Promise.resolve(widgetId);
    }

    if (renderPromise) {
        return renderPromise;
    }

    renderPromise = performRender(widgetLifecycleVersion).finally(() => {
        renderPromise = undefined;
    });

    return renderPromise;
}

function clearWidgetToken(): void {
    if (currentToken !== '' || props.modelValue !== '') {
        emitModelValue('');
    }
}

function resetWidgetInternal(): TurnstileError | undefined {
    const turnstile = getTurnstile();
    const resetResponseError = new TurnstileError(
        'challenge',
        'The Turnstile widget was reset.',
    );
    let resetError: TurnstileError | undefined;
    lastResponseError = undefined;

    if (widgetId !== undefined) {
        if (!turnstile) {
            resetError = new TurnstileError(
                'challenge',
                'Cloudflare Turnstile is not available for reset.',
            );
        } else {
            try {
                turnstile.reset(widgetId);
                if (!lastResponseError) {
                    state.value = 'ready';
                }
            } catch (error: unknown) {
                resetError = toTurnstileError(
                    error,
                    'challenge',
                    'Cloudflare Turnstile could not be reset.',
                );
            }
        }

        if (resetError) {
            lastResponseError = resetError;
            state.value = 'error';
            emit('error', resetError);
        }
    }

    clearWidgetToken();
    rejectResponseWaiters(resetError ?? resetResponseError);
    emit('reset');

    return resetError;
}

function resetWidget(): void {
    resetWidgetInternal();
}

function removeWidget(emitEvent: boolean): void {
    widgetLifecycleVersion += 1;
    const turnstile = getTurnstile();

    if (turnstile && widgetId !== undefined) {
        try {
            turnstile.remove(widgetId);
        } catch (error: unknown) {
            emit(
                'error',
                toTurnstileError(
                    error,
                    'removed',
                    'Cloudflare Turnstile could not be removed.',
                ),
            );
        }
    }

    widgetId = undefined;
    lastResponseError = undefined;
    state.value = 'removed';
    clearWidgetToken();
    rejectResponseWaiters(
        new TurnstileError('removed', 'The Turnstile widget was removed.'),
    );

    if (emitEvent) {
        emit('removed');
    }
}

function removePublicWidget(): void {
    operationVersion += 1;
    removeWidget(true);
}

function getResponse(): string | undefined {
    const turnstile = getTurnstile();

    if (turnstile && widgetId !== undefined) {
        try {
            return turnstile.getResponse(widgetId) || currentToken || undefined;
        } catch {
            return currentToken || undefined;
        }
    }

    return currentToken || undefined;
}

function isExpired(): boolean {
    const turnstile = getTurnstile();

    if (!turnstile || widgetId === undefined) {
        return true;
    }

    try {
        return turnstile.isExpired(widgetId);
    } catch {
        return true;
    }
}

function validateResponseTimeout(timeoutMs: number): void {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new TurnstileError(
            'configuration',
            '`timeoutMs` must be a positive finite number.',
        );
    }
}

function getResponsePromise(timeoutMs = 30_000): Promise<string> {
    if (!mounted) {
        return Promise.reject(
            new TurnstileError('unmounted', 'The Turnstile component is not mounted.'),
        );
    }

    try {
        validateResponseTimeout(timeoutMs);
    } catch (error: unknown) {
        return Promise.reject(
            toTurnstileError(error, 'configuration', 'Invalid response timeout.'),
        );
    }

    if (lastResponseError) {
        return Promise.reject(lastResponseError);
    }

    const response = getResponse();

    if (response && !isExpired()) {
        return Promise.resolve(response);
    }

    return new Promise((resolve, reject) => {
        const waiter: ResponseWaiter = {
            resolve,
            reject,
            timer: window.setTimeout(() => {
                responseWaiters.delete(waiter);
                reject(
                    new TurnstileError(
                        'challenge-timeout',
                        `Turnstile did not return a token within ${timeoutMs}ms.`,
                    ),
                );
            }, timeoutMs),
        };

        responseWaiters.add(waiter);
    });
}

async function runBeforeExecute(version: number): Promise<void> {
    assertOperationActive(version);

    if (!props.beforeExecute) {
        return;
    }

    try {
        await props.beforeExecute();
    } catch (error: unknown) {
        assertOperationActive(version);
        const turnstileError = toTurnstileError(
            error,
            'preflight',
            'The Turnstile preflight hook failed.',
        );
        lastResponseError = turnstileError;
        state.value = 'error';
        emit('error', turnstileError);
        throw turnstileError;
    }

    assertOperationActive(version);
}

async function getCurrentWidgetId(version: number): Promise<TurnstileWidgetId> {
    while (true) {
        assertOperationActive(version);
        const lifecycleVersion = widgetLifecycleVersion;
        const renderedId = await renderWidget();
        assertOperationActive(version);

        if (lifecycleVersion === widgetLifecycleVersion && renderedId === widgetId) {
            return renderedId;
        }
    }
}

async function executeWithoutPreflight(version: number): Promise<void> {
    const renderedId = await getCurrentWidgetId(version);
    const turnstile = getTurnstile();

    if (!turnstile) {
        const error = new TurnstileError(
            'execute',
            'Cloudflare Turnstile is not available.',
        );
        lastResponseError = error;
        state.value = 'error';
        rejectResponseWaiters(error);
        emit('error', error);
        throw error;
    }

    try {
        turnstile.execute(renderedId);
    } catch (error: unknown) {
        const turnstileError = toTurnstileError(
            error,
            'execute',
            'Cloudflare Turnstile could not be executed.',
        );
        lastResponseError = turnstileError;
        state.value = 'error';
        rejectResponseWaiters(turnstileError);
        emit('error', turnstileError);
        throw turnstileError;
    }
}

async function executeWidget(): Promise<void> {
    const version = operationVersion;
    await runBeforeExecute(version);
    await executeWithoutPreflight(version);
}

async function performChallenge(
    options: TurnstileChallengeOptions,
    version: number,
): Promise<string> {
    validateResponseTimeout(options.timeoutMs ?? 30_000);
    await runBeforeExecute(version);
    await getCurrentWidgetId(version);

    if (
        options.force ||
        state.value === 'error' ||
        state.value === 'expired' ||
        state.value === 'timeout'
    ) {
        const resetError = resetWidgetInternal();

        if (resetError) {
            throw resetError;
        }
    }

    if (lastResponseError) {
        throw lastResponseError;
    }

    const response = getResponse();

    if (response) {
        if (!isExpired()) {
            return response;
        }

        const resetError = resetWidgetInternal();

        if (resetError) {
            throw resetError;
        }
    }

    const responsePromise = getResponsePromise(options.timeoutMs);

    if (effectiveExecution.value === 'execute') {
        try {
            await executeWithoutPreflight(version);
        } catch (error: unknown) {
            await responsePromise.catch(() => undefined);
            throw error;
        }
    }

    return responsePromise;
}

function challenge(options: TurnstileChallengeOptions = {}): Promise<string> {
    if (challengePromise) {
        return challengePromise;
    }

    const pendingChallenge = performChallenge(options, operationVersion).finally(() => {
        if (challengePromise === pendingChallenge) {
            challengePromise = undefined;
        }
    });
    challengePromise = pendingChallenge;

    return pendingChallenge;
}

async function rerenderWidget(): Promise<void> {
    const version = ++rerenderVersion;
    await Promise.resolve();

    if (version !== rerenderVersion || !mounted) {
        return;
    }

    if (renderPromise) {
        await renderPromise.catch(() => undefined);
    }

    if (version !== rerenderVersion || !mounted) {
        return;
    }

    removeWidget(false);
    await renderWidget();
}

const renderOptions = computed(() => [
    props.sitekey,
    props.theme,
    props.size,
    props.action,
    props.cData,
    props.language,
    props.tabindex,
    props.retry,
    props.retryInterval,
    props.refreshExpired,
    props.refreshTimeout,
    props.appearance,
    props.execution,
    props.responseField,
    props.responseFieldName,
    props.feedbackEnabled,
    props.offlabelShowPrivacy,
    props.offlabelShowHelp,
    props.disableAutoReload,
]);

watch(renderOptions, () => {
    if (mounted && widgetId !== undefined) {
        void rerenderWidget().catch(() => undefined);
    }
});

watch(
    () => props.renderOnMount,
    (renderOnMount) => {
        if (mounted && renderOnMount && widgetId === undefined) {
            void renderWidget().catch(() => undefined);
        }
    },
);

watch(
    () => props.modelValue,
    (value, previousValue) => {
        if (value === lastEmittedModelValue) {
            lastEmittedModelValue = undefined;
            return;
        }

        if (
            props.resetOnModelClear &&
            value === '' &&
            previousValue !== '' &&
            currentToken !== ''
        ) {
            resetWidget();
        }
    },
);

const exposed: TurnstileWidgetInstance = {
    render: renderWidget,
    execute: executeWidget,
    challenge,
    reset: resetWidget,
    remove: removePublicWidget,
    getResponse,
    getResponsePromise,
    isExpired,
    getWidgetId: () => widgetId,
    getState: () => state.value,
};

defineExpose(exposed);

onMounted(() => {
    mounted = true;

    if (props.renderOnMount) {
        void renderWidget().catch(() => undefined);
    }
});

onBeforeUnmount(() => {
    mounted = false;
    rerenderVersion += 1;
    removeWidget(false);
});
</script>

<template>
    <div ref="containerRef" :data-turnstile-state="state" />
</template>
