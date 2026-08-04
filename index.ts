import type { DefineComponent } from 'vue';

import RawTurnstileWidget from './src/TurnstileWidget.vue';
import type { TurnstileWidgetComponentProps, TurnstileWidgetInstance } from './src/types';

const TurnstileWidget = RawTurnstileWidget as unknown as DefineComponent<
    TurnstileWidgetComponentProps,
    TurnstileWidgetInstance
>;

export { TurnstileWidget };
export default TurnstileWidget;

export {
    TURNSTILE_SCRIPT_ID,
    TURNSTILE_SCRIPT_TIMEOUT,
    TURNSTILE_SCRIPT_URL,
    TURNSTILE_TEST_SECRET_KEYS,
    TURNSTILE_TEST_SITEKEYS,
} from './src/constants';
export { TurnstileError } from './src/errors';
export type { TurnstileErrorKind } from './src/errors';
export { getTurnstile, isTurnstileAvailable, loadTurnstileScript } from './src/script';
export type {
    LoadTurnstileOptions,
    Turnstile,
    TurnstileAppearance,
    TurnstileChallengeOptions,
    TurnstileClientErrorCode,
    TurnstileExecution,
    TurnstileRefresh,
    TurnstileRenderParameters,
    TurnstileRetry,
    TurnstileScriptOptions,
    TurnstileSize,
    TurnstileTheme,
    TurnstileWidgetId,
    TurnstileWidgetComponentProps,
    TurnstileWidgetEventProps,
    TurnstileWidgetInstance,
    TurnstileWidgetProps,
    TurnstileWidgetState,
    TurnstileWidgetTarget,
} from './src/types';
