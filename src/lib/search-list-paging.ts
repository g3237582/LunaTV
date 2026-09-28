export const SEARCH_LIST_PAGE_SIZE = 24;

/**
 * lxserver 的 type=song 不理会 limit，酷我 / 酷狗 / QQ / 网易云固定每页 20 首。
 * 歌单、榜单这些本地切片仍用 SEARCH_LIST_PAGE_SIZE，不要跟着改成 20。
 */
export const SONG_SEARCH_PAGE_SIZE = 20;

/**
 * 搜索结果还有没有下一页。
 *
 * 歌曲搜索如果按 24 去要、上游却只回满页 20，20 >= 24 会把下一页藏掉。
 * 这种「要得更多、却正好拿到上游页大小」仍是满页。
 * 歌手和专辑继续按请求的 limit 判断，短一截就是最后一页。
 */
export function musicSearchHasMore(
  list: unknown,
  limit: number,
  type: string
): boolean {
  if (!Array.isArray(list)) return false;
  if (list.length >= limit) return true;
  return (
    type === 'song' &&
    limit > SONG_SEARCH_PAGE_SIZE &&
    list.length === SONG_SEARCH_PAGE_SIZE
  );
}

/** 歌曲搜索一页对应上游一页，序号按 20 首连续排，第二页从 21 起。 */
export function songSearchStartIndex(
  page: number,
  pageSize = SONG_SEARCH_PAGE_SIZE
): number {
  const current = Number.isFinite(page) ? Math.floor(page) : 1;
  const safePage = current < 1 ? 1 : current;
  const size = pageSize > 0 ? pageSize : SONG_SEARCH_PAGE_SIZE;
  return (safePage - 1) * size;
}

/** 歌曲按上游固定页大小去要；歌手和专辑仍用列表分页大小。 */
export function musicSearchPageLimit(type: string): number {
  return type === 'song' ? SONG_SEARCH_PAGE_SIZE : SEARCH_LIST_PAGE_SIZE;
}

/**
 * lxserver 的 HTTP 搜索目前只回列表，SDK 里的 total 被丢掉。
 * 如果响应已经是 { list, total }，把总数留下来。
 * QQ 的 total 来自 estimate_sum，是估算，不当成精确曲库总数。
 */
export function readLxSearchResult(
  payload: unknown,
  source?: string
): {
  list: unknown[];
  total: number | null;
} {
  if (Array.isArray(payload)) {
    return { list: payload, total: null };
  }
  if (!payload || typeof payload !== 'object') {
    return { list: [], total: null };
  }
  const record = payload as { list?: unknown; data?: unknown; total?: unknown };
  const list = Array.isArray(record.list)
    ? record.list
    : Array.isArray(record.data)
    ? record.data
    : [];
  const total = source === 'tx' ? null : readSearchTotal(record.total);
  return { list, total };
}

function readSearchTotal(value: unknown): number | null {
  if (typeof value === 'string') {
    if (value.trim() === '') return null;
    return readSearchTotal(Number(value));
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.floor(value);
}

/**
 * 右上角数量。有可靠总数时显示「共 N 首」；
 * 上游只给了当前页时显示这一页在结果里的区间，例如第 2 页「21-40 首」。
 * 总数如果只等于当前已看到的末尾、后面却还有页，那只是页长，不当成曲库总数。
 */
export function musicSearchCountLabel({
  page,
  count,
  pageSize = SONG_SEARCH_PAGE_SIZE,
  total,
  hasMore,
  unit = '首',
}: {
  page: number;
  count: number;
  pageSize?: number;
  total?: number | null;
  hasMore?: boolean;
  unit?: string;
}): string | null {
  if (count <= 0) return null;
  const size = pageSize > 0 ? pageSize : SONG_SEARCH_PAGE_SIZE;
  const start = songSearchStartIndex(page, size) + 1;
  const end = start + count - 1;
  if (isCatalogTotal(total, end, hasMore)) {
    return `共 ${total} ${unit}`;
  }
  return start === end ? `${start} ${unit}` : `${start}-${end} ${unit}`;
}

/**
 * 底部分页。有可靠总数时显示「2 / 16 页 · 共 312 首」，页数按 ceil(total / pageSize)。
 * 没有可靠总数时只显示「第 2 页」，不编造总页数。
 */
export function musicSearchPagerLabel({
  page,
  count,
  pageSize = SONG_SEARCH_PAGE_SIZE,
  total,
  hasMore,
  unit = '首',
}: {
  page: number;
  count: number;
  pageSize?: number;
  total?: number | null;
  hasMore?: boolean;
  unit?: string;
}): { label: string; pageCount: number | null } {
  const size = pageSize > 0 ? pageSize : SONG_SEARCH_PAGE_SIZE;
  const current = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const end = count > 0 ? songSearchStartIndex(current, size) + count : 0;
  if (count > 0 && isCatalogTotal(total, end, hasMore)) {
    const pageCount = Math.ceil(total / size);
    return {
      label: `${current} / ${pageCount} 页 · 共 ${total} ${unit}`,
      pageCount,
    };
  }
  return { label: `第 ${current} 页`, pageCount: null };
}

function isCatalogTotal(
  total: number | null | undefined,
  end: number,
  hasMore?: boolean
): total is number {
  if (typeof total !== 'number' || !Number.isFinite(total) || total < end) {
    return false;
  }
  if (hasMore && total <= end) return false;
  return true;
}

export function searchListPageCount(
  totalItems: number,
  pageSize = SEARCH_LIST_PAGE_SIZE
): number {
  if (totalItems <= 0 || pageSize <= 0) {
    return 0;
  }
  return Math.ceil(totalItems / pageSize);
}

export function clampSearchPage(page: number, pageCount: number): number {
  if (pageCount <= 0) {
    return 1;
  }
  if (page < 1) {
    return 1;
  }
  if (page > pageCount) {
    return pageCount;
  }
  return page;
}

export function searchListPageOf<T>(
  items: T[],
  page: number,
  pageSize = SEARCH_LIST_PAGE_SIZE
): T[] {
  if (items.length === 0 || pageSize <= 0) {
    return [];
  }
  const count = searchListPageCount(items.length, pageSize);
  const current = clampSearchPage(page, count);
  const start = (current - 1) * pageSize;
  if (start >= items.length) {
    return [];
  }
  return items.slice(start, start + pageSize);
}

export function searchListSummaryText({
  totalItems,
  page,
  pageCount,
}: {
  totalItems: number;
  page: number;
  pageCount: number;
}): string {
  if (totalItems <= 0) {
    return '共0条';
  }
  return `共${totalItems}条  ${page}/${pageCount}`;
}
