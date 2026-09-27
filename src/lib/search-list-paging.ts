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
