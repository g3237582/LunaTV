import { NextRequest, NextResponse } from 'next/server';

import {
  fillMissingBoardCovers,
  pickFirstSongCover,
} from '@/lib/music-board-cover';
import {
  createTtlCache,
  MUSIC_DISCOVERY_CACHE_TTL_MS,
} from '@/lib/music-discovery';
import {
  type LxServerSong,
  isMusicSource,
  lxGetJson,
  normalizeLxSong,
  unwrapLxArray,
} from '@/lib/music-v2';
import { badRequest, internalError } from '@/lib/music-v2-api';

export const runtime = 'nodejs';

/** 单张榜单的歌曲首页，用来取第一张专辑图。比榜单列表接口短，避免一张慢榜拖住整页。 */
const BOARD_COVER_TIMEOUT_MS = 8000;
/** 和榜单页一页的条数对齐，避免一次把全部榜单的歌曲列表打到上游。 */
const MAX_BOARD_COVERS = 24;

const coverCache = createTtlCache<string>(MUSIC_DISCOVERY_CACHE_TTL_MS);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'kw';
    if (!isMusicSource(source)) return badRequest('不支持的音源');

    const ids = (searchParams.get('ids') || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, MAX_BOARD_COVERS);

    const covers: Record<string, string> = {};
    const missing: Array<{ id: string; cover?: string }> = [];
    ids.forEach((id) => {
      const cached = coverCache.get(`${source}:${id}`);
      if (cached) {
        covers[id] = cached;
      } else {
        missing.push({ id });
      }
    });

    const filled = await fillMissingBoardCovers(
      missing,
      async (boardId) => {
        const payload = await lxGetJson<unknown>(
          `/api/music/leaderboard/list?source=${source}&bangid=${encodeURIComponent(
            boardId
          )}&page=1`,
          'none',
          BOARD_COVER_TIMEOUT_MS
        );
        const cover = pickFirstSongCover(
          unwrapLxArray<LxServerSong>(payload).map((song) => ({
            cover: song ? normalizeLxSong(song).cover : '',
          }))
        );
        if (cover) coverCache.set(`${source}:${boardId}`, cover);
        return cover;
      },
      { concurrency: 4 }
    );

    filled.forEach((board) => {
      covers[board.id] = board.cover || '';
    });

    return NextResponse.json(
      { success: true, data: { covers } },
      { headers: { 'Cache-Control': 'private, max-age=60' } }
    );
  } catch (error) {
    return internalError('获取榜单封面失败', (error as Error).message);
  }
}
