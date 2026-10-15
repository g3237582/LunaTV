/**
 * @jest-environment node
 *
 * ruleBookInfo.init 的 <js> / @js: 要在详情页上下文里执行。
 * java.put 写入的变量必须还能被目录、章节地址和正文规则 java.get 到，
 * 不能只在第一次解析详情时落在全局变量上。
 */
jest.mock('@/lib/config', () => ({
  getConfig: jest.fn(async () => ({})),
}));

jest.mock('@/lib/server/ssrf', () => ({
  validateProxyUrlServerSide: jest.fn(async () => true),
}));

const HUOZHE_URL = 'https://ixdzs8.com/read/117097/';
const BROTHERS_URL = 'https://ixdzs8.com/read/220620/';
const ORIGINAL_TOC = `https://ixdzs8.com/novel/clist/,{"method":"POST","body":"bid={{baseUrl.match(/\\/read\\/(\\d+)/)[1]}}","headers":{"Referer":"{{baseUrl}}"}}`;
const CHAPTER_URL = `<js>b=java.get("a");b+'p'+{{$.ordernum}}+'.html'</js>`;

const DETAIL_HTML =
  '<html><head><title>活着</title></head><body><h1>活着</h1><div class="bauthor"><a>余华</a></div></body></html>';
const BROTHERS_HTML =
  '<html><head><title>兄弟</title></head><body><h1>兄弟</h1><div class="bauthor"><a>余华</a></div></body></html>';
const HUOZHE_ARTICLE =
  '<html><body><article class="page-content"><section><p>我比现在年轻十岁的时候，获得了一个游手好闲的职业。</p></section></article></body></html>';
const BROTHERS_ARTICLE =
  '<html><body><article class="page-content"><section><p>兄弟俩在屋檐下避雨，谁也不肯先开口。</p></section></article></body></html>';

const HUOZHE_CLIST = JSON.stringify({
  rs: 200,
  data: [
    { ctype: '1', ordernum: '1', title: '正文' },
    { ctype: '0', ordernum: '2', title: '前言' },
    { ctype: '0', ordernum: '3', title: '第一章' },
  ],
});
const BROTHERS_CLIST = JSON.stringify({
  rs: 200,
  data: [
    { ctype: '0', ordernum: '1', title: '第一章' },
    { ctype: '0', ordernum: '2', title: '第二章' },
  ],
});

const CONTENT_RULE = `<js>
var base = java.get("a");
var text = (String(result).match(/<p>([^<]+)/) || ["", ""])[1];
base + "\\n" + text;
</js>`;

function source(
  name: string,
  init: string,
  extra?: { name?: string; author?: string; content?: string }
) {
  return {
    bookSourceName: name,
    bookSourceUrl: 'https://ixdzs8.com',
    searchUrl: '/bsearch?q={{key}}&page={{page}}',
    enabledCookieJar: true,
    ruleSearch: { bookList: '.u-list li', name: 'a@title', bookUrl: 'a@href' },
    ruleBookInfo: {
      init,
      name: extra?.name || 'h1@text',
      author: extra?.author || '.bauthor a@text',
      tocUrl: ORIGINAL_TOC,
    },
    ruleToc: {
      chapterList: '$.data[*]',
      chapterName: '$.title',
      chapterUrl: CHAPTER_URL,
      isVolume: '$.ctype',
    },
    ruleContent: { content: extra?.content || CONTENT_RULE },
  };
}

const JS_INIT = source('爱下JS预处理', '<js>java.put("a", baseUrl)</js>');
const AT_JS_INIT = source('爱下atjs预处理', '@js:\njava.put("a", baseUrl);');
const JSON_INIT = source(
  '爱下JSON预处理',
  '<js>java.put("a", baseUrl); ({ name: "从脚本来的书名", author: "从脚本来的作者" })</js>',
  { name: 'name', author: 'author' }
);
const PUT_INIT = source('爱下put预处理', '@put:{n:"h1@text"}', {
  name: '@get:{n}',
  content: 'section@p@html',
});
PUT_INIT.ruleToc = {
  ...PUT_INIT.ruleToc,
  chapterUrl:
    '<js>"https://ixdzs8.com/read/117097/p"+{{$.ordernum}}+".html#"+java.get("n")</js>',
};

function htmlResponse(body: string) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'text/html; charset=utf-8' },
    arrayBuffer: async () => Buffer.from(body),
  };
}

