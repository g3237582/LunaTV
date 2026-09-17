import { useEffect, useMemo, useState } from 'react';

import { fromLuma, rgbaToLuma } from '@/lib/poster-dhash';
import { SearchResult } from '@/lib/types';

const CACHE = new Map<string, string>();
const INFLIGHT = new Set<string>();
const MAX_INFLIGHT = 3;
const MAX_PER_BATCH = 80;

export function usePosterHashes(
  results: SearchResult[]
): Record<string, string> {
  const [hashes, setHashes] = useState<Record<string, string>>(() =>
    Object.fromEntries(CACHE)
  );

  const posters = useMemo(() => {
    const unique = new Set<string>();
    results.forEach((item) => {
      const poster = item.poster?.trim();
      if (poster) {
        unique.add(poster);
      }
    });
    return Array.from(unique);
  }, [results]);

  useEffect(() => {
    let cancelled = false;
    const pending = posters
      .filter((url) => !CACHE.has(url) && !INFLIGHT.has(url))
      .slice(0, MAX_PER_BATCH);
    if (pending.length === 0) {
      return undefined;
    }

    const run = async () => {
      let cursor = 0;
      const worker = async () => {
        while (cursor < pending.length && !cancelled) {
          const url = pending[cursor];
          cursor += 1;
          INFLIGHT.add(url);
          try {
            const hash = await hashPoster(url);
            if (hash) {
              CACHE.set(url, hash);
              if (!cancelled) {
                setHashes(Object.fromEntries(CACHE));
              }
            }
          } finally {
            INFLIGHT.delete(url);
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(MAX_INFLIGHT, pending.length) }, () =>
          worker()
        )
      );
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [posters]);

  return hashes;
}

function hashPoster(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => {
      image.src = '';
      resolve(null);
    }, 4000);
    image.onload = () => {
      window.clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 9;
        canvas.height = 8;
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(null);
          return;
        }
        context.drawImage(image, 0, 0, 9, 8);
        const pixels = context.getImageData(0, 0, 9, 8).data;
        resolve(fromLuma(rgbaToLuma(pixels, 9, 8)));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    image.src = `/api/image-proxy?url=${encodeURIComponent(url)}`;
  });
}
