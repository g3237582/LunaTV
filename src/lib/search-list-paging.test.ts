import {
  clampSearchPage,
  musicSearchPageLimit,
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
