export type ClientFeatureFlags = {
  MusicEnabled: boolean;
  SuwayomiEnabled: boolean;
  BooksEnabled: boolean;
};

export type ClientFeatureFlagInput = {
  musicEnabled?: boolean;
  suwayomiEnabled?: boolean;
  suwayomiServerUrl?: string;
  booksEnabled?: boolean;
  /** Ignored on purpose — never forwarded to clients. */
  musicToken?: string;
};

export function resolveClientFeatureFlags(
  input: ClientFeatureFlagInput
): ClientFeatureFlags {
  return {
    MusicEnabled: !!input.musicEnabled,
    SuwayomiEnabled: !!(
      input.suwayomiEnabled && input.suwayomiServerUrl?.trim()
    ),
    BooksEnabled: !!input.booksEnabled,
  };
}

export function resolveClientFeatureFlagsFromEnv(): ClientFeatureFlags {
  return resolveClientFeatureFlags({
    musicEnabled: process.env.MUSIC_ENABLED === 'true',
    suwayomiEnabled: process.env.SUWAYOMI_ENABLED === 'true',
    suwayomiServerUrl:
      process.env.SUWAYOMI_URL || process.env.NEXT_PUBLIC_SUWAYOMI_URL || '',
    booksEnabled:
      process.env.OPDS_ENABLED === 'true' ||
      process.env.LEGADO_ENABLED === 'true',
  });
}
