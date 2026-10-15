/**
 * @jest-environment node
 *
 * 连到爱下电子书，确认《活着》能取出多章目录和中文正文。
 * 默认跳过，避免 CI 依赖外网：LEGADO_IXDZS_LIVE=1 时执行。
 */
jest.mock('@/lib/config', () => ({
  getConfig: jest.fn(async () => ({})),
}));

const live = process.env.LEGADO_IXDZS_LIVE === '1';
const describeLive = live ? describe : describe.skip;

const DETAIL_URL = 'https://ixdzs8.com/read/117097/';
const HEADER = JSON.stringify({
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
});

const ORIGINAL_TOC = String.raw`https://ixdzs8.com/novel/clist/,{"method":"POST","body":"bid={{baseUrl.match(/\/read\/(\d+)/)[1]}}","headers":{"Referer":"{{baseUrl}}"}}`;

const ORIGINAL_SOURCE = {
  bookSourceName: '爱下电子书原始预处理',
  bookSourceUrl: 'https://ixdzs8.com',
  searchUrl: '/bsearch?q={{key}}&page={{page}}',
  enabledCookieJar: true,
  header: HEADER,
  ruleSearch: {
    bookList: '.u-list li',
    name: 'a@title',
    bookUrl: 'a@href',
  },
  ruleBookInfo: {
    init: '<js>java.put("a", baseUrl)</js>',
    name: 'h1@text',
    author: '.bauthor a@text',
    tocUrl: ORIGINAL_TOC,
  },
  ruleToc: {
    chapterList: '$.data[*]',
    chapterName: '$.title',
    chapterUrl: `<js>b=java.get("a");b+'p'+{{$.ordernum}}+'.html'</js>`,
    isVolume: '$.ctype',
  },
  ruleContent: { content: 'section@p@html' },
};

const BROTHERS_URL = 'https://ixdzs8.com/read/220620/';

const POST_SOURCE = {
  bookSourceName: '爱下电子书',
  bookSourceUrl: 'https://ixdzs8.com',
  searchUrl: '/bsearch?q={{key}}&page={{page}}',
  enabledCookieJar: true,
  header: HEADER,
  ruleSearch: {
    bookList: '.u-list li',
    name: 'a@title',
    bookUrl: 'a@href',
  },
  ruleBookInfo: {
    name: 'h1@text',
    author: '.bauthor a@text',
    tocUrl: String.raw`{{java.put("a", baseUrl); "https://ixdzs8.com/novel/clist/"}},{"method":"POST","body":"bid={{baseUrl.match(/\/read\/(\d+)/)[1]}}","headers":{"Referer":"{{baseUrl}}"}}`,
  },
  ruleToc: {
    chapterList: '$.data[*]',
    chapterName: '$.title',
    chapterUrl: `<js>b=java.get("a");b+'p'+{{$.ordernum}}+'.html'</js>`,
    isVolume: '$.ctype',
  },
  ruleContent: { content: 'section@p@html' },
};

const SCRIPT_SOURCE = {
  bookSourceName: '爱下电子书脚本',
  bookSourceUrl: 'https://ixdzs8.com',
  searchUrl: '/bsearch?q={{key}}&page={{page}}',
  enabledCookieJar: true,
  header: HEADER,
  ruleBookInfo: {
    name: '.n-text h1@text',
    author: '.bauthor a@text',
  },
  ruleToc: {
    chapterList: String.raw`@js:
var bidMatch = baseUrl.match(/read\/(\d+)/);
if (!bidMatch) {
  [];
} else {
  var bid = bidMatch[1];
  var resp = java.post(source.getKey() + "/novel/clist/", "bid=" + bid, {});
  var json = JSON.parse(resp.body()).data;
  var result = [];
  for (var i = 0; i < json.length; i++) {
    var item = json[i];
    if (item.ctype === "1") continue;
    item.url = source.getKey() + "/read/" + bid + "/p" + item.ordernum + ".html";
    result.push(item);
  }
  result;
}`,
    chapterName: 'title',
    chapterUrl: 'url',
  },
  ruleContent: {
    content: String.raw`@js:
var tokenMatch = src.match(/token\s*=\s*"([^"]+)"/);
var html = src;
if (tokenMatch) {
  var token = tokenMatch[1];
  var tourl = baseUrl + "?challenge=" + encodeURIComponent(token);
  html = java.ajax(tourl);
}
var section = html.match(/<section[^>]*>\s*([\s\S]*?)\s*<\/section>/i);
if (!section) {
  "";
} else {
  var text = section[1]
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<\/?p[^>]*>/gi, "")
    .trim();
  text;
}`,
  },
};

