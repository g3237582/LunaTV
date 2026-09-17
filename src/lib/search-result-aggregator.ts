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
  'upload',
  'static',
  'images',
  'pics',
]);

const CHINESE_DIGITS: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

const BRACKET_TAG = /【[^】]*】|\[[^\]]*\]/g;
const TRAILING_YEAR = /[(（]\s*(19|20)\d{2}\s*[)）]/g;
const QUALITY_TAG =
  /(?:^|[\s([【])(?:4k|uhd|1080p|720p|480p|bluray|blu-?ray|web-?dl|\bhd\b|蓝光|高清|超清|国语|粤语|中字|完整版)(?=$|[\s)\]】])/gi;
const PUNCTUATION =
  /[\s`~!@#$%^&*()_\-+=[\]{}\\|;:'",.<>/?·—–【】（）、，。：；！？「」『』《》]+/g;
const DIGIT_RUN = /\d{6,}/;
const HEX_RUN = /^[a-f0-9]{10,}$/;
const CHINESE_SEASON = /第([零一二两三四五六七八九十百]+)([季部])/g;
const SEASON_TOKEN = /第\d+[季部]|s\d+|season\d+/;
const DATE_LIKE = /^(19|20)\d{4,6}$/;
const MIXED_ALNUM = /(?=.*[a-z])(?=.*\d)/;
const YEAR_MATCH = /(19|20)\d{2}/;

/**
 * Groups source search hits into unique work cards.
 * Two hits belong together when they share a normalized title (and year),
 * a season-qualified title, a distinctive poster file/URL, or the same Douban id.
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

  byTitle.forEach((indices, titleKey) => {
    if (hasSeasonToken(titleKey)) {
      for (let offset = 1; offset < indices.length; offset += 1) {
        union(indices[0], indices[offset]);
      }
    } else {
      unionByYear(results, indices, union);
    }
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
  const yearCounts = new Map<string, number>();
  group.forEach((item) => {
    const year = normalizeYear(item.year);
    if (year) {
      yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
    }
  });
  let year = group[0]?.year || 'unknown';
  let max = 0;
  yearCounts.forEach((count, value) => {
    if (count > max) {
      max = count;
      year = value;
    }
  });
  return { title, poster, year };
}

export function normalizeTitle(raw: string): string {
  let title = (raw || '').trim().toLowerCase();
  BRACKET_TAG.lastIndex = 0;
  TRAILING_YEAR.lastIndex = 0;
  QUALITY_TAG.lastIndex = 0;
  CHINESE_SEASON.lastIndex = 0;
  PUNCTUATION.lastIndex = 0;
  title = title.replace(BRACKET_TAG, '');
  title = title.replace(TRAILING_YEAR, '');
  title = title.replace(QUALITY_TAG, '');
  title = title.replace(CHINESE_SEASON, (_full, numeral, suffix) => {
    const number = parseChineseNumber(numeral);
    return number == null ? _full : `第${number}${suffix}`;
  });
  title = title.replace(PUNCTUATION, '');
  return title;
}

export function hasSeasonToken(titleKey: string): boolean {
  SEASON_TOKEN.lastIndex = 0;
  return SEASON_TOKEN.test(titleKey);
}

export function parseChineseNumber(raw: string): number | null {
  if (raw === '十') {
    return 10;
  }
  if (CHINESE_DIGITS[raw] !== undefined) {
    return CHINESE_DIGITS[raw];
  }
  if (raw.startsWith('十')) {
    const ones = CHINESE_DIGITS[raw.slice(1)];
    return ones === undefined ? null : 10 + ones;
  }
  if (raw.endsWith('十')) {
    const tens = CHINESE_DIGITS[raw.slice(0, -1)];
    return tens === undefined ? null : tens * 10;
  }
  const tenIndex = raw.indexOf('十');
  if (tenIndex <= 0) {
    return null;
  }
  const tens = CHINESE_DIGITS[raw.slice(0, tenIndex)];
  const ones =
    tenIndex + 1 < raw.length
      ? CHINESE_DIGITS[raw.slice(tenIndex + 1)] ?? 0
      : 0;
  if (tens === undefined || ones === undefined) {
    return null;
  }
  return tens * 10 + ones;
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

  const unwrapped = unwrapProxyUrl(trimmed);
  let url: URL | null = null;
  try {
    url = new URL(unwrapped);
  } catch {
    try {
      url = new URL(unwrapped, 'https://placeholder.invalid');
    } catch {
      return [];
    }
  }

  let path = url.pathname.toLowerCase();
  if (path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  if (!path) {
    return [];
  }
  const file = path.split('/').pop() || '';
  const dot = file.lastIndexOf('.');
  const name = dot <= 0 ? file : file.slice(0, dot);
  const keys = new Set<string>();
  if (url.host && url.host !== 'placeholder.invalid') {
    keys.add(`url:${url.host.toLowerCase()}${path}`);
  }
  if (!GENERIC_POSTER_NAMES.has(name) && isDistinctivePosterName(name)) {
    keys.add(`file:${file}`);
  }
  if (hasDistinctivePathSegment(path)) {
    keys.add(`path:${path}`);
  }
  return Array.from(keys);
}

function unwrapProxyUrl(raw: string): string {
  try {
    const url = new URL(raw, 'https://placeholder.invalid');
    const nested = url.searchParams.get('url');
    if (nested) {
      return nested;
    }
  } catch {
    return raw;
  }
  return raw;
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

function hasDistinctivePathSegment(path: string): boolean {
  return path.split('/').some((segment) => {
    if (!segment || GENERIC_POSTER_NAMES.has(segment)) {
      return false;
    }
    if (DATE_LIKE.test(segment)) {
      return false;
    }
    if (HEX_RUN.test(segment)) {
      return true;
    }
    if (segment.length >= 10 && MIXED_ALNUM.test(segment)) {
      return true;
    }
    DIGIT_RUN.lastIndex = 0;
    return DIGIT_RUN.test(segment);
  });
}
