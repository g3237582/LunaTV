'use client';

import { useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { playMusicList } from '@/lib/music/actions';
import MusicLoadingIndicator from '@/components/music/MusicLoadingIndicator';
import MusicPaginationBar from '@/components/music/MusicPaginationBar';
import SongList from '@/components/music/SongList';
import { useMusicPagedResource } from '@/components/music/useMusicPagedResource';
import { parsePageParam, withPageQuery } from '@/lib/music-page-data';
import { mapSong, normalizeSource } from '@/lib/music/shared';
import type { Song } from '@/lib/music/types';

export default function MusicRankingDetailPage() {
  const router = useRouter();
  const params = useParams<{ source: string; playlistId: string }>();
  const searchParams = useSearchParams();
  const source = normalizeSource(params.source);
  const playlistId = decodeURIComponent(params.playlistId);
  const title = searchParams.get('name') || '排行榜';
  const page = parsePageParam(searchParams.get('page'));

  const loadPage = useCallback(async (nextPage: number) => {
    const res = await fetch(
      `/api/music/v2/discovery/board-songs?source=${source}&boardId=${encodeURIComponent(playlistId)}&page=${nextPage}`
    );
    const data = await res.json();
    const list = ((data.data?.list || []) as Parameters<typeof mapSong>[0][]).map(mapSong);
    return {
      list,
      total: Number(data.data?.total || list.length),
      limit: Number(data.data?.limit || list.length),
    };
  }, [source, playlistId]);

  const { allItems, total, loading, paged } = useMusicPagedResource<Song>(page, loadPage, [source, playlistId]);

  return loading ? <MusicLoadingIndicator className="py-8" /> : (
    <div>
      <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-2">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-xl font-bold text-white/80 tracking-tight truncate max-w-md">{title}</h2>
          <span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded text-white shrink-0">{total} 首歌曲</span>
        </div>
        <button
          onClick={() => playMusicList(allItems, title)}
          disabled={allItems.length === 0}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm text-white shrink-0"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          播放全部
        </button>
      </div>
      <SongList songs={paged.items} startIndex={paged.startIndex} />
      <MusicPaginationBar
        totalItems={total}
        page={paged.page}
        onPageChanged={(next) =>
          router.push(
            withPageQuery(
              `/music/rankings/${source}/${encodeURIComponent(playlistId)}?name=${encodeURIComponent(title)}`,
              next
            )
          )
        }
      />
    </div>
  );
}
