import {
  loadInParallel,
  mergeMusicPages,
  MUSIC_LIST_PAGE_SIZE,
  musicPageState,
  nextPrefetchPages,
  parsePageParam,
  sliceMusicPage,
  withPageQuery,
} from './music-page-data';

describe('parsePageParam', () => {
  it('defaults invalid page values to 1', () => {
    expect(parsePageParam(null)).toBe(1);
    expect(parsePageParam('0')).toBe(1);
    expect(parsePageParam('-2')).toBe(1);
    expect(parsePageParam('abc')).toBe(1);
  });

  it('keeps a positive integer page', () => {
    expect(parsePageParam('3')).toBe(3);
    expect(parsePageParam('3.9')).toBe(3);
  });
});

describe('musicPageState', () => {
  it('uses 24 items per page', () => {
    expect(MUSIC_LIST_PAGE_SIZE).toBe(24);
    expect(musicPageState(50, 2)).toEqual({
      page: 2,
      pageCount: 3,
      pageSize: 24,
      startIndex: 24,
    });
  });
});

describe('sliceMusicPage', () => {
  it('returns the visible page and global start index', () => {
    const items = Array.from({ length: 30 }, (_, index) => index + 1);
    expect(sliceMusicPage(items, 2)).toEqual({
      page: 2,
      pageCount: 2,
      pageSize: 24,
      startIndex: 24,
      items: [25, 26, 27, 28, 29, 30],
    });
  });
});

describe('loadInParallel', () => {
  it('starts independent loaders together and keeps successful results', async () => {
    const startedAt: number[] = [];
    const result = await loadInParallel({
      tags: async () => {
        startedAt.push(Date.now());
        await new Promise((resolve) => setTimeout(resolve, 40));
        return ['hot'];
      },
      list: async () => {
        startedAt.push(Date.now());
        await new Promise((resolve) => setTimeout(resolve, 40));
        return ['song'];
      },
      broken: async () => {
        startedAt.push(Date.now());
        throw new Error('nope');
      },
    });

    expect(Math.max(...startedAt) - Math.min(...startedAt)).toBeLessThan(30);
    expect(result.tags).toEqual(['hot']);
    expect(result.list).toEqual(['song']);
    expect(result.broken).toBeNull();
  });
});

describe('nextPrefetchPages', () => {
  it('prefetches the next page without wrapping', () => {
    expect(nextPrefetchPages(1, 4)).toEqual([2]);
    expect(nextPrefetchPages(4, 4)).toEqual([]);
  });
});

describe('withPageQuery', () => {
  it('writes page into an existing query string and drops page 1', () => {
    expect(withPageQuery('/music/rankings?source=wy', 2)).toBe('/music/rankings?source=wy&page=2');
    expect(withPageQuery('/music/rankings?source=wy&page=3', 1)).toBe('/music/rankings?source=wy');
  });
});

describe('mergeMusicPages', () => {
  it('returns the first page when the list is already complete', async () => {
    const loadPage = jest.fn();
    const list = [{ id: 1 }, { id: 2 }];
    await expect(
      mergeMusicPages(1, { list, total: 2 }, loadPage)
    ).resolves.toEqual(list);
    expect(loadPage).not.toHaveBeenCalled();
  });

  it('loads remaining pages in parallel and keeps order', async () => {
    const startedAt: number[] = [];
    const loadPage = jest.fn(async (page: number) => {
      startedAt.push(Date.now());
      await new Promise((resolve) => setTimeout(resolve, 30));
      return {
        list: Array.from({ length: 24 }, (_, index) => ({ id: (page - 1) * 24 + index + 1 })),
        total: 48,
        limit: 24,
      };
    });

    const first = await loadPage(1);
    startedAt.length = 0;
    const merged = await mergeMusicPages(1, first, loadPage);

    expect(merged.map((item) => item.id)).toEqual(Array.from({ length: 48 }, (_, index) => index + 1));
    expect(loadPage).toHaveBeenCalledTimes(2);
    expect(Math.max(...startedAt) - Math.min(...startedAt)).toBeLessThan(20);
  });
});
