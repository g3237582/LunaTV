import { deflateRawSync } from 'zlib';

import {
  chaptersFromPlainText,
  extractTextFromArchive,
  findTextDownloadHref,
  isBrowserChallengeHtml,
} from '@/lib/legado-text-book';

function zipWithText(name: string, text: string, encoding: BufferEncoding = 'utf8', deflate = false): Uint8Array {
  return zipFromBytes(name, Buffer.from(text, encoding), deflate);
}

function zipFromBytes(name: string, payload: Buffer, deflate = false): Uint8Array {
  const body = deflate ? deflateRawSync(payload) : payload;
  const method = deflate ? 8 : 0;
  const nameBuf = Buffer.from(name, 'utf8');
  const crc = crc32(payload);
  const local = Buffer.alloc(30 + nameBuf.length + body.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(0, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(payload.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);
  nameBuf.copy(local, 30);
  body.copy(local, 30 + nameBuf.length);

  const central = Buffer.alloc(46 + nameBuf.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(0, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(payload.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt32LE(0, 42);
  nameBuf.copy(central, 46);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(local.length, 16);

  return new Uint8Array(Buffer.concat([local, central, end]));
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of Array.from(buf)) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

describe('legado text book fallback', () => {
  it('detects ixdzs browser-challenge pages as unreadable chapter html', () => {
    expect(
      isBrowserChallengeHtml('<html><head><title>正在验证浏览器</title></head><body>請稍等，正在進行安全驗證...</body></html>')
    ).toBe(true);
    expect(isBrowserChallengeHtml('<html><article class="page-content"><p>第一章</p></article></html>')).toBe(false);
  });

  it('finds the official TXT zip on an 爱下 detail page', () => {
    expect(
      findTextDownloadHref(
        '<a href="https://down7.ixdzs8.com/117097.zip">TXT下载</a>',
        'https://ixdzs8.com/read/117097/'
      )
    ).toBe('https://down7.ixdzs8.com/117097.zip');
  });

  it('infers the official ixdzs zip when the detail page omits the download link', () => {
    expect(findTextDownloadHref('<html></html>', 'https://ixdzs8.com/read/117097/')).toBe(
      'https://down7.ixdzs8.com/117097.zip'
    );
  });

  it('extracts gb18030 text from a zip archive', () => {
    const text = '『活着/作者:余华』\n------章节内容开始-------\n前言\n正文';
    const zip = zipWithText('活着.txt', text);
    expect(extractTextFromArchive(zip)).toContain('活着/作者:余华');
  });

  it('decodes official-style gb18030 zip bytes instead of utf-8 mojibake', () => {
    const payload = Buffer.from('a1babbeed7c52fd7f7d5df3ad3e0bbaaa1bb0d0a', 'hex');
    const zip = zipFromBytes('huozhe.txt', payload);
    expect(extractTextFromArchive(zip)).toContain('余华');
  });

  it('extracts deflated zip entries used by official downloads', () => {
    const text = '『活着/作者:余华』\n前言\n一位真正的作家';
    const zip = zipWithText('huozhe.txt', text, 'utf8', true);
    expect(extractTextFromArchive(zip)).toContain('一位真正的作家');
  });

  it('turns a downloaded txt into a readable chapter instead of an empty toc', () => {
    const built = chaptersFromPlainText(
      '『活着/作者:余华』\n------章节内容开始-------\n前言\n一位真正的作家永远只为内心写作。',
      'https://ixdzs8.com/read/117097/'
    );
    expect(built.chapters.length).toBeGreaterThan(0);
    expect(built.chapters[0].href.startsWith('legado-text:')).toBe(true);
    expect(built.contents.get(built.chapters[0].href)).toContain('一位真正的作家');
  });

  it('splits official ixdzs chapters glued to the previous paragraph', () => {
    const text = [
      '『活着/作者:余华』',
      '------章节内容开始-------',
      '正文',
      '内容还在处理中,请稍后重前言',
      '一位真正的作家永远只为内心写作。写下了高尚的作第一章 我比现在年轻十岁的时候，去乡间收集民间歌谣。',
      '路又坑坑洼第二章 早上几年的时候，家珍还是一个女学生。',
      '你也不要忘记我是凤霞第三章 福贵说到这里看着我嘿嘿笑了。',
    ].join('\n');
    const built = chaptersFromPlainText(text, 'https://ixdzs8.com/read/117097/');
    expect(built.chapters.map((item) => item.title)).toEqual(['前言', '第一章', '第二章', '第三章']);
    expect(built.contents.get(built.chapters[0].href)).toContain('一位真正的作家');
    expect(built.contents.get(built.chapters[1].href)).toContain('收集民间歌谣');
    expect(built.contents.get(built.chapters[2].href)).toContain('家珍还是一个女学生');
    expect(built.contents.get(built.chapters[3].href)).toContain('福贵说到这里看着我');
  });

  it('keeps standalone chapter lines and ignores 前言 after the first numbered chapter', () => {
    const built = chaptersFromPlainText(
      '前言\n作家自述。\n第一章\n福贵出场。\n这不是前言。\n第二章\n家珍回来了。',
      'https://ixdzs8.com/read/117097/'
    );
    expect(built.chapters.map((item) => item.title)).toEqual(['前言', '第一章', '第二章']);
    expect(built.contents.get(built.chapters[1].href)).toContain('这不是前言');
  });
});
