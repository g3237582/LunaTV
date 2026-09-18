'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  mergeMusicPages,
  sliceMusicPage,
  type MusicPagePayload,
} from '@/lib/music-page-data';

export function useMusicPagedResource<T>(
  page: number,
  loadPage: (page: number) => Promise<MusicPagePayload<T>>,
  resourceKey: Array<string | number>
) {
  const [allItems, setAllItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setAllItems([]);
    setTotal(0);

    loadPage(page)
      .then(async (first) => {
        if (cancelled) return;
        const nextTotal = first.total || first.list.length;
        setAllItems(first.list);
        setTotal(nextTotal);
        setLoading(false);
        if (first.list.length < nextTotal) {
          const merged = await mergeMusicPages(page, { ...first, total: nextTotal }, loadPage);
          if (!cancelled) setAllItems(merged);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setAllItems([]);
        setTotal(0);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Resource identity only: page changes should slice already-loaded songs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resourceKey);

  const paged = useMemo(() => sliceMusicPage(allItems, page), [allItems, page]);

  return { allItems, total: total || allItems.length, loading, paged };
}