describe('ruleBookInfo.init 的 JS 变量', () => {
  beforeAll(() => {
    process.env.LEGADO_ENABLED = 'true';
    process.env.LEGADO_SOURCES_JSON = JSON.stringify([
      JS_INIT,
      AT_JS_INIT,
      JSON_INIT,
      PUT_INIT,
    ]);
    process.env.LEGADO_SEARCH_PAGES = '1';
  });

  beforeEach(() => {
    global.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = String(init?.method || 'GET').toUpperCase();
        const body = init?.body == null ? '' : String(init.body);
        if (method === 'POST' && url.includes('/novel/clist')) {
          if (body.includes('bid=220620')) return htmlResponse(BROTHERS_CLIST);
          return htmlResponse(HUOZHE_CLIST);
        }
        if (url.includes('/220620/p')) return htmlResponse(BROTHERS_ARTICLE);
        if (url.includes('/117097/p')) return htmlResponse(HUOZHE_ARTICLE);
        if (url.includes('/read/220620')) return htmlResponse(BROTHERS_HTML);
        if (url.includes('/read/117097')) return htmlResponse(DETAIL_HTML);
        return htmlResponse('<html></html>');
      }
    ) as unknown as typeof fetch;
    jest.resetModules();
  });

  async function load(name: string) {
    const mod = await import('@/lib/legado.client');
    const sourceItem = (await mod.legadoClient.getSources()).find(
      (item) => item.name === name
    );
    if (!sourceItem) throw new Error(`未加载书源 ${name}`);
    return { legadoClient: mod.legadoClient, source: sourceItem };
  }

  async function chaptersOf(name: string, detailHref: string) {
    const loaded = await load(name);
    const chapters = await loaded.legadoClient.getChaptersByBookId(
      loaded.source.id,
      detailHref,
      {
        detailHref,
      }
    );
    return { ...loaded, chapters };
  }

  it('执行 <js> init，章节地址用 java.get("a") 的详情页，正文也能读到同一变量', async () => {
    const { legadoClient, source, chapters } = await chaptersOf(
      '爱下JS预处理',
      HUOZHE_URL
    );

    expect(chapters.map((item) => item.href)).toEqual([
      'https://ixdzs8.com/read/117097/p2.html',
      'https://ixdzs8.com/read/117097/p3.html',
    ]);
    expect(
      chapters.every(
        (item) =>
          !item.href.includes('undefined') && !item.href.includes('clist')
      )
    ).toBe(true);

    const brothers = await legadoClient.getChaptersByBookId(
      source.id,
      BROTHERS_URL,
      { detailHref: BROTHERS_URL }
    );
    expect(brothers.map((item) => item.href)).toEqual([
      'https://ixdzs8.com/read/220620/p1.html',
      'https://ixdzs8.com/read/220620/p2.html',
    ]);

    const huozheAgain = await legadoClient.getChaptersByBookId(
      source.id,
      HUOZHE_URL,
      { detailHref: HUOZHE_URL }
    );
    expect(huozheAgain[0]?.href).toBe('https://ixdzs8.com/read/117097/p2.html');

    const brothersContent = await legadoClient.getChapterContent(
      source.id,
      brothers[0].href
    );
    expect(brothersContent.content).toContain(
      'https://ixdzs8.com/read/220620/'
    );
    expect(brothersContent.content).toContain('兄弟俩在屋檐下避雨');

    const huozheContent = await legadoClient.getChapterContent(
      source.id,
      huozheAgain[1].href
    );
    expect(huozheContent.content).toContain('https://ixdzs8.com/read/117097/');
    expect(huozheContent.content).toContain('我比现在年轻十岁的时候');
  });

  it('详情缓存命中后仍按这本书重跑 init，不沿用另一本书的 java.put', async () => {
    const { legadoClient, source } = await load('爱下JS预处理');
    await legadoClient.getBookDetail(source.id, BROTHERS_URL);
    await legadoClient.getBookDetail(source.id, HUOZHE_URL);

    const brothers = await legadoClient.getChaptersByBookId(
      source.id,
      BROTHERS_URL,
      { detailHref: BROTHERS_URL }
    );
    expect(brothers.map((item) => item.href)).toEqual([
      'https://ixdzs8.com/read/220620/p1.html',
      'https://ixdzs8.com/read/220620/p2.html',
    ]);
    const detail = await legadoClient.getBookDetail(source.id, BROTHERS_URL);
    expect(detail.title).toBe('兄弟');
    expect(detail.author).toBe('余华');
  });

  it('用 @js: 预处理同样能把详情地址交给章节规则', async () => {
    const { chapters } = await chaptersOf('爱下atjs预处理', BROTHERS_URL);
    expect(chapters.map((item) => item.href)).toEqual([
      'https://ixdzs8.com/read/220620/p1.html',
      'https://ixdzs8.com/read/220620/p2.html',
    ]);
  });

  it('JS 预处理返回对象时，详情字段改读这个对象，java.put 仍留给目录', async () => {
    const { legadoClient, source, chapters } = await chaptersOf(
      '爱下JSON预处理',
      HUOZHE_URL
    );
    const detail = await legadoClient.getBookDetail(source.id, HUOZHE_URL);
    expect(detail.title).toBe('从脚本来的书名');
    expect(detail.author).toBe('从脚本来的作者');
    expect(chapters[0]?.href).toBe('https://ixdzs8.com/read/117097/p2.html');
  });

  it('保留 @put: 预处理，@get 和 java.get 读到同一批详情字段', async () => {
    const { legadoClient, source, chapters } = await chaptersOf(
      '爱下put预处理',
      HUOZHE_URL
    );
    const detail = await legadoClient.getBookDetail(source.id, HUOZHE_URL);
    expect(detail.title).toBe('活着');
    expect(chapters.map((item) => item.href)).toEqual([
      'https://ixdzs8.com/read/117097/p2.html#活着',
      'https://ixdzs8.com/read/117097/p3.html#活着',
    ]);
    const content = await legadoClient.getChapterContent(
      source.id,
      'https://ixdzs8.com/read/117097/p3.html'
    );
    expect(content.content).toContain('我比现在年轻十岁的时候');
  });
});

export {};
