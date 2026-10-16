import { NextResponse } from 'next/server';

import { resolveSpecialSourceCapability } from './special-source-access';

export const SPECIAL_SOURCE_FORBIDDEN_BODY = {
  error: '无权使用特殊源',
  code: 'special_source_forbidden',
} as const;

/**
 * special=1 但当前用户不满足网页入口同一规则时，搜索接口统一 403。
 * 不把「没权限」伪装成空结果。未登录仍返回 401。不看 special_source cookie。
 * 普通搜索（special 不是 1）直接放行，调用方继续走原来的普通源列表。
 */
export async function rejectUnauthorizedSpecialSearch(
  username: string | undefined,
  specialOnly: boolean
): Promise<NextResponse | null> {
  if (!specialOnly) return null;
  if (!username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const capability = await resolveSpecialSourceCapability(username);
  if (!capability.available) {
    return NextResponse.json(SPECIAL_SOURCE_FORBIDDEN_BODY, { status: 403 });
  }
  return null;
}

/**
 * 特殊源搜索默认不写入普通搜索历史，也不进入基于搜索历史的推荐。
 * 搜索接口本身不落库；客户端若把关键词再 POST 到 /api/searchhistory，
 * 需要带上 body.special=true 或查询参数 special=1，服务端会跳过写入。
 */
export function shouldOmitSpecialSearchFromSharedHistory(input: {
  bodySpecial?: unknown;
  querySpecial?: string | null;
}): boolean {
  if (input.querySpecial === '1') return true;
  const value = input.bodySpecial;
  return value === true || value === 1 || value === '1';
}
