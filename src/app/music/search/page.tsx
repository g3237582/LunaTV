'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Flame, RefreshCw } from 'lucide-react';
import { playMusicList } from '@/lib/music/actions';
import MusicLoadingIndicator from '@/components/music/MusicLoadingIndicator';
import MusicPaginationBar from '@/components/music/MusicPaginationBar';
import SongList from '@/components/music/SongList';
import {
  MUSIC_LIST_PAGE_SIZE,
  nextPrefetchPages,
  parsePageParam,
  sliceMusicPage,
  withPageQuery,
} from '@/lib/music-page-data';
import { mapSong, musicSources, normalizeSource } from '@/lib/music/shared';
import type { Song } from '@/lib/music/types';

type HotSearchItem = { keyword: string; artist?: string };
type SearchType = 'song' | 'singer' | 'album';
type SingerResult = {
  id: string | number;
  mid?: string;
  name: string;
  picUrl?: string;
  alias?: string[];
  albumSize?: number;
  source?: string;
};
type AlbumResult = {
  id: string | number;
  mid?: string;
  name: string;
  picUrl?: string;
  artistName?: string;
  size?: number;
  publishTime?: string | number;
  source?: string;
};

const HOT_SEARCH_CACHE_DURATION = 60 * 60 * 1000;
const HOT_SEARCH_LIMIT = 20;
const searchTypeOptions: Array<{ key: SearchType; label: string }> = [
  { key: 'song', label: '歌曲' },
  { key: 'singer', label: '歌手' },
  { key: 'album', label: '专辑' },
];

function getHotSearchCacheKey(source: string) {
  return `music_hot_search_${source}`;
}

