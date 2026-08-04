export type TurnstileErrorKind =
    | 'configuration'
    | 'script-id-conflict'
    | 'script-load'
    | 'script-timeout'
    | 'server'
    | 'unmounted'
    | 'render'
    | 'execute'
    | 'challenge'
    | 'challenge-timeout'
    | 'expired'
    | 'timeout'
    | 'unsupported'
    | 'removed'
    | 'preflight';

export class TurnstileError extends Error {
    readonly kind: TurnstileErrorKind;

    constructor(kind: TurnstileErrorKind, message: string, cause?: unknown) {
        super(message, cause === undefined ? undefined : { cause });
        this.name = 'TurnstileError';
        this.kind = kind;
    }
}

export function toTurnstileError(
    error: unknown,
    kind: TurnstileErrorKind,
    message: string,
): TurnstileError {
    return error instanceof TurnstileError
        ? error
        : new TurnstileError(kind, message, error);
}