async function readBook(rule: { bookSourceName: string }, detailUrl: string) {
  const previousSources = process.env.LEGADO_SOURCES_JSON;
  const previousEnabled = process.env.LEGADO_ENABLED;
  process.env.LEGADO_ENABLED = 'true';
  process.env.LEGADO_SOURCES_JSON = JSON.stringify([rule]);
  jest.resetModules();
  try {
    const { legadoClient } = await import('@/lib/legado.client');
    const source = (await legadoClient.getSources()).find(
      (item) => item.name === rule.bookSourceName
    );
    if (!source) throw new Error('书源未加载');
    const chapters = await legadoClient.getChaptersByBookId(
      source.id,
      detailUrl,
      { detailHref: detailUrl }
    );
    const chapter =
      chapters.find((item) => item.title.includes('第一章')) || chapters[0];
    if (!chapter) throw new Error('没有章节');
    const content = await legadoClient.getChapterContent(
      source.id,
      chapter.href,
      detailUrl
    );
    return { chapters, chapter, content };
  } finally {
    if (previousSources === undefined) delete process.env.LEGADO_SOURCES_JSON;
    else process.env.LEGADO_SOURCES_JSON = previousSources;
    if (previousEnabled === undefined) delete process.env.LEGADO_ENABLED;
    else process.env.LEGADO_ENABLED = previousEnabled;
  }
}

function readHuozhe(rule: { bookSourceName: string }) {
  return readBook(rule, DETAIL_URL);
}

describeLive('爱下电子书线上阅读', () => {
  jest.setTimeout(180000);

  beforeAll(() => {
    if (typeof global.fetch !== 'function') {
      // Jest 27 的 node 环境没有带上 Node 22 的全局 fetch。
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nodeFetch = require('node-fetch');
      global.fetch = (nodeFetch.default || nodeFetch) as typeof fetch;
    }
  });

  it('POST 目录和章节页验证之后能读到《活着》正文', async () => {
    const { chapters, chapter, content } = await readHuozhe(POST_SOURCE);
    expect(chapters.length).toBeGreaterThan(3);
    expect(chapters.some((item) => item.title.includes('第一章'))).toBe(true);
    expect(chapter.href).toMatch(/\/read\/117097\/p\d+\.html/);
    expect(content.content).toContain('我比现在年轻十岁');
  });

  it('java.post 目录和正文脚本也能读到《活着》', async () => {
    const { chapters, chapter, content } = await readHuozhe(SCRIPT_SOURCE);
    expect(chapters.length).toBeGreaterThan(3);
    expect(chapter.href).toMatch(/\/read\/117097\/p\d+\.html/);
    expect(content.content).toContain('我比现在年轻十岁');
  });

  it('原始 <js> init 的 java.put 让《活着》和《兄弟》章节落到详情页，正文是中文', async () => {
    const huozhe = await readBook(ORIGINAL_SOURCE, DETAIL_URL);
    expect(huozhe.chapters.length).toBeGreaterThan(3);
    expect(
      huozhe.chapters.every((item) =>
        /^https:\/\/ixdzs8\.com\/read\/117097\/p\d+\.html$/.test(item.href)
      )
    ).toBe(true);
    expect(huozhe.chapter.href).toMatch(/\/read\/117097\/p\d+\.html$/);
    expect(huozhe.content.content).toContain('我比现在年轻十岁');

    const brothers = await readBook(ORIGINAL_SOURCE, BROTHERS_URL);
    expect(brothers.chapters.length).toBeGreaterThan(1);
    expect(
      brothers.chapters.every((item) =>
        /^https:\/\/ixdzs8\.com\/read\/220620\/p\d+\.html$/.test(item.href)
      )
    ).toBe(true);
    expect(brothers.content.content).toMatch(/[\u4e00-\u9fff]/);
  });
});
