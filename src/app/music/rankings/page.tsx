'use client';

import { ListMusic } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { musicSources, normalizeSource } from '@/lib/music/shared';
import type { Playlist } from '@/lib/music/types';
import {
  mergeBoardCovers,
  missingBoardCoverIds,
  preserveBoardCovers,
} from '@/lib/music-board-cover';
import {
  parsePageParam,
  sliceMusicPage,
  withPageQuery,
} from '@/lib/music-page-data';

import MusicEmpty, {
  MusicSleeveGridSkeleton,
} from '@/components/music/MusicEmpty';
import MusicPage from '@/components/music/MusicPage';
import MusicPaginationBar from '@/components/music/MusicPaginationBar';
import MusicSwitch from '@/components/music/MusicSwitch';
import SleeveCard from '@/components/music/SleeveCard';
import { MUSIC_SLEEVE_GRID } from '@/components/music/tokens';

const BOARDS_CACHE_TTL = 10 * 60 * 1000;

function readBoardsCache(source: string): Playlist[] | null {
  try {
    const raw = localStorage.getItem(`music_boards_${source}`);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - Number(cached.timestamp || 0) > BOARDS_CACHE_TTL)
      return null;
    return Array.isArray(cached.data) ? cached.data : null;
  } catch {
    return null;
  }
}

function writeBoardsCache(source: string, data: Playlist[]) {
  try {
    localStorage.setItem(
      `music_boards_${source}`,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch {
    // ignore quota
  }
}

function mapBoards(
  data: {
    data?: {
      source?: string;
      list?: Array<{
        id?: string;
        name?: string;
        source?: string;
        cover?: string;
        pic?: string;
        updateFrequency?: string;
        description?: string;
      }>;
    };
  },
  fallbackSource: string
): Playlist[] {
  return (data?.data?.list || []).map((item) => ({
    id: item.id || '',
    name: item.name || '',
    source: normalizeSource(
      item.source || data?.data?.source || fallbackSource
    ),
    updateFrequency: item.updateFrequency || item.description || '',
    cover: typeof item.cover === 'string' ? item.cover : '',
    pic: typeof item.pic === 'string' ? item.pic : '',
  }));
}

/** 榜单卡的键名方块用音源缩写，和音源切换共用一套标识。 */
const sourceOptions = musicSources.map((item) => ({
  key: item.key,
  label: item.label,
  monogram: item.monogram,
}));

export default function MusicRankingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentSource, setCurrentSource] = useState(
    normalizeSource(searchParams.get('source'))
  );
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  // 初值是 true：这页挂载即发请求，给 false 会先用"长度为 0"的判断渲染一帧空态
  // （"无法获取此榜单"），effect 跑起来才切成骨架。骨架才是真正的初始态。
  const [loading, setLoading] = useState(true);
  const coverAttempted = useRef(new Set<string>());

  const page = parsePageParam(searchParams.get('page'));
  const paged = sliceMusicPage(playlists, page);
  const visibleCoverKey = paged.items
    .map((item) => `${item.id}:${item.cover || item.pic || ''}`)
    .join('|');

  useEffect(() => {
    const source = normalizeSource(searchParams.get('source'));
    setCurrentSource(source);
    const cached = readBoardsCache(source);
    if (cached?.length) {
      setPlaylists(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    fetch(`/api/music/v2/discovery/boards?source=${source}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPlaylists((prev) => {
            const next = preserveBoardCovers(
              prev,
              mapBoards(data, source),
              source
            );
            writeBoardsCache(source, next);
            return next;
          });
        } else if (!cached?.length) {
          setPlaylists([]);
        }
      })
      .catch(() => {
        if (!cached?.length) setPlaylists([]);
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  // 榜单列表没有封面。当前页缺图的项再向榜内第一首歌要专辑图，不挡住列表本身。
  useEffect(() => {
    const ids = missingBoardCoverIds(paged.items).filter(
      (id) => !coverAttempted.current.has(`${currentSource}:${id}`)
    );
    if (ids.length === 0) return;

    ids.forEach((id) => coverAttempted.current.add(`${currentSource}:${id}`));
    let cancelled = false;
    const source = currentSource;
    fetch(
      `/api/music/v2/discovery/board-covers?source=${source}&ids=${encodeURIComponent(
        ids.join(',')
      )}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data?.success) {
          ids.forEach((id) => coverAttempted.current.delete(`${source}:${id}`));
          return;
        }
        setPlaylists((prev) => {
          const merged = mergeBoardCovers(prev, data.data?.covers || {});
          if (!merged.changed) return prev;
          writeBoardsCache(source, merged.boards);
          return merged.boards;
        });
      })
      .catch(() => {
        if (!cancelled) {
          ids.forEach((id) => coverAttempted.current.delete(`${source}:${id}`));
        }
      });

    return () => {
      cancelled = true;
    };
    // visibleCoverKey 把「当前页有哪些榜、哪些已经有图」收成稳定依赖。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSource, visibleCoverKey]);

  const currentSourceLabel =
    musicSources.find((item) => item.key === currentSource)?.label || '音源';

  return (
    <MusicPage
      title='热歌榜单'
      subtitle={`Side A · ${currentSourceLabel}`}
      actions={
        <MusicSwitch
          field='音源'
          value={currentSource}
          options={sourceOptions}
          onChange={(next) => router.push(`/music/rankings?source=${next}`)}
        />
      }
    >
      {loading ? (
        <MusicSleeveGridSkeleton count={10} />
      ) : playlists.length > 0 ? (
        <div className={MUSIC_SLEEVE_GRID}>
          {paged.items.map((playlist, index) => (
            <SleeveCard
              key={playlist.id}
              rank={paged.startIndex + index + 1}
              name={playlist.name}
              cover={playlist.cover || playlist.pic}
              top={
                musicSources.find((item) => item.key === playlist.source)
                  ?.label || currentSourceLabel
              }
              meta={playlist.updateFrequency}
              onOpen={() =>
                router.push(
                  `/music/rankings/${
                    playlist.source || currentSource
                  }/${encodeURIComponent(
                    playlist.id
                  )}?name=${encodeURIComponent(playlist.name)}`
                )
              }
            />
          ))}
        </div>
      ) : (
        <MusicEmpty
          icon={ListMusic}
          title='当前音源无法获取此榜单'
          hint='换一个音源试试，或者稍后再来——上游榜单接口有时会空一阵。'
        />
      )}
      <MusicPaginationBar
        totalItems={playlists.length}
        page={paged.page}
        onPageChanged={(next) =>
          router.push(
            withPageQuery(`/music/rankings?source=${currentSource}`, next)
          )
        }
      />
    </MusicPage>
  );
}
