import {
  SEARCH_LIST_PAGE_SIZE,
  clampSearchPage,
  searchListPageCount,
  searchListPageOf,
} from './search-list-paging';

export const MUSIC_LIST_PAGE_SIZE = SEARCH_LIST_PAGE_SIZE;

export function parsePageParam(value: string | null | undefined): number {
  const page = Number(value || '1');
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.floor(page);
}

export function musicPageState(
  totalItems: number,
  page: number,
  pageSize = MUSIC_LIST_PAGE_SIZE
) {
  const pageCount = searchListPageCount(totalItems, pageSize);
  const safePage = clampSearchPage(page, pageCount);
  return {
    page: safePage,
    pageCount,
    pageSize,
    startIndex: (safePage - 1) * pageSize,
  };
}

export function sliceMusicPage<T>(
  items: T[],
  page: number,
  pageSize = MUSIC_LIST_PAGE_SIZE
) {
  const state = musicPageState(items.length, page, pageSize);
  return {
    ...state,
    items: searchListPageOf(items, state.page, pageSize),
  };
}

export async function loadInParallel<T extends Record<string, () => Promise<unknown>>>(
  loaders: T
): Promise<{ [P in keyof T]: Awaited<ReturnType<T[P]>> | null }> {
  const keys = Object.keys(loaders) as Array<keyof T>;
  const settled = await Promise.allSettled(keys.map((key) => loaders[key]()));
  const result = {} as { [P in keyof T]: Awaited<ReturnType<T[P]>> | null };
  keys.forEach((key, index) => {
    const item = settled[index];
    result[key] = item.status === 'fulfilled' ? (item.value as Awaited<ReturnType<T[typeof key]>>) : null;
  });
  return result;
}

export function nextPrefetchPages(page: number, pageCount: number, extra = 1): number[] {
  const pages: number[] = [];
  for (let offset = 1; offset <= extra; offset += 1) {
    const next = page + offset;
    if (next >= 1 && next <= pageCount) pages.push(next);
  }
  return pages;
}

export function withPageQuery(href: string, page: number): string {
  const [pathname, query = ''] = href.split('?');
  const params = new URLSearchParams(query);
  if (page <= 1) params.delete('page');
  else params.set('page', String(page));
  const nextQuery = params.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

export type MusicPagePayload<T> = {
  list: T[];
  total: number;
  limit?: number;
};

const MAX_PARALLEL_MUSIC_PAGES = 8;

export async function mergeMusicPages<T>(
  currentPage: number,
  current: MusicPagePayload<T>,
  loadPage: (page: number) => Promise<MusicPagePayload<T>>
): Promise<T[]> {
  const pageSize = current.limit || current.list.length || MUSIC_LIST_PAGE_SIZE;
  const total = current.total || current.list.length;
  if (current.list.length >= total) return current.list;

  const pageCount = Math.max(1, searchListPageCount(total, pageSize));
  const maxPages = Math.min(pageCount, MAX_PARALLEL_MUSIC_PAGES);
  const missing = Array.from({ length: maxPages }, (_, index) => index + 1).filter(
    (page) => page !== currentPage
  );
  if (missing.length === 0) return current.list;

  const loaded = await Promise.all(missing.map((page) => loadPage(page)));
  const byPage = new Map<number, T[]>();
  byPage.set(currentPage, current.list);
  missing.forEach((page, index) => {
    byPage.set(page, loaded[index]?.list || []);
  });

  const list: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    list.push(...(byPage.get(page) || []));
  }
  return list;
}
