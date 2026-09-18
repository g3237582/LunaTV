import { NextRequest, NextResponse } from 'next/server';

import { firstAvailableSourceList, MUSIC_DISCOVERY_TIMEOUT_MS } from '@/lib/music-discovery';
import { isMusicSource, lxGetJson } from '@/lib/music-v2';
import { badRequest, internalError } from '@/lib/music-v2-api';

export const runtime = 'nodejs';

type HotSearchItem = { keyword: string; name: string; artist: string; source: string };
type LxHotSearchPayload =
  | string[]
  | Array<{ name?: string; keyword?: string; word?: string; singer?: string; source?: string }>
  | { source?: string; list?: string[] | Array<{ name?: string; keyword?: string; word?: string; singer?: string; source?: string }> };

function normalizeHotSearchPayload(payload: LxHotSearchPayload, fallbackSource: string): HotSearchItem[] {
  const payloadSource = Array.isArray(payload) ? fallbackSource : payload?.source || fallbackSource;
  const rawList = Array.isArray(payload) ? payload : payload?.list;
  if (!Array.isArray(rawList)) return [];

  return rawList
    .map((item) => {
      if (typeof item === 'string') {
        return { keyword: item, name: item, artist: '', source: payloadSource };
      }
      const keyword = item.name || item.keyword || item.word || '';
      return {
        keyword,
        name: keyword,
        artist: item.singer || '',
        source: item.source || payloadSource,
      };
    })
    .filter((item) => item.keyword);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'mg';
    if (!isMusicSource(source)) return badRequest('不支持的音源');

    const result = await firstAvailableSourceList<HotSearchItem>({
      sources: [source, 'mg', 'kw', 'tx', 'wy', 'kg'],
      load: async (candidate) => {
        const payload = await lxGetJson<LxHotSearchPayload>(
          `/api/music/hotSearch?source=${candidate}`,
          'none',
          MUSIC_DISCOVERY_TIMEOUT_MS
        );
        return normalizeHotSearchPayload(payload, candidate);
      },
      unwrap: (payload) => (Array.isArray(payload) ? payload : []),
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          list: result.list,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600',
        },
      }
    );
  } catch (error) {
    return internalError('获取热搜失败', (error as Error).message);
  }
}
