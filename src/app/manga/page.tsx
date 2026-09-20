'use client';

import { Flame, Sparkles } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { deleteMangaShelf, getAllMangaShelf, saveMangaShelf } from '@/lib/db.client';
import {
  MangaRecommendResult,
  MangaRecommendType,
  MangaSearchItem,
  MangaShelfItem,
  MangaSource,
} from '@/lib/manga.types';

import CapsuleSwitch from '@/components/CapsuleSwitch';
import MangaCard from '@/components/MangaCard';
import MusicPaginationBar from '@/components/music/MusicPaginationBar';
import { loadInParallel, nextPrefetchPages } from '@/lib/music-page-data';

function MangaCardSkeleton({ withButton = false }: { withButton?: boolean }) {
  return (
    <div className='space-y-2'>
      <div className='overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950'>
        <div className='aspect-[3/4] w-full animate-pulse bg-gray-200 dark:bg-gray-800' />
        <div className='space-y-3 p-3'>
          <div className='h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-800' />
          <div className='h-3 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-800' />
        </div>
      </div>
      {withButton && <div className='h-9 w-full animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800' />}
    </div>
  );
}

export default function MangaRecommendPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sources, setSources] = useState<MangaSource[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [recommendType, setRecommendType] = useState<MangaRecommendType>('POPULAR');
  const [result, setResult] = useState<MangaRecommendResult>({ mangas: [], hasNextPage: false });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [shelf, setShelf] = useState<Record<string, MangaShelfItem>>({});

  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).RUNTIME_CONFIG?.SUWAYOMI_ENABLED) {
      router.replace('/');
    }
  }, [router]);

  useEffect(() => {
    const query = searchParams.get('q')?.trim();
    if (!query) return;

    const params = new URLSearchParams(searchParams.toString());
    router.replace(`/manga/search?${params.toString()}`);
  }, [router, searchParams]);

  useEffect(() => {
    void loadInParallel({
      sources: async () => {
        const res = await fetch('/api/manga/sources');
        return res.json();
      },
      shelf: () => getAllMangaShelf(),
    }).then((result) => {
      const nextSources = (result.sources as { sources?: MangaSource[] } | null)?.sources || [];
      setSources(nextSources);
      setSourceId((prev) => prev || nextSources[0]?.id || '');
      if (result.shelf) setShelf(result.shelf);
    });
  }, []);

  const fetchRecommend = useCallback(async (nextPage: number, append: boolean) => {
    if (!sourceId) return;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError('');
    }

    try {
      const params = new URLSearchParams({
        sourceId,
        type: recommendType,
        page: String(nextPage),
      });
      const res = await fetch(`/api/manga/recommend?${params.toString()}`);
      const data = (await res.json()) as MangaRecommendResult & { error?: string };
      if (!res.ok) throw new Error(data.error || '获取推荐失败');

      setPage(nextPage);
      setResult({
        mangas: data.mangas,
        hasNextPage: data.hasNextPage,
      });
      if (data.hasNextPage) {
        nextPrefetchPages(nextPage, nextPage + 1).forEach((prefetchPage) => {
          const prefetch = new URLSearchParams({
            sourceId,
            type: recommendType,
            page: String(prefetchPage),
          });
          void fetch(`/api/manga/recommend?${prefetch.toString()}`);
        });
      }
    } catch (err) {
      setError((err as Error).message);
      if (!append) {
        setResult({ mangas: [], hasNextPage: false });
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [recommendType, sourceId]);

  useEffect(() => {
    if (!sourceId) return;
    void fetchRecommend(1, false);
  }, [fetchRecommend, sourceId]);

  const sourceOptions = useMemo(
    () =>
      sources.map((source) => ({
        label: source.displayName || source.name,
        value: source.id,
      })),
    [sources]
  );

  const recommendOptions = [
    { label: '热门', value: 'POPULAR', icon: <Flame className='h-3.5 w-3.5' /> },
    { label: '最新', value: 'LATEST', icon: <Sparkles className='h-3.5 w-3.5' /> },
  ];

  const toggleShelf = async (item: MangaSearchItem) => {
    const key = `${item.sourceId}+${item.id}`;
    if (shelf[key]) {
      await deleteMangaShelf(item.sourceId, item.id);
      setShelf((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    const shelfItem: MangaShelfItem = {
      title: item.title,
      cover: item.cover,
      sourceId: item.sourceId,
      sourceName: item.sourceName,
      mangaId: item.id,
      saveTime: Date.now(),
      description: item.description,
      author: item.author,
      status: item.status,
    };
    await saveMangaShelf(item.sourceId, item.id, shelfItem);
    setShelf((prev) => ({ ...prev, [key]: shelfItem }));
  };

  return (
    <div className='mx-auto max-w-6xl space-y-6'>
      <section className='space-y-4 rounded-3xl border border-gray-200/70 bg-white/80 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950/70 sm:p-5'>
        <div className='space-y-2'>
          <div className='text-sm font-medium text-gray-700 dark:text-gray-200'>漫画源</div>
          {sourceOptions.length > 0 ? (
            <CapsuleSwitch options={sourceOptions} active={sourceId} onChange={setSourceId} className='max-w-full' />
          ) : (
            <div className='rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400'>
              暂无可用漫画源
            </div>
          )}
        </div>

        <div className='space-y-2'>
          <div className='text-sm font-medium text-gray-700 dark:text-gray-200'>推荐类型</div>
          <CapsuleSwitch
            options={recommendOptions}
            active={recommendType}
            onChange={(value) => setRecommendType(value as MangaRecommendType)}
          />
        </div>
      </section>

      <section>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-lg font-semibold'>推荐内容</h2>
        </div>

        {error && <div className='mb-4 text-sm text-red-500'>{error}</div>}

        {loading ? (
          <div className='grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6'>
            {Array.from({ length: 12 }).map((_, index) => (
              <MangaCardSkeleton key={index} withButton />
            ))}
          </div>
        ) : result.mangas.length === 0 ? (
          <div className='rounded-2xl bg-gray-50 p-10 text-center text-sm text-gray-500 dark:bg-gray-900/50'>
            {sourceId ? '当前源暂无推荐内容' : '请先选择漫画源'}
          </div>
        ) : (
          <>
            <div className='grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6'>
              {result.mangas.map((item) => {
                const key = `${item.sourceId}+${item.id}`;
                return (
                  <div key={key} className='space-y-2'>
                    <MangaCard
                      item={item}
                      href={`/manga/detail?mangaId=${item.id}&sourceId=${item.sourceId}&title=${encodeURIComponent(item.title)}&cover=${encodeURIComponent(item.cover)}&sourceName=${encodeURIComponent(item.sourceName)}&description=${encodeURIComponent(item.description || '')}&author=${encodeURIComponent(item.author || '')}&status=${encodeURIComponent(item.status || '')}&returnTo=${encodeURIComponent('/manga')}`}
                      subtitle={item.author || item.status || item.description}
                      badge={recommendType === 'POPULAR' ? '热门' : '最新'}
                    />
                    <button
                      onClick={() => toggleShelf(item)}
                      className='w-full rounded-2xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:border-sky-500 hover:text-sky-600 dark:border-gray-700 dark:text-gray-200'
                    >
                      {shelf[key] ? '移出书架' : '加入书架'}
                    </button>
                  </div>
                );
              })}
            </div>

            {loadingMore ? (
              <div className='mt-6 text-center text-sm text-gray-500'>正在加载...</div>
            ) : null}
            <MusicPaginationBar
              page={page}
              hasMore={result.hasNextPage}
              onPageChanged={(next) => void fetchRecommend(next, false)}
            />
          </>
        )}
      </section>
    </div>
  );
}
