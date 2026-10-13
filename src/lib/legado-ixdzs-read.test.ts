/**
 * @jest-environment node
 *
 * 爱下电子书这一类中文书源：详情页上的 tocUrl 是 POST /novel/clist/，
 * 目录规则读 JSON，章节页则先返回「正在验证浏览器」。
 * 压缩包下载失败或只拆出一章时，不能挡住这条目录和正文链路。
 */
jest.mock('@/lib/config', () => ({
  getConfig: jest.fn(async () => ({})),
}));

jest.mock('@/lib/server/ssrf', () => ({
  validateProxyUrlServerSide: jest.fn(async () => true),
}));

const DETAIL_URL = 'https://ixdzs8.com/read/117097/';
const CHAPTER_URL = 'https://ixdzs8.com/read/117097/p3.html';
const TOC_RULE = `{{java.put("a", baseUrl); "https://ixdzs8.com/novel/clist/"}},{"method":"POST","body":"bid={{baseUrl.match(/\\/read\\/(\\d+)/)[1]}}","headers":{"Referer":"{{baseUrl}}"}}`;

const DETAIL_HTML =
  '<html><head><title>活着</title></head><body><h1>活着</h1><div class="bauthor"><a>余华</a></div></body></html>';
const CHALLENGE_HTML =
  '<html><head><title>正在验证浏览器</title></head><body><p>請稍等，正在進行安全驗證...</p><script>let token = "tok-117097"; window.location.href = location.pathname + "?challenge=" + encodeURIComponent(token);</script></body></html>';
const ARTICLE_HTML =
  '<html><body><article class="page-content"><section><p>页面正文：我比现在年轻十岁的时候，获得了一个游手好闲的职业。</p><p>那一年的整个夏天。</p></section></article></body></html>';
const AJAX_TEXT = '脚本正文：我比现在年轻十岁的时候，去乡间收集民间歌谣。';
const CLIST = JSON.stringify({
  rs: 200,
  data: [
    { ctype: '1', ordernum: '1', title: '正文' },
    { ctype: '0', ordernum: '2', title: '前言' },
    { ctype: '0', ordernum: '3', title: '第一章' },
    { ctype: '0', ordernum: '4', title: '第二章' },
  ],
});

const JSON_SOURCE = {
  bookSourceName: '爱下JSON目录',
  bookSourceUrl: 'https://ixdzs8.com',
  searchUrl: '/bsearch?q={{key}}&page={{page}}',
  enabledCookieJar: true,
  ruleSearch: { bookList: '.u-list li', name: 'a@title', bookUrl: 'a@href' },
  ruleBookInfo: {
    name: 'h1@text',
    author: '.bauthor a@text',
    tocUrl: TOC_RULE,
  },
  ruleToc: {
    chapterList: '$.data[*]',
    chapterName: '$.title',
    chapterUrl: 'java.get("a")+"p"+result.ordernum+".html"',
    isVolume: '$.ctype',
  },
  ruleContent: { content: 'section@p@html' },
};

const FILTER_SOURCE = {
  ...JSON_SOURCE,
  bookSourceName: '爱下过滤目录',
  ruleToc: {
    chapterList: `$.data[*]
@js:
JSON.parse(result).filter(function (item) {
  if (String(item.ctype) === "1") return false;
  item.ordernum = java.get("a") + "p" + item.ordernum + ".html";
  return true;
})`,
    chapterName: 'title',
    chapterUrl: 'ordernum',
  },
};

const SCRIPT_SOURCE = {
  bookSourceName: '爱下脚本目录',
  bookSourceUrl: 'https://ixdzs8.com',
  searchUrl: '/bsearch?q={{key}}&page={{page}}',
  enabledCookieJar: true,
  ruleSearch: { bookList: '.u-list li', name: 'a@title', bookUrl: 'a@href' },
  ruleBookInfo: { name: 'h1@text', author: '.bauthor a@text' },
  ruleToc: {
    chapterList: `@js:
var bidMatch = baseUrl.match(/read\\/(\\d+)/);
if (!bidMatch) {
  [];
} else {
  var resp = java.post(source.getKey() + "/novel/clist/", "bid=" + bidMatch[1], {});
  var json = JSON.parse(resp.body()).data;
  var result = [];
  for (var i = 0; i < json.length; i++) {
    var item = json[i];
    if (item.ctype === "1") continue;
    item.url = source.getKey() + "/read/" + bidMatch[1] + "/p" + item.ordernum + ".html";
    result.push(item);
  }
  result;
}`,
    chapterName: 'title',
    chapterUrl: 'url',
  },
  ruleContent: {
    content: `@js:
java.ajax("https://ixdzs8.com/read/117097/p3.txt");`,
  },
};

function headerValue(headers: unknown, name: string): string {
  if (!headers || typeof headers !== 'object') return '';
  const bag = headers as { get?: (key: string) => string | null } & Record<
    string,
    unknown
  >;
  if (typeof bag.get === 'function')
    return bag.get(name) || bag.get(name.toLowerCase()) || '';
  const found = Object.keys(bag).find(
    (key) => key.toLowerCase() === name.toLowerCase()
  );
  return found ? String(bag[found] ?? '') : '';
}

