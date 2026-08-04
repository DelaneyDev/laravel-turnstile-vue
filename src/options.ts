import { TurnstileError } from './errors';
import type {
    TurnstileClientErrorCode,
    TurnstileRenderParameters,
    TurnstileWidgetProps,
} from './types';

export interface TurnstileCallbacks {
    success(token: string): void;
    error(errorCode: TurnstileClientErrorCode): void;
    expired(): void;
    timeout(): void;
    beforeInteractive(): void;
    afterInteractive(): void;
    unsupported(): void;
}

const CUSTOM_DATA_PATTERN = /^[a-zA-Z0-9_-]*$/;

function validateChoice(
    name: string,
    value: string | undefined,
    choices: readonly string[],
): void {
    if (value !== undefined && !choices.includes(value)) {
        throw new TurnstileError(
            'configuration',
            `\`${name}\` must be one of: ${choices.join(', ')}.`,
        );
    }
}

function validateCustomData(name: string, value: string, maximum: number): void {
    if (value.length > maximum || !CUSTOM_DATA_PATTERN.test(value)) {
        throw new TurnstileError(
            'configuration',
            `\`${name}\` must be 0-${maximum} characters and contain only letters, numbers, underscores, or hyphens.`,
        );
    }
}

export function createRenderParameters(
    props: TurnstileWidgetProps,
    callbacks: TurnstileCallbacks,
): TurnstileRenderParameters {
    if (typeof props.sitekey !== 'string') {
        throw new TurnstileError('configuration', '`sitekey` must be a string.');
    }

    if (props.sitekey.trim() === '') {
        throw new TurnstileError('configuration', '`sitekey` cannot be empty.');
    }

    if (props.sitekey !== props.sitekey.trim()) {
        throw new TurnstileError(
            'configuration',
            '`sitekey` cannot contain leading or trailing whitespace.',
        );
    }

    if (props.action !== undefined) {
        if (typeof props.action !== 'string') {
            throw new TurnstileError('configuration', '`action` must be a string.');
        }
        validateCustomData('action', props.action, 32);
    }

    if (props.cData !== undefined) {
        if (typeof props.cData !== 'string') {
            throw new TurnstileError('configuration', '`cData` must be a string.');
        }
        validateCustomData('cData', props.cData, 255);
    }

    validateChoice('theme', props.theme, ['auto', 'light', 'dark']);
    validateChoice('size', props.size, ['normal', 'flexible', 'compact', 'invisible']);
    validateChoice('retry', props.retry, ['auto', 'never']);
    validateChoice('refreshExpired', props.refreshExpired, ['auto', 'manual', 'never']);
    validateChoice('refreshTimeout', props.refreshTimeout, ['auto', 'manual', 'never']);
    validateChoice('appearance', props.appearance, [
        'always',
        'execute',
        'interaction-only',
    ]);
    validateChoice('execution', props.execution, ['render', 'execute']);

    if (props.language !== undefined) {
        if (typeof props.language !== 'string') {
            throw new TurnstileError('configuration', '`language` must be a string.');
        }

        if (props.language.trim() === '') {
            throw new TurnstileError('configuration', '`language` cannot be empty.');
        }
    }

    if (props.tabindex !== undefined && !Number.isInteger(props.tabindex)) {
        throw new TurnstileError('configuration', '`tabindex` must be an integer.');
    }

    if (
        props.retryInterval !== undefined &&
        (!Number.isInteger(props.retryInterval) ||
            props.retryInterval <= 0 ||
            props.retryInterval >= 900_000)
    ) {
        throw new TurnstileError(
            'configuration',
            '`retryInterval` must be a positive integer below 900000.',
        );
    }

    if (props.responseFieldName !== undefined) {
        if (typeof props.responseFieldName !== 'string') {
            throw new TurnstileError(
                'configuration',
                '`responseFieldName` must be a string.',
            );
        }

        if (props.responseFieldName.trim() === '') {
            throw new TurnstileError(
                'configuration',
                '`responseFieldName` cannot be empty.',
            );
        }
    }

    const legacyInvisible = props.size === 'invisible';
    const parameters: TurnstileRenderParameters = {
        sitekey: props.sitekey,
        callback: callbacks.success,
        'error-callback': callbacks.error,
        'expired-callback': callbacks.expired,
        'timeout-callback': callbacks.timeout,
        'before-interactive-callback': callbacks.beforeInteractive,
        'after-interactive-callback': callbacks.afterInteractive,
        'unsupported-callback': callbacks.unsupported,
    };

    if (props.action !== undefined) parameters.action = props.action;
    if (props.cData !== undefined) parameters.cData = props.cData;
    if (props.theme !== undefined) parameters.theme = props.theme;
    if (props.language !== undefined) parameters.language = props.language;
    if (props.tabindex !== undefined) parameters.tabindex = props.tabindex;
    if (props.size !== undefined && props.size !== 'invisible') {
        parameters.size = props.size;
    }
    if (props.retryInterval !== undefined) {
        parameters['retry-interval'] = props.retryInterval;
    }
    if (props.responseField !== undefined) {
        parameters['response-field'] = props.responseField;
    }
    if (props.responseFieldName !== undefined) {
        parameters['response-field-name'] = props.responseFieldName;
    }
    if (props.feedbackEnabled !== undefined) {
        parameters['feedback-enabled'] = props.feedbackEnabled;
    }
    if (props.offlabelShowPrivacy !== undefined) {
        parameters['offlabel-show-privacy'] = props.offlabelShowPrivacy;
    }
    if (props.offlabelShowHelp !== undefined) {
        parameters['offlabel-show-help'] = props.offlabelShowHelp;
    }

    parameters.execution = props.execution ?? (legacyInvisible ? 'execute' : 'render');
    parameters.appearance = props.appearance ?? (legacyInvisible ? 'execute' : 'always');
    parameters.retry = props.retry ?? (props.disableAutoReload ? 'never' : 'auto');
    parameters['refresh-expired'] =
        props.refreshExpired ?? (props.disableAutoReload ? 'never' : 'auto');
    parameters['refresh-timeout'] =
        props.refreshTimeout ?? (props.disableAutoReload ? 'never' : 'auto');

    return parameters;
}
