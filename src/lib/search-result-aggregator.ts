import { SearchResult } from '@/lib/types';

const GENERIC_POSTER_NAMES = new Set([
  'cover',
  'poster',
  'default',
  'no',
  'nopic',
  'noposter',
  'placeholder',
  'thumb',
  'pic',
  'image',
  'img',
  'vod',
  'blank',
  'none',
  'null',
  'avatar',
]);

const BRACKET_TAG = /【[^】]*】|\[[^\]]*\]/g;
const TRAILING_YEAR = /[(（]\s*(19|20)\d{2}\s*[)）]/g;
const QUALITY_TAG =
  /(?:^|[\s([【])(?:4k|uhd|1080p|720p|480p|bluray|blu-?ray|web-?dl|\bhd\b|蓝光|高清|超清|国语|粤语|中字|完整版)(?=$|[\s)\]】])/gi;
const PUNCTUATION =
  /[\s`~!@#$%^&*()_\-+=[\]{}\\|;:'",.<>/?·—–【】（）、，。：；！？「」『』《》]+/g;
const DIGIT_RUN = /\d{6,}/;
const YEAR_MATCH = /(19|20)\d{2}/;

/**
 * Groups source search hits into unique work cards.
 * Two hits belong together when they share a normalized title (and year),
 * a distinctive poster file/URL, or the same Douban id.
 */
export function groupSearchResults(
  results: SearchResult[]
): [string, SearchResult[]][] {
  if (results.length === 0) {
    return [];
  }

  const parent = results.map((_, index) => index);

  const find = (index: number): number => {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  };

  const union = (left: number, right: number) => {
    const rootLeft = find(left);
    const rootRight = find(right);
    if (rootLeft === rootRight) {
      return;
    }
    if (rootLeft < rootRight) {
      parent[rootRight] = rootLeft;
    } else {
      parent[rootLeft] = rootRight;
    }
  };

  const byTitle = new Map<string, number[]>();
  const byPoster = new Map<string, number>();
  const byDouban = new Map<string, number>();

  results.forEach((result, index) => {
    const titleKey = normalizeTitle(result.title);
    if (titleKey) {
      const indices = byTitle.get(titleKey);
      if (indices) {
        indices.push(index);
      } else {
        byTitle.set(titleKey, [index]);
      }
    }
    posterKeys(result.poster).forEach((posterKey) => {
      const existing = byPoster.get(posterKey);
      if (existing !== undefined) {
        union(existing, index);
      } else {
        byPoster.set(posterKey, index);
      }
    });
    if (result.douban_id && result.douban_id > 0) {
      const key = String(result.douban_id);
      const existing = byDouban.get(key);
      if (existing !== undefined) {
        union(existing, index);
      } else {
        byDouban.set(key, index);
      }
    }
  });

  byTitle.forEach((indices) => {
    unionByYear(results, indices, union);
  });

  const buckets = new Map<number, SearchResult[]>();
  const order: number[] = [];
  results.forEach((result, index) => {
    const root = find(index);
    let bucket = buckets.get(root);
    if (!bucket) {
      bucket = [];
      order.push(root);
      buckets.set(root, bucket);
    }
    bucket.push(result);
  });

  return order.map((root) => [`agg:${root}`, buckets.get(root) ?? []]);
}

export function pickGroupDisplay(group: SearchResult[]): {
  title: string;
  poster: string;
  year: string;
} {
  const title = group.find((item) => item.title?.trim())?.title ?? '';
  const poster = group.find((item) => item.poster?.trim())?.poster ?? '';
  const yearItem = group.find((item) => normalizeYear(item.year));
  return {
    title,
    poster,
    year: yearItem ? normalizeYear(yearItem.year) : group[0]?.year || 'unknown',
  };
}

export function normalizeTitle(raw: string): string {
  let title = (raw || '').trim().toLowerCase();
  BRACKET_TAG.lastIndex = 0;
  TRAILING_YEAR.lastIndex = 0;
  QUALITY_TAG.lastIndex = 0;
  PUNCTUATION.lastIndex = 0;
  title = title.replace(BRACKET_TAG, '');
  title = title.replace(TRAILING_YEAR, '');
  title = title.replace(QUALITY_TAG, '');
  title = title.replace(PUNCTUATION, '');
  return title;
}

export function normalizeYear(raw: string): string {
  const match = String(raw || '').match(YEAR_MATCH);
  return match ? match[0] : '';
}

export function posterKeys(poster: string): string[] {
  const trimmed = (poster || '').trim();
  if (!trimmed) {
    return [];
  }

  let url: URL | null = null;
  try {
    url = new URL(trimmed);
  } catch {
    try {
      url = new URL(trimmed, 'https://placeholder.invalid');
    } catch {
      return [];
    }
  }

  const path = url.pathname.toLowerCase();
  if (!path) {
    return [];
  }
  const file = path.split('/').pop() || '';
  const dot = file.lastIndexOf('.');
  const name = dot <= 0 ? file : file.slice(0, dot);
  if (GENERIC_POSTER_NAMES.has(name)) {
    return [];
  }

  const keys: string[] = [];
  if (url.host && url.host !== 'placeholder.invalid') {
    keys.push(`url:${url.host.toLowerCase()}${path}`);
  }
  if (isDistinctivePosterName(name)) {
    keys.push(`file:${file}`);
  }
  return keys;
}

function unionByYear(
  results: SearchResult[],
  indices: number[],
  union: (left: number, right: number) => void
) {
  const byYear = new Map<string, number[]>();
  indices.forEach((index) => {
    const year = normalizeYear(results[index].year);
    const yearIndices = byYear.get(year);
    if (yearIndices) {
      yearIndices.push(index);
    } else {
      byYear.set(year, [index]);
    }
  });

  byYear.forEach((yearIndices) => {
    for (let offset = 1; offset < yearIndices.length; offset += 1) {
      union(yearIndices[0], yearIndices[offset]);
    }
  });

  const knownYears = Array.from(byYear.keys()).filter((year) => year !== '');
  const unknown = byYear.get('');
  const known = knownYears.length === 1 ? byYear.get(knownYears[0]) : undefined;
  if (known && unknown) {
    union(known[0], unknown[0]);
  }
}

function isDistinctivePosterName(name: string): boolean {
  if (name.length >= 10) {
    return true;
  }
  DIGIT_RUN.lastIndex = 0;
  return DIGIT_RUN.test(name);
}