function htmlResponse(body: string, setCookie?: string) {
  return {
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => {
        const key = name.toLowerCase();
        if (key === 'content-type') return 'text/html; charset=utf-8';
        if (key === 'set-cookie') return setCookie || null;
        return null;
      },
    },
    arrayBuffer: async () => Buffer.from(body),
  };
}

describe('爱下电子书 Legado 目录与正文', () => {
  const calls: Array<{
    url: string;
    method: string;
    body: string;
    cookie: string;
  }> = [];

  beforeAll(() => {
    process.env.LEGADO_ENABLED = 'true';
    process.env.LEGADO_SOURCES_JSON = JSON.stringify([
      JSON_SOURCE,
      FILTER_SOURCE,
      SCRIPT_SOURCE,
    ]);
    process.env.LEGADO_SEARCH_PAGES = '1';
  });

  beforeEach(() => {
    calls.length = 0;
    global.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = String(init?.method || 'GET').toUpperCase();
        const body = init?.body == null ? '' : String(init.body);
        const cookie = headerValue(init?.headers, 'cookie');
        calls.push({ url, method, body, cookie });
        if (method === 'POST' && url.includes('/novel/clist'))
          return htmlResponse(CLIST);
        if (url.includes('/117097.zip') || url.includes('down7.ixdzs8.com'))
          return htmlResponse('损坏的全文');
        if (url.endsWith('/p3.txt')) return htmlResponse(AJAX_TEXT);
        if (url.includes('challenge=')) {
          if (!cookie.includes('PHPSESSID=abc'))
            return htmlResponse(CHALLENGE_HTML, 'PHPSESSID=abc');
          return htmlResponse(ARTICLE_HTML);
        }
        if (url.includes('/p3.html'))
          return htmlResponse(CHALLENGE_HTML, 'PHPSESSID=abc');
        if (url.includes('/read/117097')) return htmlResponse(DETAIL_HTML);
        return htmlResponse('<html></html>');
      }
    ) as unknown as typeof fetch;
    jest.resetModules();
  });

  async function load(name: string) {
    const mod = await import('@/lib/legado.client');
    const source = (await mod.legadoClient.getSources()).find(
      (item) => item.name === name
    );
    if (!source) throw new Error(`未加载书源 ${name}`);
    return { legadoClient: mod.legadoClient, source };
  }

  async function openChapters(name: string) {
    const { legadoClient, source } = await load(name);
    const chapters = await legadoClient.getChaptersByBookId(
      source.id,
      DETAIL_URL,
      { detailHref: DETAIL_URL }
    );
    return { legadoClient, source, chapters };
  }

  it('用详情里的 tocUrl POST 目录，并算出 java.get 章节地址', async () => {
    const { chapters } = await openChapters('爱下JSON目录');

    expect(chapters.map((item) => item.title)).toEqual([
      '前言',
      '第一章',
      '第二章',
    ]);
    expect(chapters.map((item) => item.href)).toEqual([
      'https://ixdzs8.com/read/117097/p2.html',
      CHAPTER_URL,
      'https://ixdzs8.com/read/117097/p4.html',
    ]);
    expect(
      calls.some(
        (call) =>
          call.method === 'POST' &&
          call.url.includes('/novel/clist') &&
          call.body.includes('bid=117097')
      )
    ).toBe(true);
    expect(calls.some((call) => call.url.includes('down7.ixdzs8.com'))).toBe(
      false
    );
  });

  it('在 JSON 目录上执行 @js 过滤，卷节点不进章节列表', async () => {
    const { chapters } = await openChapters('爱下过滤目录');
    expect(chapters.map((item) => item.title)).toEqual([
      '前言',
      '第一章',
      '第二章',
    ]);
    expect(chapters[1]?.href).toBe(CHAPTER_URL);
  });

  it('在目录脚本里用 java.post 取到多章，而不是损坏的 TXT', async () => {
    const { chapters } = await openChapters('爱下脚本目录');
    expect(chapters.map((item) => item.title)).toEqual([
      '前言',
      '第一章',
      '第二章',
    ]);
    expect(chapters[1]?.href).toBe(CHAPTER_URL);
    expect(chapters.every((item) => item.href.includes('/p'))).toBe(true);
  });

  it('完成浏览器验证后，section 规则能抽出中文正文', async () => {
    const { legadoClient, source } = await load('爱下JSON目录');
    const chapter = await legadoClient.getChapterContent(
      source.id,
      CHAPTER_URL
    );

    expect(chapter.content).toContain('我比现在年轻十岁的时候');
    expect(chapter.content).toContain('那一年的整个夏天');
    expect(
      calls.some(
        (call) =>
          call.url.includes('challenge=tok-117097') &&
          call.cookie.includes('PHPSESSID=abc')
      )
    ).toBe(true);
  });

  it('正文脚本可以通过 java.ajax 取回章节文本', async () => {
    const { legadoClient, source } = await load('爱下脚本目录');
    const chapter = await legadoClient.getChapterContent(
      source.id,
      CHAPTER_URL
    );
    expect(chapter.content).toContain('去乡间收集民间歌谣');
  });
});
