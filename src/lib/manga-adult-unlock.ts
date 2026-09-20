import type { MangaChapter } from './manga.types';

export const ADULT_CHAPTER_PREFIX = 'adult:';
export const ADULT_COOKIE = 'isAdult=1';

const SOURCE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-TW',
  Cookie: ADULT_COOKIE,
};

export function encodeAdultChapterId(mangaId: string, url: string): string {
  return `${ADULT_CHAPTER_PREFIX}${mangaId}:${normalizeChapterUrl(url)}`;
}

export function isAdultChapterId(id: string): boolean {
  return id.startsWith(ADULT_CHAPTER_PREFIX);
}

export function parseAdultChapterId(id: string): { mangaId: string; url: string } | null {
  if (!isAdultChapterId(id)) return null;
  const rest = id.slice(ADULT_CHAPTER_PREFIX.length);
  const colon = rest.indexOf(':');
  if (colon <= 0) return null;
  const mangaId = rest.slice(0, colon);
  const url = normalizeChapterUrl(rest.slice(colon + 1));
  if (!mangaId || !url) return null;
  return { mangaId, url };
}

export function normalizeChapterUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed, 'https://www.dm5.com');
    return parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
  } catch {
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseSourceChapters(html: string, mangaId: string): MangaChapter[] {
  if (!html || html.includes('warning-bar')) {
    return [];
  }

  const listStart = html.search(/id=["']chapterlistload["']/i);
  if (listStart < 0) {
    return [];
  }
  const chunk = html.slice(listStart);
  const chapters: MangaChapter[] = [];
  const seen = new Set<string>();

  for (const match of Array.from(
    chunk.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)
  )) {
    const url = normalizeChapterUrl(match[1] || '');
    if (!url || url === '/' || !/^\/m\d+\//i.test(url) || seen.has(url)) {
      continue;
    }
    const inner = match[2] || '';
    const titled = inner.match(/<p[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
    const rawName = stripTags(titled?.[1] || inner.replace(/（\s*\d+\s*P）/gi, ''));
    if (!rawName) continue;
    const pageMatch = inner.match(/（\s*(\d+)\s*P）/i);
    seen.add(url);
    chapters.push({
      id: encodeAdultChapterId(mangaId, url),
      mangaId,
      name: rawName,
      pageCount: pageMatch ? Number(pageMatch[1]) : undefined,
    });
  }

  return chapters;
}

export async function fetchAdultSourceHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: SOURCE_HEADERS,
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`源站解锁请求失败: ${response.status}`);
  }
  return response.text();
}

export function resolveSourcePageUrl(sourceUrl: string, chapterUrl: string): string {
  return new URL(chapterUrl, sourceUrl).toString();
}

export function parseDirectChapterImages(html: string, chapterUrl: string): string[] {
  const images = Array.from(html.matchAll(/data-src=["']([^"']+)["']/gi))
    .map((item) => item[1].trim())
    .filter(Boolean)
    .map((item) => new URL(item, chapterUrl).toString());
  return Array.from(new Set(images));
}
