import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { resolveSpecialSourceCapability } from '@/lib/special-source-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/search/special-capability
 * 原生客户端查询当前用户能否使用特殊源搜索。
 * 鉴权与 /api/search 相同：Authorization: Bearer <登录 JSON>，或网页 auth cookie。
 * 不读取 special_source cookie。
 */
export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const capability = await resolveSpecialSourceCapability(authInfo.username);
  return NextResponse.json(
    {
      available: capability.available,
      count: capability.count,
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    }
  );
}
