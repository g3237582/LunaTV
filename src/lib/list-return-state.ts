import { parsePageParam, withPageQuery } from './music-page-data';

export const FAVORITES_RETURN_KEY = 'list-return:favorites';

export function readListPage(value: string | null | undefined): number {
  return parsePageParam(value);
}

/** 保留原有查询参数。第 1 页不写 page，避免把默认页推进历史记录。 */
export function hrefWithListPage(href: string, page: number): string {
  return withPageQuery(href, readListPage(String(page)));
}

/**
 * 搜索请求的身份。page 只是当前列表视图，不能当成一次新搜索。
 */
export function listQueryWithoutPage(search: string): string {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  params.delete('page');
  return Array.from(params.entries())
    .sort((left, right) => {
      if (left[0] === right[0]) {
        return left[1] < right[1] ? -1 : left[1] > right[1] ? 1 : 0;
      }
      return left[0] < right[0] ? -1 : 1;
    })
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

/**
 * 筛选第一次被观察到时保留当前页（通常来自 URL）。
 * 只有筛选签名真正变化时才回到第 1 页。
 */
export function listPageAfterFilterChange(
  currentPage: number,
  previousSignature: string | null,
  nextSignature: string
): { page: number; signature: string; changed: boolean } {
  if (previousSignature === null || previousSignature === nextSignature) {
    return {
      page: currentPage,
      signature: nextSignature,
      changed: false,
    };
  }
  return { page: 1, signature: nextSignature, changed: true };
}

export function assignListPage(
  params: URLSearchParams,
  page: number
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  const safePage = readListPage(String(page));
  if (safePage <= 1) next.delete('page');
  else next.set('page', String(safePage));
  return next;
}

/** 豆瓣列表内部从 0 计已加载页，地址栏用 1 开始的页码。 */
export function doubanUrlPage(zeroBasedLoadedIndex: number): number {
  const index = Number.isFinite(zeroBasedLoadedIndex)
    ? Math.floor(zeroBasedLoadedIndex)
    : 0;
  return index < 0 ? 1 : index + 1;
}

export function doubanLoadedIndex(urlPage: number): number {
  return Math.max(0, readListPage(String(urlPage)) - 1);
}

export async function loadPagesInOrder<T>(
  targetPage: number,
  loadPage: (page: number) => Promise<{ items: T[]; hasMore: boolean }>
): Promise<{ items: T[]; page: number; hasMore: boolean }> {
  const target = readListPage(String(targetPage));
  const items: T[] = [];
  let loadedPage = 1;
  let hasMore = true;

  for (let page = 1; page <= target; page += 1) {
    const result = await loadPage(page);
    items.push(...(result.items || []));
    loadedPage = page;
    hasMore = result.hasMore;
    if (!hasMore) break;
  }

  return { items, page: loadedPage, hasMore };
}

export interface ListReturnRecord<T> {
  page: number;
  scrollTop: number;
  payload: T;
}

type ListStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function saveListReturn<T>(
  storage: Pick<Storage, 'setItem'>,
  key: string,
  record: ListReturnRecord<T>
): boolean {
  try {
    storage.setItem(key, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function consumeListReturn<T>(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  key: string
): ListReturnRecord<T> | null {
  try {
    const raw = storage.getItem(key);
    storage.removeItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ListReturnRecord<T>>;
    if (!parsed || typeof parsed !== 'object' || !('payload' in parsed)) {
      return null;
    }
    if (
      typeof parsed.page !== 'number' ||
      !Number.isFinite(parsed.page) ||
      parsed.page < 1
    ) {
      return null;
    }
    if (
      typeof parsed.scrollTop !== 'number' ||
      !Number.isFinite(parsed.scrollTop) ||
      parsed.scrollTop < 0
    ) {
      return null;
    }
    return {
      page: Math.floor(parsed.page),
      scrollTop: parsed.scrollTop,
      payload: parsed.payload as T,
    };
  } catch {
    return null;
  }
}

export function listScrollStorageKey(pathname: string, search: string): string {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const query = new URLSearchParams(raw).toString();
  return `list-return-scroll:${pathname}${query ? `?${query}` : ''}`;
}

export function rememberListScroll(
  storage: Pick<Storage, 'setItem'>,
  pathname: string,
  search: string,
  scrollTop: number
): void {
  const top = Number.isFinite(scrollTop) && scrollTop > 0 ? scrollTop : 0;
  const page = readListPage(
    new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get(
      'page'
    )
  );
  saveListReturn(storage, listScrollStorageKey(pathname, search), {
    page,
    scrollTop: top,
    payload: null,
  });
}

export function takeListScroll(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  pathname: string,
  search: string
): number | null {
  const record = consumeListReturn<null>(
    storage,
    listScrollStorageKey(pathname, search)
  );
  return record ? record.scrollTop : null;
}

export interface FavoritesReturnPayload {
  pathname: string;
}

export function saveFavoritesReturn(
  storage: Pick<Storage, 'setItem'>,
  pathname: string,
  scrollTop: number
): void {
  saveListReturn<FavoritesReturnPayload>(storage, FAVORITES_RETURN_KEY, {
    page: 1,
    scrollTop: Number.isFinite(scrollTop) && scrollTop > 0 ? scrollTop : 0,
    payload: { pathname },
  });
}

/** 播放页也会挂用户菜单。只在回到离开时的页面才消费收藏滚动位置。 */
export function takeFavoritesReturn(
  storage: ListStorage,
  pathname: string
): number | null {
  try {
    const raw = storage.getItem(FAVORITES_RETURN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<
      ListReturnRecord<FavoritesReturnPayload>
    >;
    if (parsed?.payload?.pathname !== pathname) return null;
    storage.removeItem(FAVORITES_RETURN_KEY);
    return typeof parsed.scrollTop === 'number' && parsed.scrollTop > 0
      ? parsed.scrollTop
      : 0;
  } catch {
    return null;
  }
}

export function readDocumentScrollTop(): number {
  if (typeof document === 'undefined') return 0;
  return (
    document.body?.scrollTop ||
    document.documentElement?.scrollTop ||
    (typeof window !== 'undefined' ? window.scrollY : 0) ||
    0
  );
}

export function writeDocumentScrollTop(top: number): void {
  if (typeof document === 'undefined') return;
  const next = Number.isFinite(top) && top > 0 ? top : 0;
  document.body.scrollTop = next;
  document.documentElement.scrollTop = next;
  if (typeof window !== 'undefined') {
    window.scrollTo(0, next);
  }
}
