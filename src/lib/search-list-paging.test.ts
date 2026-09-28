import {
  clampSearchPage,
  musicSearchCountLabel,
  musicSearchPageLimit,
  musicSearchPagerLabel,
  readLxSearchResult,
  SEARCH_LIST_PAGE_SIZE,
  searchListPageCount,
  searchListPageOf,
  searchListSummaryText,
  SONG_SEARCH_PAGE_SIZE,
  songSearchStartIndex,
} from '@/lib/search-list-paging';

describe('searchListPageCount', () => {
  it('is 0 when there are no items', () => {
    expect(searchListPageCount(0)).toBe(0);
  });

  it('fits a full page onto one page', () => {
    expect(searchListPageCount(SEARCH_LIST_PAGE_SIZE)).toBe(1);
  });

  it('adds a page for leftover items', () => {
    expect(searchListPageCount(SEARCH_LIST_PAGE_SIZE + 1)).toBe(2);
  });
});

describe('searchListPageOf', () => {
  it('returns the requested slice', () => {
    const items = Array.from({ length: 50 }, (_, index) => index);
    expect(searchListPageOf(items, 2, 24)).toEqual(
      Array.from({ length: 24 }, (_, index) => index + 24)
    );
  });

  it('returns a short last page', () => {
    const items = Array.from({ length: 30 }, (_, index) => index);
    expect(searchListPageOf(items, 2, 24)).toEqual([24, 25, 26, 27, 28, 29]);
  });

  it('clamps an oversized page to the last page', () => {
    expect(searchListPageOf(['a', 'b', 'c'], 9, 2)).toEqual(['c']);
  });
});

describe('clampSearchPage', () => {
  it('stays on page 1 when there are no pages', () => {
    expect(clampSearchPage(4, 0)).toBe(1);
  });
});

describe('song search paging', () => {
  it('numbers page 2 from 21 because each upstream page has 20 songs', () => {
    expect(SONG_SEARCH_PAGE_SIZE).toBe(20);
    expect(songSearchStartIndex(1)).toBe(0);
    expect(songSearchStartIndex(2)).toBe(20);
    expect(songSearchStartIndex(3)).toBe(40);
  });

  it('requests 20 songs per page and leaves singer/album limits unchanged', () => {
    expect(musicSearchPageLimit('song')).toBe(SONG_SEARCH_PAGE_SIZE);
    expect(musicSearchPageLimit('singer')).toBe(SEARCH_LIST_PAGE_SIZE);
    expect(musicSearchPageLimit('album')).toBe(SEARCH_LIST_PAGE_SIZE);
  });
});

describe('musicSearchCountLabel', () => {
  it('shows the cumulative range when the upstream list has no total', () => {
    expect(
      musicSearchCountLabel({
        page: 2,
        count: 20,
        pageSize: 20,
        total: null,
        hasMore: true,
        unit: '首',
      })
    ).toBe('21-40 首');
    expect(
      musicSearchCountLabel({
        page: 3,
        count: 7,
        pageSize: 20,
        total: null,
        hasMore: false,
        unit: '首',
      })
    ).toBe('41-47 首');
    expect(
      musicSearchCountLabel({
        page: 2,
        count: 24,
        pageSize: 24,
        total: null,
        hasMore: true,
        unit: '位',
      })
    ).toBe('25-48 位');
  });

  it('shows the catalog total when the upstream count covers more than this page', () => {
    expect(
      musicSearchCountLabel({
        page: 2,
        count: 20,
        pageSize: 20,
        total: 312,
        hasMore: true,
        unit: '首',
      })
    ).toBe('共 312 首');
  });

  it('does not treat the current page length as a catalog total', () => {
    expect(
      musicSearchCountLabel({
        page: 1,
        count: 20,
        pageSize: 20,
        total: 20,
        hasMore: true,
        unit: '首',
      })
    ).toBe('1-20 首');
  });
});

describe('musicSearchPagerLabel', () => {
  it('shows the current page, total pages, and catalog size', () => {
    expect(
      musicSearchPagerLabel({
        page: 2,
        count: 20,
        pageSize: 20,
        total: 312,
        hasMore: true,
        unit: '首',
      })
    ).toEqual({ label: '2 / 16 页 · 共 312 首', pageCount: 16 });
  });

  it('counts pages by the 20-song page size', () => {
    expect(
      musicSearchPagerLabel({
        page: 1,
        count: 20,
        pageSize: 20,
        total: 21,
        hasMore: true,
        unit: '首',
      })
    ).toEqual({ label: '1 / 2 页 · 共 21 首', pageCount: 2 });
  });

  it('does not invent a page count when the total is missing', () => {
    expect(
      musicSearchPagerLabel({
        page: 2,
        count: 20,
        pageSize: 20,
        total: null,
        hasMore: true,
        unit: '首',
      })
    ).toEqual({ label: '第 2 页', pageCount: null });
  });
});

describe('readLxSearchResult', () => {
  it('keeps a bare song array and records that there is no total', () => {
    const list = [{ id: '1' }, { id: '2' }];
    expect(readLxSearchResult(list)).toEqual({ list, total: null });
  });

  it('reads total from an SDK-shaped object without dropping the list', () => {
    const list = [{ id: '1' }];
    expect(readLxSearchResult({ list, total: 312, allPage: 16 })).toEqual({
      list,
      total: 312,
    });
    expect(readLxSearchResult({ list, total: '88' })).toEqual({
      list,
      total: 88,
    });
  });

  it('drops QQ totals because estimate_sum is not an exact count', () => {
    const list = [{ id: '1' }];
    expect(readLxSearchResult({ list, total: 312 }, 'tx')).toEqual({
      list,
      total: null,
    });
    expect(readLxSearchResult({ list, total: 312 }, 'wy')).toEqual({
      list,
      total: 312,
    });
  });
});

describe('searchListSummaryText', () => {
  it('shows total count and current/total pages', () => {
    expect(
      searchListSummaryText({ totalItems: 86, page: 2, pageCount: 4 })
    ).toBe('共86条  2/4');
  });

  it('shows zero results without a fake page', () => {
    expect(
      searchListSummaryText({ totalItems: 0, page: 1, pageCount: 0 })
    ).toBe('共0条');
  });
});
