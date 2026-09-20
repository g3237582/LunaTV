import {
  encodeAdultChapterId,
  isAdultChapterId,
  parseAdultChapterId,
  parseSourceChapters,
} from './manga-adult-unlock';

const DM5_LIST_HTML = `
<div class="detail-list-title"><a class="block">单行本（7）</a><a class="order">倒序</a></div>
<div id="chapterlistload">
  <ul class="view-win-list detail-list-select" id="detail-list-select-1">
    <li><a href="/m1832286/" title="完结">第7话 完结 <span>（13P）</span></a></li>
    <li><a href="/m1830963/">第6话 <span>（16P）</span></a></li>
  </ul>
</div>
`;

const DM5_EXTENSION_HTML = `
<div class="detail-list-title"><a class="block">单行本（2）</a></div>
<div id="chapterlistload">
  <ul>
    <li>
      <a href="https://www.dm5.com/m100/">
        <p class="title">第1话</p>
        <p class="tip">2024-01-02</p>
      </a>
    </li>
  </ul>
</div>
`;

describe('parseSourceChapters', () => {
  it('parses dm5 chapterlistload anchors', () => {
    const chapters = parseSourceChapters(DM5_LIST_HTML, '123');
    expect(chapters.map((item) => item.name)).toEqual(['第7话 完结', '第6话']);
    expect(chapters[0].id).toBe(encodeAdultChapterId('123', '/m1832286/'));
    expect(chapters[0].pageCount).toBe(13);
    expect(chapters[1].pageCount).toBe(16);
  });

  it('parses extension-style title nodes', () => {
    const chapters = parseSourceChapters(DM5_EXTENSION_HTML, '88');
    expect(chapters).toHaveLength(1);
    expect(chapters[0].name).toBe('第1话');
    expect(parseAdultChapterId(chapters[0].id)?.url).toBe('/m100/');
  });

  it('returns no chapters when the age-gate bar is still present', () => {
    const chapters = parseSourceChapters(
      '<div class="warning-bar">点击此处继续阅读</div><div id="chapterlistload"></div>',
      '123'
    );
    expect(chapters).toEqual([]);
  });
});

describe('adult chapter ids', () => {
  it('round-trips manga and source url', () => {
    const id = encodeAdultChapterId('123', '/m1832286/');
    expect(isAdultChapterId(id)).toBe(true);
    expect(parseAdultChapterId(id)).toEqual({ mangaId: '123', url: '/m1832286/' });
  });
});
