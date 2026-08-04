import type { TurnstileError } from './errors';

export type TurnstileTheme = 'auto' | 'light' | 'dark';
export type TurnstileSize = 'normal' | 'flexible' | 'compact';
export type TurnstileRetry = 'auto' | 'never';
export type TurnstileRefresh = 'auto' | 'manual' | 'never';
export type TurnstileAppearance = 'always' | 'execute' | 'interaction-only';
export type TurnstileExecution = 'render' | 'execute';
export type TurnstileWidgetId = string;
export type TurnstileWidgetTarget = TurnstileWidgetId | HTMLElement;

export type TurnstileClientErrorCode =
    | '110100'
    | '110110'
    | '110200'
    | '110600'
    | '110620'
    | '200100'
    | '200500'
    | '400020'
    | '400070'
    | `300${string}`
    | `600${string}`
    | (string & {});

export interface TurnstileRenderParameters {
    sitekey: string;
    action?: string;
    cData?: string;
    callback?: (token: string) => void;
    'error-callback'?: (errorCode: TurnstileClientErrorCode) => void;
    'expired-callback'?: () => void;
    'timeout-callback'?: () => void;
    'before-interactive-callback'?: () => void;
    'after-interactive-callback'?: () => void;
    'unsupported-callback'?: () => void;
    theme?: TurnstileTheme;
    language?: string;
    tabindex?: number;
    size?: TurnstileSize;
    retry?: TurnstileRetry;
    'retry-interval'?: number;
    'refresh-expired'?: TurnstileRefresh;
    'refresh-timeout'?: TurnstileRefresh;
    appearance?: TurnstileAppearance;
    execution?: TurnstileExecution;
    'response-field'?: boolean;
    'response-field-name'?: string;
    'feedback-enabled'?: boolean;
    'offlabel-show-privacy'?: boolean;
    'offlabel-show-help'?: boolean;
}

export interface Turnstile {
    ready(callback: () => void): void;
    render(
        container: string | HTMLElement,
        parameters: TurnstileRenderParameters,
    ): TurnstileWidgetId | undefined;
    execute(target: TurnstileWidgetTarget, parameters?: TurnstileRenderParameters): void;
    reset(target?: TurnstileWidgetTarget): void;
    remove(target?: TurnstileWidgetTarget): void;
    getResponse(target?: TurnstileWidgetTarget): string | undefined;
    isExpired(target?: TurnstileWidgetTarget): boolean;
}

export interface TurnstileScriptOptions {
    /** Script element ID. The first loader call owns shared script options. */
    id?: string;
    /** Custom API URL. The official Cloudflare URL is used by default. */
    src?: string;
    nonce?: string;
    async?: boolean;
    defer?: boolean;
    appendTo?: 'head' | 'body';
    crossOrigin?: string;
    timeoutMs?: number;
    attributes?: Readonly<Record<string, string>>;
}

export interface LoadTurnstileOptions extends TurnstileScriptOptions {
    /** Wait for a consumer-managed script instead of injecting one. */
    injectScript?: boolean;
}

export type TurnstileWidgetState =
    | 'idle'
    | 'loading'
    | 'ready'
    | 'interactive'
    | 'success'
    | 'expired'
    | 'timeout'
    | 'error'
    | 'unsupported'
    | 'removed';

export interface TurnstileWidgetProps {
    sitekey: string;
    modelValue?: string | undefined;
    theme?: TurnstileTheme | undefined;
    /** `invisible` is a deprecated v1 compatibility alias. Use an invisible sitekey. */
    size?: TurnstileSize | 'invisible' | undefined;
    action?: string | undefined;
    cData?: string | undefined;
    language?: string | undefined;
    tabindex?: number | undefined;
    retry?: TurnstileRetry | undefined;
    retryInterval?: number | undefined;
    refreshExpired?: TurnstileRefresh | undefined;
    refreshTimeout?: TurnstileRefresh | undefined;
    appearance?: TurnstileAppearance | undefined;
    execution?: TurnstileExecution | undefined;
    responseField?: boolean | undefined;
    responseFieldName?: string | undefined;
    feedbackEnabled?: boolean | undefined;
    offlabelShowPrivacy?: boolean | undefined;
    offlabelShowHelp?: boolean | undefined;
    renderOnMount?: boolean | undefined;
    injectScript?: boolean | undefined;
    scriptOptions?: TurnstileScriptOptions | undefined;
    resetOnModelClear?: boolean | undefined;
    /** Runs before `execute()` or `challenge()`, for example to refresh a session. */
    beforeExecute?: (() => PromiseLike<void> | void) | undefined;
    /** @deprecated Prefer Cloudflare's `retry` and `refreshExpired` options. */
    disableAutoReload?: boolean | undefined;
}

export interface TurnstileWidgetEventProps {
    'onUpdate:modelValue'?: (value: string) => void;
    onSuccess?: (token: string) => void;
    onError?: (error: TurnstileClientErrorCode | TurnstileError) => void;
    onExpired?: () => void;
    onTimeout?: () => void;
    onBeforeInteractive?: () => void;
    onAfterInteractive?: () => void;
    onUnsupported?: () => void;
    onLoaded?: () => void;
    onWidgetLoad?: (widgetId: TurnstileWidgetId) => void;
    onReset?: () => void;
    onRemoved?: () => void;
}

export type TurnstileWidgetComponentProps = TurnstileWidgetProps &
    TurnstileWidgetEventProps;

export interface TurnstileChallengeOptions {
    timeoutMs?: number;
    force?: boolean;
}

export interface TurnstileWidgetInstance {
    render(): Promise<TurnstileWidgetId>;
    execute(): Promise<void>;
    challenge(options?: TurnstileChallengeOptions): Promise<string>;
    reset(): void;
    remove(): void;
    getResponse(): string | undefined;
    getResponsePromise(timeoutMs?: number): Promise<string>;
    isExpired(): boolean;
    getWidgetId(): TurnstileWidgetId | undefined;
    getState(): TurnstileWidgetState;
}

declare global {
    interface Window {
        turnstile?: Turnstile;
    }
}
