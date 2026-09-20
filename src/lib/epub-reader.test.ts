import {
  EPUBJS_SCRIPT_SRC,
  getEpubReaderReopenKey,
  isEpubZipBuffer,
  sanitizeEpubDisplayTarget,
} from '@/lib/epub-reader';

describe('isEpubZipBuffer', () => {
  it('accepts a ZIP/EPUB local file header', () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    expect(isEpubZipBuffer(bytes.buffer)).toBe(true);
  });

  it('rejects HTML or empty payloads that epubjs would then crash on', () => {
    expect(isEpubZipBuffer(Uint8Array.from([0x3c, 0x68, 0x74, 0x6d, 0x6c]))).toBe(
      false
    );
    expect(isEpubZipBuffer(new ArrayBuffer(0))).toBe(false);
  });
});

describe('sanitizeEpubDisplayTarget', () => {
  it('drops empty or whitespace targets so display() opens the first spine item', () => {
    expect(sanitizeEpubDisplayTarget('')).toBeUndefined();
    expect(sanitizeEpubDisplayTarget('   ')).toBeUndefined();
    expect(sanitizeEpubDisplayTarget(undefined)).toBeUndefined();
  });

  it('keeps CFI and chapter hrefs', () => {
    expect(sanitizeEpubDisplayTarget('epubcfi(/6/4[chap01]!/4/2/2)')).toBe(
      'epubcfi(/6/4[chap01]!/4/2/2)'
    );
    expect(sanitizeEpubDisplayTarget('text/chapter1.xhtml')).toBe(
      'text/chapter1.xhtml'
    );
  });
});

describe('getEpubReaderReopenKey', () => {
  it('stays stable when only chapter title or callback identity would change', () => {
    const key = getEpubReaderReopenKey({
      sourceId: 'wenku8',
      bookId: 'urn:wenku8articleid:3622',
      acquisitionHref: 'https://opds.wol.moe/zh_CN/book/3622.epub',
      mode: 'paginated',
    });
    expect(
      getEpubReaderReopenKey({
        sourceId: 'wenku8',
        bookId: 'urn:wenku8articleid:3622',
        acquisitionHref: 'https://opds.wol.moe/zh_CN/book/3622.epub',
        mode: 'paginated',
      })
    ).toBe(key);
  });

  it('changes when the book or pagination mode changes', () => {
    const base = {
      sourceId: 'wenku8',
      bookId: 'urn:wenku8articleid:3622',
      acquisitionHref: 'https://opds.wol.moe/zh_CN/book/3622.epub',
      mode: 'paginated' as const,
    };
    expect(getEpubReaderReopenKey({ ...base, mode: 'scrolled' })).not.toBe(
      getEpubReaderReopenKey(base)
    );
    expect(getEpubReaderReopenKey({ ...base, bookId: 'other' })).not.toBe(
      getEpubReaderReopenKey(base)
    );
  });
});

describe('EPUBJS_SCRIPT_SRC', () => {
  it('pins epubjs so an unversioned CDN build cannot break display()', () => {
    expect(EPUBJS_SCRIPT_SRC).toContain('epubjs@0.3.93');
  });
});
