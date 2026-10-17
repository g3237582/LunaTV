export function redactSecretsInString(value: string): string;
export function redactForLog(value: unknown): unknown;
export function installSecretLogRedaction(): void;
export function resetSecretLogRedactionForTests(): void;
