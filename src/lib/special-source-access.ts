import { getAvailableApiSites, getConfig } from '@/lib/config';

import { shouldShowSpecialSourceSearchEntry } from './special-source-entry';

/**
 * 当前登录用户能否看到特殊源搜索入口。
 * 权限沿用 getAvailableApiSites(user, true)：用户自己的 enabledApis 优先，
 * 否则看用户组 tags 的 enabledApis。没有单独的特殊源功能权限项。
 */
export async function resolveSpecialSourceSearchEnabled(
  username?: string | null
): Promise<boolean> {
  if (!username) return false;

  const config = await getConfig();
  const configured = Array.isArray(config.SpecialSourceApis)
    ? config.SpecialSourceApis
    : [];
  if (configured.length === 0) return false;

  const allowed = await getAvailableApiSites(username, true);
  return shouldShowSpecialSourceSearchEntry({
    loggedIn: true,
    configuredCount: configured.length,
    allowedCount: allowed.length,
  });
}
