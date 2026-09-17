import { userInfoCache } from '@/lib/user-cache';
import { setTestSiteId } from '@/lib/site-context';

describe('user cache site isolation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.SITE_A_ID = 'luna';
    process.env.SITE_B_ID = 'luna2';
    process.env.SITE_B_PORT = '3001';
    userInfoCache.clear();
  });

  afterEach(() => {
    userInfoCache.clear();
    setTestSiteId(null);
    process.env = { ...originalEnv };
  });

  it('does not leak cached user roles across sites', () => {
    setTestSiteId('luna');
    userInfoCache.set('admin', {
      role: 'owner',
      banned: false,
      created_at: 1,
    });

    setTestSiteId('luna2');
    expect(userInfoCache.get('admin')).toBeNull();

    setTestSiteId('luna');
    expect(userInfoCache.get('admin')?.role).toBe('owner');
  });
});
