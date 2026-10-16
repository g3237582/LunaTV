import {
  setSpecialSourceEnabledOnDevice,
  SPECIAL_SOURCE_PATH,
} from './special-source.client';

/**
 * 搜索页「特殊源」切换是否可见。
 * 站点必须配了特殊源，当前用户必须已登录，并且用户组 / 个人源名单里
 * 至少还能用到一个特殊源。三者缺一就不展示，避免空站或无权限用户看到入口。
 */
export function shouldShowSpecialSourceSearchEntry(input: {
  loggedIn: boolean;
  configuredCount: number;
  allowedCount: number;
}): boolean {
  return input.loggedIn && input.configuredCount > 0 && input.allowedCount > 0;
}

/** 带上当前关键词进入 /under。隔离靠路径，不在普通 /search 上加 special=1。 */
export function buildSpecialVideoSearchHref(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return SPECIAL_SOURCE_PATH;
  return `${SPECIAL_SOURCE_PATH}?q=${encodeURIComponent(trimmed)}`;
}

/** 切回普通影视搜索。地址里不保留 special，避免普通结果串进特殊源。 */
export function buildNormalVideoSearchHref(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return '/search';
  return `/search?q=${encodeURIComponent(trimmed)}&type=video`;
}

/**
 * 源站寻片在普通源 / 特殊源之间切换。
 * 关键词放在 keyword 上，换源后页面按它重新搜索。
 */
export function buildSourceSearchModeHref(input: {
  special: boolean;
  keyword?: string;
}): string {
  const params = new URLSearchParams();
  if (input.special) params.set('special', '1');
  const keyword = input.keyword?.trim() || '';
  if (keyword) params.set('keyword', keyword);
  const query = params.toString();
  return query ? `/source-search?${query}` : '/source-search';
}

/**
 * /under 在服务端靠 special_source cookie 放行。
 * 从可见入口进去之前必须先打开这个本机开关，否则下一跳是 404。
 */
export function activateSpecialSourceDeviceGate(): void {
  setSpecialSourceEnabledOnDevice(true);
}
