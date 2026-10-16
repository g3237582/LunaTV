/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites } from '@/lib/config';
import { rejectUnauthorizedSpecialSearch } from '@/lib/special-source-api';
import { listEnabledSourceScripts } from '@/lib/source-script';

export const runtime = 'nodejs';

// OrionTV 兼容接口。不带 special 时行为不变：普通源 + 脚本源，不含特殊源。
export async function GET(request: NextRequest) {
  console.log('request', request.url);
  try {
    const specialOnly =
      new URL(request.url).searchParams.get('special') === '1';
    if (specialOnly) {
      const authInfo = getAuthInfoFromCookie(request);
      const specialRejection = await rejectUnauthorizedSpecialSearch(
        authInfo?.username,
        true
      );
      if (specialRejection) return specialRejection;

      const apiSites = await getAvailableApiSites(authInfo?.username, true);
      return NextResponse.json(apiSites, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    const apiSites = await getAvailableApiSites();
    const scriptSites = (await listEnabledSourceScripts()).map((item) => ({
      key: item.key,
      name: item.name,
      script: true,
    }));

    return NextResponse.json([...apiSites, ...scriptSites]);
  } catch (error) {
    return NextResponse.json({ error: '获取资源失败' }, { status: 500 });
  }
}
