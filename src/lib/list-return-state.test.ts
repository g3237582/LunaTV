import {
  assignListPage,
  consumeListReturn,
  doubanLoadedIndex,
  doubanUrlPage,
  FAVORITES_RETURN_KEY,
  hrefWithListPage,
  listPageAfterFilterChange,
  listQueryWithoutPage,
  loadPagesInOrder,
  readListPage,
  rememberListScroll,
  saveFavoritesReturn,
  saveListReturn,
  takeFavoritesReturn,
  takeListScroll,
} from './list-return-state';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      const value = data.get(key);
      return value === undefined ? null : value;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

describe('list page query', () => {
  it('reads a missing or invalid page as 1', () => {
    expect(readListPage(null)).toBe(1);
    expect(readListPage('0')).toBe(1);
    expect(readListPage('abc')).toBe(1);
  });

  it('keeps filters and only updates page', () => {
    expect(hrefWithListPage('/search?q=foo&type=video', 3)).toBe(
      '/search?q=foo&type=video&page=3'
    );
    expect(hrefWithListPage('/under?q=foo&type=video&page=4', 2)).toBe(
      '/under?q=foo&type=video&page=2'
    );
    expect(hrefWithListPage('/source-search?special=1&page=3', 1)).toBe(
      '/source-search?special=1'
    );
    expect(
      hrefWithListPage('/private-library?source=emby:main&view=movies', 2)
    ).toBe('/private-library?source=emby%3Amain&view=movies&page=2');
  });

  it('treats page as view state, not a new search', () => {
    expect(listQueryWithoutPage('q=foo&type=video&page=4')).toBe(
      listQueryWithoutPage('type=video&q=foo')
    );
    expect(listQueryWithoutPage('q=foo&type=video&page=4')).not.toBe(
      listQueryWithoutPage('q=bar&type=video')
    );
  });

  it('does not reset the page on the first observation of filters', () => {
    expect(listPageAfterFilterChange(3, null, 'q=foo|agg')).toEqual({
      page: 3,
      signature: 'q=foo|agg',
      changed: false,
    });
  });

  it('resets to page 1 only when filters actually change', () => {
    expect(listPageAfterFilterChange(3, 'q=foo|agg', 'q=foo|agg')).toEqual({
      page: 3,
      signature: 'q=foo|agg',
      changed: false,
    });
    expect(listPageAfterFilterChange(3, 'q=foo|agg', 'q=foo|all')).toEqual({
      page: 1,
      signature: 'q=foo|all',
      changed: true,
    });
  });

  it('assigns page without dropping other params', () => {
    const params = new URLSearchParams('source=openlist&view=all');
    const next = assignListPage(params, 4);
    expect(next.toString()).toBe('source=openlist&view=all&page=4');
    expect(params.toString()).toBe('source=openlist&view=all');
    expect(assignListPage(next, 1).toString()).toBe('source=openlist&view=all');
  });
});

describe('douban loaded page', () => {
  it('stores the loaded chunk count as a 1-based page', () => {
    expect(doubanUrlPage(0)).toBe(1);
    expect(doubanUrlPage(2)).toBe(3);
    expect(doubanLoadedIndex(1)).toBe(0);
    expect(doubanLoadedIndex(3)).toBe(2);
  });
});

describe('infinite page backfill', () => {
  it('loads page 1 through the restored page and stops early', async () => {
    const calls: number[] = [];
    const loaded = await loadPagesInOrder(4, async (page) => {
      calls.push(page);
      return {
        items: [page],
        hasMore: page < 2,
      };
    });

    expect(calls).toEqual([1, 2]);
    expect(loaded).toEqual({ items: [1, 2], page: 2, hasMore: false });
  });
});

describe('list return storage', () => {
  it('restores a snapshot once, including page and scroll', () => {
    const storage = memoryStorage();
    expect(
      saveListReturn(storage, 'list-return:source-search', {
        page: 4,
        scrollTop: 820,
        payload: { selectedSource: 'a', videos: [{ id: '1' }] },
      })
    ).toBe(true);

    expect(consumeListReturn(storage, 'list-return:source-search')).toEqual({
      page: 4,
      scrollTop: 820,
      payload: { selectedSource: 'a', videos: [{ id: '1' }] },
    });
    expect(consumeListReturn(storage, 'list-return:source-search')).toBeNull();
  });

  it('rejects a snapshot that has no page', () => {
    const storage = memoryStorage();
    storage.setItem('list-return:bad', JSON.stringify({ scrollTop: 10 }));
    expect(consumeListReturn(storage, 'list-return:bad')).toBeNull();
  });

  it('remembers scroll for the exact query, including page', () => {
    const storage = memoryStorage();
    rememberListScroll(storage, '/search', '?q=foo&type=video&page=3', 640);
    expect(
      takeListScroll(storage, '/search', '?q=foo&type=video&page=2')
    ).toBeNull();
    expect(
      takeListScroll(storage, '/search', '?q=foo&type=video&page=3')
    ).toBe(640);
    expect(
      takeListScroll(storage, '/search', '?q=foo&type=video&page=3')
    ).toBeNull();
  });

  it('reopens favorites only on the page that left for the player', () => {
    const storage = memoryStorage();
    saveFavoritesReturn(storage, '/search', 240);
    expect(takeFavoritesReturn(storage, '/play')).toBeNull();
    expect(storage.getItem(FAVORITES_RETURN_KEY)).not.toBeNull();
    expect(takeFavoritesReturn(storage, '/search')).toBe(240);
    expect(storage.getItem(FAVORITES_RETURN_KEY)).toBeNull();
  });
});
