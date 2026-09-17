import {
  clearConfigCache,
  getConfig,
  setCachedConfig,
} from '@/lib/config';
import { setTestSiteId } from '@/lib/site-context';

describe('admin config site isolation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_STORAGE_TYPE = 'localstorage';
    process.env.SITE_A_ID = 'luna';
    process.env.SITE_A_SITE_NAME = 'LunaTV';
    process.env.SITE_B_ID = 'luna2';
    process.env.SITE_B_PORT = '3001';
    process.env.SITE_B_SITE_NAME = 'LunaTV 2';
  });

  afterEach(async () => {
    setTestSiteId('luna');
    await clearConfigCache();
    setTestSiteId('luna2');
    await clearConfigCache();
    setTestSiteId(null);
    process.env = { ...originalEnv };
  });

  it('does not reuse one site admin config for the other site', async () => {
    setTestSiteId('luna');
    await clearConfigCache();
    const luna = await getConfig();
    luna.SiteConfig.SiteName = 'Patched Luna';
    await setCachedConfig(luna);

    setTestSiteId('luna2');
    await clearConfigCache();
    const luna2 = await getConfig();
    expect(luna2.SiteConfig.SiteName).not.toBe('Patched Luna');

    setTestSiteId('luna');
    const lunaAgain = await getConfig();
    expect(lunaAgain.SiteConfig.SiteName).toBe('Patched Luna');
  });
});
