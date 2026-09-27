import { NextRequest, NextResponse } from 'next/server';

import { mapLxBoards } from '@/lib/music-board-cover';
import {
  createTtlCache,
  firstAvailableSourceList,
  MUSIC_DISCOVERY_CACHE_TTL_MS,
  MUSIC_DISCOVERY_TIMEOUT_MS,
} from '@/lib/music-discovery';
import { isMusicSource, lxGetJson, unwrapLxArray } from '@/lib/music-v2';
import { badRequest, internalError } from '@/lib/music-v2-api';

export const runtime = 'nodejs';

type BoardItem = { id: string; name: string; cover?: string; source: string };
type BoardsPayload = { list: BoardItem[]; source: string; errors: string[] };

const boardsCache = createTtlCache<BoardsPayload>(MUSIC_DISCOVERY_CACHE_TTL_MS);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'kw';
    if (!isMusicSource(source)) return badRequest('不支持的音源');

    const cached = boardsCache.get(source);
    if (cached) {
      return NextResponse.json(
        { success: true, data: cached },
        { headers: { 'Cache-Control': 'private, max-age=60' } }
      );
    }

    const fallbackSources = [source, 'kg', 'kw', 'tx', 'wy', 'mg'];
    const result = await firstAvailableSourceList<Record<string, unknown>>({
      sources: fallbackSources,
      load: (candidate) =>
        lxGetJson(
          `/api/music/leaderboard/boards?source=${candidate}`,
          'none',
          MUSIC_DISCOVERY_TIMEOUT_MS
        ),
      unwrap: unwrapLxArray,
    });

    const payload: BoardsPayload = {
      // 榜单列表本身通常没有图。这里只透传上游若已带的 img/pic/coverImgUrl，
      // 缺图的封面由 board-covers 用榜内第一首歌的专辑图补，避免这个接口变慢。
      list: mapLxBoards(result.list, result.source),
      source: result.source,
      errors: result.errors,
    };

    if (payload.list.length > 0) {
      boardsCache.set(source, payload);
    }

    return NextResponse.json(
      { success: true, data: payload },
      { headers: { 'Cache-Control': 'private, max-age=60' } }
    );
  } catch (error) {
    console.error('[music-v2] 获取榜单失败:', error);
    return internalError('获取榜单失败', (error as Error).message);
  }
}
