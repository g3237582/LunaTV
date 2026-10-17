export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { installSecretLogRedaction } = await import('./lib/redact-secrets');
    installSecretLogRedaction();
  }
}
