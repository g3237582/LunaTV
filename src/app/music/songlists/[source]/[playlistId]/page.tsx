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

export default function MusicSongListDetailPage() {
  const router = useRouter();
  const params = useParams<{ source: string; playlistId: string }>();
  const searchParams = useSearchParams();
  const source = normalizeSource(params.source);
  const playlistId = decodeURIComponent(params.playlistId);
  const title = searchParams.get('name') || '歌单详情';
  const page = parsePageParam(searchParams.get('page'));

  const loadPage = useCallback(async (nextPage: number) => {
    const res = await fetch(
      `/api/music/v2/discovery/songlist-detail?source=${source}&id=${encodeURIComponent(playlistId)}&page=${nextPage}`
    );
    const data = await res.json();
    const list = data.success
      ? ((data.data?.list || []) as Parameters<typeof mapSong>[0][]).map(mapSong)
      : [];
    return {
      list,
      total: Number(data.data?.total || list.length),
      limit: Number(data.data?.limit || list.length),
    };
  }, [source, playlistId]);

  const { allItems, total, loading, paged } = useMusicPagedResource<Song>(page, loadPage, [source, playlistId]);

  return loading ? (
    <MusicLoadingIndicator className="py-8" />
  ) : (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="min-w-0">
          <div className="text-2xl font-black text-white tracking-tight truncate">{title}</div>
          <div className="mt-1 text-sm text-zinc-500">{total} 首歌曲</div>
        </div>
        <button
          onClick={() => playMusicList(allItems, title)}
          disabled={allItems.length === 0}
          className="rounded-xl bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
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
              `/music/songlists/${source}/${encodeURIComponent(playlistId)}?name=${encodeURIComponent(title)}`,
              next
            )
          )
        }
      />
    </div>
  );
}
