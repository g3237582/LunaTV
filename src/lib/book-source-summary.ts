import type { BookSource, BookSourceCapabilities } from './book.types';

export const BOOK_SOURCE_PAGE_SIZE = 24;
export const BOOK_SOURCE_CHIP_LIMIT = 40;

export type BookSourceSummary = {
  id: string;
  name: string;
  type?: BookSource['type'];
  url: string;
  enabled?: boolean;
  group?: string;
  capabilities?: BookSourceCapabilities;
};

export function summarizeBookSource(source: BookSource): BookSourceSummary {
  const group = source.legado?.bookSourceGroup;
  return {
    id: source.id,
    name: source.name,
    type: source.type,
    url: source.url,
    enabled: source.enabled,
    group: typeof group === 'string' && group.trim() ? group.trim() : undefined,
    capabilities: source.capabilities,
  };
}

export function filterBookSources<T extends { id: string; name: string; group?: string; legado?: { bookSourceGroup?: string } }>(
  sources: T[],
  query: string
): T[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return sources;
  return sources.filter((source) => {
    const group =
      source.group ||
      (typeof source.legado?.bookSourceGroup === 'string'
        ? source.legado.bookSourceGroup
        : '');
    return (
      source.name.toLowerCase().includes(keyword) ||
      group.toLowerCase().includes(keyword)
    );
  });
}

export function pageBookSources<T>(
  sources: T[],
  page: number,
  pageSize = BOOK_SOURCE_PAGE_SIZE
): T[] {
  const totalPages = Math.max(1, Math.ceil(sources.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return sources.slice(start, start + pageSize);
}
