import { getAvailableApiSites, getConfig } from '@/lib/config';

import { shouldShowSpecialSourceSearchEntry } from './special-source-entry';

/** 与网页搜索页特殊源开关同一口径。count 是该用户实际可用的特殊源数量。 */
export type SpecialSourceCapability = {
  available: boolean;
  count: number;
};

/**
 * 当前登录用户能否使用特殊源搜索。
 * 权限沿用 getAvailableApiSites(user, true)：用户自己的 enabledApis 优先，
 * 否则看用户组 tags 的 enabledApis。没有单独的特殊源功能权限项。
 * 不读取 special_source cookie，原生客户端只凭登录身份即可判断。
 */
export async function resolveSpecialSourceCapability(
  username?: string | null
): Promise<SpecialSourceCapability> {
  if (!username) return { available: false, count: 0 };

  const config = await getConfig();
  const configured = Array.isArray(config.SpecialSourceApis)
    ? config.SpecialSourceApis
    : [];
  if (configured.length === 0) return { available: false, count: 0 };

  const allowed = await getAvailableApiSites(username, true);
  const available = shouldShowSpecialSourceSearchEntry({
    loggedIn: true,
    configuredCount: configured.length,
    allowedCount: allowed.length,
  });
  return {
    available,
    count: available ? allowed.length : 0,
  };
}

/** 当前登录用户能否看到特殊源搜索入口。 */
export async function resolveSpecialSourceSearchEnabled(
  username?: string | null
): Promise<boolean> {
  const capability = await resolveSpecialSourceCapability(username);
  return capability.available;
}
