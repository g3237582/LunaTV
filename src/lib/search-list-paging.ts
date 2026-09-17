export const SEARCH_LIST_PAGE_SIZE = 24;

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