function formatPublishTime(value?: string | number) {
  if (!value) return '';
  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function SingerGrid({ singers, onOpen }: { singers: SingerResult[]; onOpen: (singer: SingerResult) => void }) {
  if (singers.length === 0) return <div className="py-16 text-center text-sm text-zinc-500">暂无歌手结果</div>;

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
      {singers.map((singer, index) => (
        <div
          key={`${singer.source || 'wy'}-${singer.id}-${index}`}
          onClick={() => onOpen(singer)}
          className="group flex cursor-pointer flex-col items-center rounded-2xl border border-transparent p-2 transition-all hover:border-emerald-500/30 hover:bg-white/5 hover:shadow-md md:p-4"
        >
          <div className="mb-3 h-20 w-20 overflow-hidden rounded-full bg-white/10 shadow-sm sm:h-24 sm:w-24 md:h-32 md:w-32">
            {singer.picUrl ? (
              <img
                src={singer.picUrl}
                alt={singer.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl text-zinc-500">♪</div>
            )}
          </div>
          <div className="w-full truncate text-center text-sm font-bold text-white" title={singer.name}>{singer.name}</div>
          {singer.alias?.[0] && (
            <div className="mt-1 w-full truncate text-center text-[10px] text-zinc-500">{singer.alias[0]}</div>
          )}
          <div className="mt-2 text-[10px] text-zinc-500">{singer.albumSize || 0} 专辑</div>
        </div>
      ))}
    </div>
  );
}

function AlbumGrid({ albums, onOpen }: { albums: AlbumResult[]; onOpen: (album: AlbumResult) => void }) {
  if (albums.length === 0) return <div className="py-16 text-center text-sm text-zinc-500">暂无专辑结果</div>;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {albums.map((album, index) => (
        <div
          key={`${album.source || 'wy'}-${album.id}-${index}`}
          onClick={() => onOpen(album)}
          className="group flex cursor-pointer flex-col rounded-2xl border border-transparent p-3 transition-all hover:border-emerald-500/20 hover:bg-white/5 hover:shadow-lg"
        >
          <div className="mb-3 aspect-square overflow-hidden rounded-xl bg-white/10 shadow-md">
            {album.picUrl ? (
              <img
                src={album.picUrl}
                alt={album.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl text-zinc-500">♪</div>
            )}
          </div>
          <div className="line-clamp-2 h-10 text-sm font-bold leading-5 text-white" title={album.name}>{album.name}</div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-zinc-500">
            <span className="truncate">{album.artistName || '未知歌手'}</span>
            <span className="shrink-0">{formatPublishTime(album.publishTime)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MusicSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = normalizeSource(searchParams.get('source'));
  const q = searchParams.get('q') || '';
  const page = parsePageParam(searchParams.get('page'));
  const searchType = (['song', 'singer', 'album'].includes(searchParams.get('type') || '')
    ? searchParams.get('type')
    : 'song') as SearchType;
  const [keyword, setKeyword] = useState(q);
  const [selectedSource, setSelectedSource] = useState(source);
  const [selectedType, setSelectedType] = useState<SearchType>(searchType);
  const [songs, setSongs] = useState<Song[]>([]);
  const [singers, setSingers] = useState<SingerResult[]>([]);
  const [albums, setAlbums] = useState<AlbumResult[]>([]);
  const [hotSearches, setHotSearches] = useState<HotSearchItem[]>([]);
  const [hotLoading, setHotLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailPage, setDetailPage] = useState(1);

  const loadHotSearch = async (forceRefresh = false) => {
    const cacheKey = getHotSearchCacheKey(source);
    let cachedData: HotSearchItem[] | null = null;
    let cacheExpired = true;

    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Array.isArray(data)) {
            cachedData = data;
            cacheExpired = Date.now() - Number(timestamp || 0) > HOT_SEARCH_CACHE_DURATION;
          }
        }
      } catch {
        cachedData = null;
      }
    }

    if (cachedData) {
      setHotSearches(cachedData);
      setHotLoading(false);
    } else {
      setHotSearches([]);
      setHotLoading(true);
    }

    if (!cachedData || cacheExpired || forceRefresh) {
      try {
        const res = await fetch(`/api/music/v2/discovery/hot-search?source=${source}`);
        const data = await res.json();
        if (data.success) {
          const nextHotSearches = (data.data?.list || []).slice(0, HOT_SEARCH_LIMIT);
          setHotSearches(nextHotSearches);
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ data: nextHotSearches, timestamp: Date.now() }));
          } catch {
            // ignore cache write failure
          }
        } else if (!cachedData) {
          setHotSearches([]);
        }
      } catch {
        if (!cachedData) setHotSearches([]);
      } finally {
        setHotLoading(false);
      }
    }
  };

  const loadSearchPage = useCallback(async (pageNum: number, signal?: AbortSignal) => {
    if (!q) return;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/music/v2/search?source=${source}&q=${encodeURIComponent(q)}&type=${searchType}&page=${pageNum}&limit=${MUSIC_LIST_PAGE_SIZE}`,
        { signal }
      );
      const data = await res.json();
      const list = data.data?.list || [];
      const nextHasMore = Boolean(data.data?.hasMore);

      if (searchType === 'singer') {
        setSingers(list);
        setAlbums([]);
        setSongs([]);
      } else if (searchType === 'album') {
        setAlbums(list);
        setSingers([]);
        setSongs([]);
      } else {
        setSongs(list.map(mapSong));
        setSingers([]);
        setAlbums([]);
      }

      setHasMore(nextHasMore);
      if (nextHasMore) {
        nextPrefetchPages(pageNum, pageNum + 1).forEach((nextPage) => {
          void fetch(
            `/api/music/v2/search?source=${source}&q=${encodeURIComponent(q)}&type=${searchType}&page=${nextPage}&limit=${MUSIC_LIST_PAGE_SIZE}`
          );
        });
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        setSongs([]);
        setSingers([]);
        setAlbums([]);
        setHasMore(false);
      }
    } finally {
      setLoading(false);
    }
  }, [source, q, searchType]);

  useEffect(() => {
    setSelectedSource(source);
    setSelectedType(searchType);
    setKeyword(q);
    setDetailPage(1);

    if (!q) {
      setSongs([]);
      setSingers([]);
      setAlbums([]);
      setDetailTitle('');
      setHasMore(false);
      void loadHotSearch();
      return;
    }

    const controller = new AbortController();
    setDetailTitle('');
    void loadSearchPage(page, controller.signal);
    return () => controller.abort();
  }, [source, q, searchType, page, loadSearchPage]);

  const submit = () => {
    const next = keyword.trim();
    if (next) router.push(`/music/search?source=${selectedSource}&type=${selectedType}&q=${encodeURIComponent(next)}`);
  };

  const changeSource = (nextSource: string) => {
    let normalizedSource = normalizeSource(nextSource);
    if ((selectedType === 'singer' || selectedType === 'album') && normalizedSource !== 'wy' && normalizedSource !== 'tx') {
      normalizedSource = 'wy';
    }
    const next = keyword.trim() || q;
    setSelectedSource(normalizedSource);
    setShowSourceMenu(false);
    router.push(`/music/search?source=${normalizedSource}&type=${selectedType}${next ? `&q=${encodeURIComponent(next)}` : ''}`);
  };

  const changeType = (nextType: SearchType) => {
    let nextSource = selectedSource;
    if ((nextType === 'singer' || nextType === 'album') && nextSource !== 'wy' && nextSource !== 'tx') {
      nextSource = 'wy';
      setSelectedSource(nextSource);
    }
    const next = keyword.trim() || q;
    setSelectedType(nextType);
    setShowTypeMenu(false);
    if (next) {
      setLoading(true);
      if (nextType === 'song') {
        setSingers([]);
        setAlbums([]);
      } else if (nextType === 'singer') {
        setSongs([]);
        setAlbums([]);
      } else {
        setSongs([]);
        setSingers([]);
      }
    }
    router.push(`/music/search?source=${nextSource}&type=${nextType}${next ? `&q=${encodeURIComponent(next)}` : ''}`);
  };

  const openSinger = async (singer: SingerResult) => {
    setDetailTitle(`${singer.name} - 热门歌曲`);
    setSingers([]);
    setAlbums([]);
    setSongs([]);
    setHasMore(false);
    setDetailPage(1);
    setLoading(true);
    try {
      const itemSource = normalizeSource(singer.source || selectedSource);
      const res = await fetch(`/api/music/v2/discovery/artist-songs?source=${itemSource}&id=${encodeURIComponent(String(singer.id))}`);
      const data = await res.json();
      const nextSongs = (data.data?.list || []).map(mapSong);
      setSongs(nextSongs);
    } catch {
      setSongs([]);
    } finally {
      setLoading(false);
    }
  };

  const openAlbum = async (album: AlbumResult) => {
    setDetailTitle(album.name);
    setSingers([]);
    setAlbums([]);
    setSongs([]);
    setHasMore(false);
    setDetailPage(1);
    setLoading(true);
    try {
      const itemSource = normalizeSource(album.source || selectedSource);
      const res = await fetch(`/api/music/v2/discovery/album-songs?source=${itemSource}&id=${encodeURIComponent(String(album.id))}`);
      const data = await res.json();
      const nextSongs = (data.data?.list || []).map(mapSong);
      setSongs(nextSongs);
    } catch {
      setSongs([]);
    } finally {
      setLoading(false);
    }
  };

  const currentSourceLabel = musicSources.find((item) => item.key === selectedSource)?.label || '音源';
  const currentTypeLabel = searchTypeOptions.find((item) => item.key === selectedType)?.label || '歌曲';
  const detailPaged = sliceMusicPage(songs, detailPage);
  const searchHref = `/music/search?source=${source}&type=${searchType}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  const resultCount = detailTitle
    ? songs.length
    : selectedType === 'song'
      ? songs.length
      : selectedType === 'singer'
        ? singers.length
        : albums.length;
  const resultUnit = selectedType === 'song' || detailTitle ? '首结果' : selectedType === 'singer' ? '个歌手' : '张专辑';

  return (
    <div className="animate-in fade-in duration-500 relative z-10">
      <div className="mb-8 flex items-center gap-3 relative z-50">
        <div className="relative flex-1 flex items-center bg-[rgba(0,0,0,0.04)] dark:bg-[rgba(255,255,255,0.06)] rounded-[8px] pl-3 border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] focus-within:border-green-500 focus-within:ring-0 transition-all shadow-sm">
          <svg className="w-4 h-4 opacity-40 text-black dark:text-white mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input 
            value={keyword} 
            onChange={(e) => setKeyword(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && submit()} 
            className="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-[14px] py-2 text-black dark:text-white placeholder-[rgba(0,0,0,0.4)] dark:placeholder-[rgba(255,255,255,0.4)]" 
            placeholder="搜索歌曲或艺术家..." 
          />
          
          <div className="w-px h-5 bg-[rgba(0,0,0,0.1)] dark:bg-[rgba(255,255,255,0.1)] mx-1 shrink-0" />
          
          <div className="relative h-full flex items-center pr-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowSourceMenu((open) => !open)}
              className="flex h-[32px] items-center gap-1.5 px-2.5 rounded-[6px] hover:bg-[rgba(0,0,0,0.06)] dark:hover:bg-[rgba(255,255,255,0.08)] transition-all"
              aria-haspopup="listbox"
              aria-expanded={showSourceMenu}
            >
              <span className="text-[13px] font-medium text-black dark:text-white">{currentSourceLabel}</span>
              <svg className="w-3.5 h-3.5 opacity-50 text-black dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </button>
            
            {showSourceMenu && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setShowSourceMenu(false)}
                  aria-label="关闭菜单"
                />
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-32 p-1.5 overflow-hidden rounded-xl bg-[rgba(255,255,255,0.85)] dark:bg-[rgba(35,35,35,0.85)] backdrop-blur-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[rgba(0,0,0,0.1)] dark:border-[rgba(255,255,255,0.15)] animate-in fade-in zoom-in-95 duration-100 origin-top-right" role="listbox">
                  {musicSources.map((item) => {
                    const active = selectedSource === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => {
                          setShowSourceMenu(false);
                          changeSource(item.key);
                        }}
                        className="group flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] text-black dark:text-white hover:bg-green-500 hover:text-white transition-none"
                        role="option"
                        aria-selected={active}
                      >
                        <span className="whitespace-nowrap">{item.label}</span>
                        {active && (
                          <svg className="h-3.5 w-3.5 text-black dark:text-white group-hover:text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <div className="w-px h-5 bg-[rgba(0,0,0,0.1)] dark:bg-[rgba(255,255,255,0.1)] mx-1 shrink-0" />

          <div className="relative h-full flex items-center pr-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowTypeMenu((open) => !open)}
              className="flex h-[32px] items-center gap-1.5 px-2.5 rounded-[6px] hover:bg-[rgba(0,0,0,0.06)] dark:hover:bg-[rgba(255,255,255,0.08)] transition-all"
              aria-haspopup="listbox"
              aria-expanded={showTypeMenu}
            >
              <span className="text-[13px] font-medium text-black dark:text-white">{currentTypeLabel}</span>
              <svg className="w-3.5 h-3.5 opacity-50 text-black dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </button>

            {showTypeMenu && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setShowTypeMenu(false)}
                  aria-label="关闭类型菜单"
                />
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-24 p-1.5 overflow-hidden rounded-xl bg-[rgba(255,255,255,0.85)] dark:bg-[rgba(35,35,35,0.85)] backdrop-blur-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[rgba(0,0,0,0.1)] dark:border-[rgba(255,255,255,0.15)] animate-in fade-in zoom-in-95 duration-100 origin-top-right" role="listbox">
                  {searchTypeOptions.map((item) => {
                    const active = selectedType === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => changeType(item.key)}
                        className="group flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] text-black dark:text-white hover:bg-green-500 hover:text-white transition-none"
                        role="option"
                        aria-selected={active}
                      >
                        <span className="whitespace-nowrap">{item.label}</span>
                        {active && (
                          <svg className="h-3.5 w-3.5 text-black dark:text-white group-hover:text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 border-b border-white/10 pb-4">
        <div className="flex items-center gap-4 min-w-0">
          <h2 className="text-2xl font-black text-white tracking-tight truncate max-w-md">
            {detailTitle || (q ? `搜索: ${q}` : '发现音乐')}
          </h2>
          {resultCount > 0 && (
            <span className="px-2.5 py-1 text-xs font-bold bg-white/10 text-green-500 rounded-full border border-green-500/20 shrink-0">
              {resultCount} {resultUnit}
            </span>
          )}
        </div>
        {(selectedType === 'song' || detailTitle) && (
          <button
            onClick={() => playMusicList(songs, q ? `搜索: ${q}` : '搜索结果')}
            disabled={songs.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-white transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            播放全部
          </button>
        )}
      </div>
      {loading ? (
        <MusicLoadingIndicator className="py-16" />
      ) : q ? (
        selectedType === 'singer' ? (
          detailTitle ? <SongList songs={detailPaged.items} startIndex={detailPaged.startIndex} /> : <SingerGrid singers={singers} onOpen={openSinger} />
        ) : selectedType === 'album' ? (
          detailTitle ? <SongList songs={detailPaged.items} startIndex={detailPaged.startIndex} /> : <AlbumGrid albums={albums} onOpen={openAlbum} />
        ) : (
          <SongList songs={songs} startIndex={(page - 1) * MUSIC_LIST_PAGE_SIZE} />
        )
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 md:p-6 backdrop-blur-sm">
          <div className="mb-5 flex items-center gap-3">
            <Flame className="h-6 w-6 shrink-0 text-orange-500" />
            <div className="min-w-0">
              <div className="text-xl font-bold text-white">热门搜索</div>
              <div className="text-sm text-zinc-500">当前音源：{currentSourceLabel}</div>
            </div>
          </div>
          {hotLoading ? (
            <MusicLoadingIndicator className="py-10" />
          ) : hotSearches.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 md:gap-3">
              {hotSearches.map((item, index) => (
                <button
                  key={`${item.keyword}-${index}`}
                  onClick={() => {
                    setKeyword(item.keyword);
                    router.push(`/music/search?source=${source}&type=${selectedType}&q=${encodeURIComponent(item.keyword)}`);
                  }}
                  className="group flex h-14 items-center overflow-hidden rounded-lg border border-white/10 bg-white/5 px-2.5 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-500/10 hover:shadow-md"
                >
                  <span className={`mr-3 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${index < 3 ? 'bg-gradient-to-r from-orange-400 to-red-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-white group-hover:text-emerald-300">
                    {item.keyword}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-zinc-500">暂无热搜数据</div>
          )}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => void loadHotSearch(true)}
              className="text-sm text-zinc-400 transition-colors hover:text-emerald-400"
            >
              <RefreshCw className="mr-1 inline-block h-4 w-4" />
              刷新热搜
            </button>
          </div>
        </div>
      )}
      {detailTitle ? (
        <MusicPaginationBar
          totalItems={songs.length}
          page={detailPaged.page}
          onPageChanged={setDetailPage}
        />
      ) : q ? (
        <MusicPaginationBar
          page={page}
          hasMore={hasMore}
          onPageChanged={(next) => router.push(withPageQuery(searchHref, next))}
        />
      ) : (
        <MusicPaginationBar
          totalItems={hotSearches.length}
          page={1}
          onPageChanged={() => undefined}
        />
      )}
    </div>
  );
}
