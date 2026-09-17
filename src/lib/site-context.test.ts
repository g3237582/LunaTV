import {
  getAuthCookieName,
  getCurrentSiteId,
  getPeerSite,
  getSiteById,
  getSiteByPort,
  parseIsolatedSites,
  readSiteIdFromHeaders,
  SITE_HEADER,
  stampSiteHeader,
} from '@/lib/site-context';

describe('isolated site context', () => {
  const dualEnv = {
    SITE_A_ID: 'luna',
    SITE_A_PORT: '3000',
    SITE_A_KVROCKS_URL: 'redis://kv-a:6666',
    SITE_A_SITE_NAME: 'LunaTV',
    SITE_A_SITE_BASE: 'http://10.77.0.2:3000',
    SITE_B_ID: 'luna2',
    SITE_B_PORT: '3001',
    SITE_B_KVROCKS_URL: 'redis://kv-b:6666',
    SITE_B_SITE_NAME: 'LunaTV 2',
    SITE_B_SITE_BASE: 'http://10.77.0.2:3001',
  };

  it('maps each listen port to its own kvrocks and cookie name', () => {
    const sites = parseIsolatedSites(dualEnv);
    const luna = getSiteByPort(3000, sites);
    const luna2 = getSiteByPort(3001, sites);

    expect(luna.id).toBe('luna');
    expect(luna.kvrocksUrl).toBe('redis://kv-a:6666');
    expect(luna.authCookieName).toBe('auth_luna');
    expect(luna2.id).toBe('luna2');
    expect(luna2.kvrocksUrl).toBe('redis://kv-b:6666');
    expect(luna2.authCookieName).toBe('auth_luna2');
    expect(getAuthCookieName('luna2')).toBe('auth_luna2');
  });

  it('drops a client-forged site header and stamps the listen site', () => {
    const headers: Record<string, string | string[] | undefined> = {
      [SITE_HEADER]: 'luna2',
      'X-Lunatv-Site': 'luna2',
    };
    stampSiteHeader(headers, 'luna');
    expect(readSiteIdFromHeaders(headers)).toBe('luna');
    expect(headers['X-Lunatv-Site']).toBeUndefined();
  });

  it('keeps two isolated sites from sharing kvrocks or cookies', () => {
    const sites = parseIsolatedSites(dualEnv);
    expect(getSiteById('luna2', sites).siteName).toBe('LunaTV 2');
    expect(getPeerSite('luna', sites)?.id).toBe('luna2');
    expect(getPeerSite('luna', sites)?.kvrocksUrl).toBe(
      'redis://kv-b:6666'
    );
  });

  it('falls back to a single site when SITE_B is not configured', () => {
    const sites = parseIsolatedSites({
      PORT: '3000',
      KVROCKS_URL: 'redis://kv:6666',
      NEXT_PUBLIC_SITE_NAME: 'MoonTVPlus',
    });
    expect(sites).toHaveLength(1);
    expect(sites[0].id).toBe('luna');
    expect(sites[0].port).toBe(3000);
    expect(getPeerSite('luna', sites)).toBeNull();
  });

  it('ignores an unknown site id when resolving the current site', () => {
    expect(getCurrentSiteId({ 'x-lunatv-site': 'forged' })).toBe('luna');
  });
});
