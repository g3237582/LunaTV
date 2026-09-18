import { resolveClientFeatureFlags } from '@/lib/client-feature-flags';

describe('resolveClientFeatureFlags', () => {
  it('enables music only when the site music switch is on', () => {
    expect(
      resolveClientFeatureFlags({
        musicEnabled: true,
      })
    ).toEqual({
      MusicEnabled: true,
      SuwayomiEnabled: false,
      BooksEnabled: false,
    });
  });

  it('enables manga only when Suwayomi is on and has a server URL', () => {
    expect(
      resolveClientFeatureFlags({
        suwayomiEnabled: true,
        suwayomiServerUrl: 'http://10.77.0.2:4567',
      }).SuwayomiEnabled
    ).toBe(true);

    expect(
      resolveClientFeatureFlags({
        suwayomiEnabled: true,
        suwayomiServerUrl: '   ',
      }).SuwayomiEnabled
    ).toBe(false);
  });

  it('enables books from the OPDS/Legado site switch', () => {
    expect(
      resolveClientFeatureFlags({
        booksEnabled: true,
      }).BooksEnabled
    ).toBe(true);
  });

  it('never copies tokens or credentials into the client payload', () => {
    const flags = resolveClientFeatureFlags({
      musicEnabled: true,
      suwayomiEnabled: true,
      suwayomiServerUrl: 'http://suwayomi.local',
      booksEnabled: true,
      musicToken: 'secret-token',
    });

    expect(flags).toEqual({
      MusicEnabled: true,
      SuwayomiEnabled: true,
      BooksEnabled: true,
    });
    expect(JSON.stringify(flags)).not.toContain('secret-token');
  });
});
