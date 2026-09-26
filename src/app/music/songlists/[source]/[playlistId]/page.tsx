'use client';

import { Play } from 'lucide-react';
import { useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

import MusicEmpty, { MusicRowListSkeleton } from '@/components/music/MusicEmpty';
import MusicPage from '@/components/music/MusicPage';
import MusicPaginationBar from '@/components/music/MusicPaginationBar';
import SongList from '@/components/music/SongList';
import { useMusicPagedResource } from '@/components/music/useMusicPagedResource';
import { MUSIC_BUTTON, MUSIC_COUNT } from '@/components/music/tokens';
import { playMusicList } from '@/lib/music/actions';
import { parsePageParam, withPageQuery } from '@/lib/music-page-data';
import { mapSong, musicSources, normalizeSource } from '@/lib/music/shared';
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
  const sourceLabel = musicSources.find((item) => item.key === source)?.label || source;
  const href = `/music/songlists/${source}/${encodeURIComponent(playlistId)}?name=${encodeURIComponent(title)}`;

  return (
    <MusicPage
      title={title}
      subtitle={`歌单 · ${sourceLabel}`}
      actions={
        <>
          <span className={MUSIC_COUNT}>{total} 首</span>
          <button
            type='button'
            onClick={() => playMusicList(allItems, title)}
            disabled={allItems.length === 0}
            className={MUSIC_BUTTON}
          >
            <Play className='h-3.5 w-3.5' strokeWidth={2.2} />
            播放全部
          </button>
        </>
      }
    >
      {loading ? (
        <MusicRowListSkeleton count={10} />
      ) : paged.items.length > 0 ? (
        <>
          <SongList songs={paged.items} startIndex={paged.startIndex} />
          <MusicPaginationBar
            totalItems={total}
            page={paged.page}
            onPageChanged={(next) => router.push(withPageQuery(href, next))}
          />
        </>
      ) : (
        <MusicEmpty
          title='这个歌单是空的'
          hint='当前音源无法获取此歌单的曲目，换一个歌单试试。'
        />
      )}
    </MusicPage>
  );
}
