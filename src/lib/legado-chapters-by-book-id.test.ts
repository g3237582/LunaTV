/**
 * @jest-environment node
 *
 * JSON 书源常把数字 id / 哈希当成 bookId，真正能打开目录的是搜索结果里的 detailHref。
 * bookUrl 不是 {{$.id}} / {id} 模板时，仅凭 bookId 不能反推详情页。
 */
import type { BookSource } from '@/lib/book.types';

jest.mock('@/lib/config', () => ({
  getConfig: jest.fn(async () => ({})),
}));

jest.mock('@/lib/server/ssrf', () => ({
  validateProxyUrlServerSide: jest.fn(async () => true),
}));

const SOURCE_RULE = {
  bookSourceName: '猫眼看书',
  bookSourceUrl: 'https://books.example',
  searchUrl: 'https://books.example/search?key={{key}}',
  ruleSearch: {
    bookList: '$.data',
    name: '$.name',
    author: '$.author',
    bookUrl: 'https://books.example/info/{{$.slug}}',
  },
  ruleBookInfo: {
    name: '$.data.name',
    author: '$.data.author',
    tocUrl: '$.data.toc',
  },
  ruleToc: {
    chapterList: '$.chapters',
    chapterName: '$.title',
    chapterUrl: '$.url',
  },
};

const SEARCH_BODY = JSON.stringify({
  data: [{ id: 377259, name: '三体', slug: 'santi', author: '刘慈欣' }],
});

const DETAIL_BODY = JSON.stringify({
  data: {
    name: '三体',
    author: '刘慈欣',
    toc: 'https://books.example/toc/santi',
  },
});

const TOC_BODY = JSON.stringify({
  chapters: [{ title: '第一章 科学边界', url: 'https://books.example/read/santi/1' }],
});

const DETAIL_HREF = 'https://books.example/info/santi';

function installFetch() {
  const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    let body = '';
    if (url.startsWith('https://books.example/search')) body = SEARCH_BODY;
    else if (url === DETAIL_HREF) body = DETAIL_BODY;
    else if (url === 'https://books.example/toc/santi') body = TOC_BODY;
    else body = '{}';
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => body,
      arrayBuffer: async () => Buffer.from(body),
    };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('Legado chapters when bookId cannot locate the detail page', () => {
  beforeAll(() => {
    process.env.LEGADO_ENABLED = 'true';
    process.env.LEGADO_SOURCES_JSON = JSON.stringify([SOURCE_RULE]);
    process.env.LEGADO_SEARCH_PAGES = '1';
  });

  beforeEach(() => {
    installFetch();
    jest.resetModules();
  });

  async function loadClient() {
    const mod = await import('@/lib/legado.client');
    const sources = await mod.legadoClient.getSources();
    const source = sources.find((item) => item.name === '猫眼看书');
    if (!source) throw new Error('测试书源未加载');
    return { legadoClient: mod.legadoClient, source };
  }

  it('returns chapters from an explicit detailHref when bookId is only an opaque id', async () => {
    const { legadoClient, source } = await loadClient();

    await expect(legadoClient.getChaptersByBookId(source.id, '377259')).rejects.toThrow(
      '该 Legado 书源无法通过 bookId 定位详情，请重新搜索后打开'
    );

    const chapters = await legadoClient.getChaptersByBookId(source.id, '377259', {
      detailHref: DETAIL_HREF,
    });

    expect(chapters.map((chapter) => chapter.title)).toEqual(['第一章 科学边界']);
    expect(chapters[0]?.href).toBe('https://books.example/read/santi/1');
  });

  it('uses the search result detailHref as bookId so a later bookId-only lookup can open the TOC', async () => {
    const { legadoClient, source } = await loadClient();
    const searched = await legadoClient.searchBooksSource('三体', source);

    expect(searched.results).toHaveLength(1);
    expect(searched.results[0]?.detailHref).toBe(DETAIL_HREF);
    expect(searched.results[0]?.id).toBe(DETAIL_HREF);

    const chapters = await legadoClient.getChaptersByBookId(source.id, searched.results[0].id);
    expect(chapters.map((chapter) => chapter.title)).toEqual(['第一章 科学边界']);
  });

  it('resolves a previously issued opaque id after the same book was searched', async () => {
    const { legadoClient, source } = await loadClient();
    await legadoClient.searchBooksSource('三体', source as BookSource);

    const chapters = await legadoClient.getChaptersByBookId(source.id, '377259');
    expect(chapters.map((chapter) => chapter.title)).toEqual(['第一章 科学边界']);
  });

  it('uses detailHref even when the bookUrl {id} template can build a different page from bookId', async () => {
    const previous = process.env.LEGADO_SOURCES_JSON;
    process.env.LEGADO_SOURCES_JSON = JSON.stringify([
      {
        ...SOURCE_RULE,
        bookSourceName: '优先详情地址',
        ruleSearch: {
          ...SOURCE_RULE.ruleSearch,
          bookUrl: 'https://books.example/id/{{$.id}}',
        },
      },
    ]);
    jest.resetModules();
    try {
      const mod = await import('@/lib/legado.client');
      const source = (await mod.legadoClient.getSources()).find((item) => item.name === '优先详情地址');
      if (!source) throw new Error('测试书源未加载');
      const calls: string[] = [];
      global.fetch = jest.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        const body = url === DETAIL_HREF ? DETAIL_BODY : url === 'https://books.example/toc/santi' ? TOC_BODY : '{"chapters":[{"title":"错误目录","url":"https://books.example/wrong/1"}]}';
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: async () => body,
          arrayBuffer: async () => Buffer.from(body),
        };
      }) as unknown as typeof fetch;

      const chapters = await mod.legadoClient.getChaptersByBookId(source.id, '377259', {
        detailHref: DETAIL_HREF,
      });

      expect(chapters.map((chapter) => chapter.title)).toEqual(['第一章 科学边界']);
      expect(calls.some((url) => url.includes('/id/377259'))).toBe(false);
    } finally {
      process.env.LEGADO_SOURCES_JSON = previous;
    }
  });
});
