import type { BookSource } from '@/lib/book.types';
import {
  assertChaptersSupported,
  BookChaptersNotApplicableError,
  bookReadError,
  bookSourceKind,
  buildBookChaptersPath,
  CHAPTERS_NOT_APPLICABLE_CODE,
  chaptersNotApplicablePayload,
  resolveBookChaptersRequest,
} from '@/lib/book-chapters';

function opdsSource(partial: Partial<BookSource> = {}): BookSource {
  return {
    id: 'gutenberg-zh',
    name: '古腾堡中文',
    type: 'opds',
    url: 'https://www.gutenberg.org/ebooks/search/?query=&default_prefix=lang_zh',
    preferFormat: ['epub'],
    ...partial,
  };
}

function legadoSource(): BookSource {
  return {
    id: 'legado_1',
    name: '笔仙阁',
    type: 'legado',
    url: 'https://m.bixiange.me',
    legado: { bookSourceName: '笔仙阁', searchUrl: '/search?q={{key}}' },
  };
}

describe('bookSourceKind', () => {
  it('treats OPDS/EPUB sources as file-based, not Legado', () => {
    expect(bookSourceKind(opdsSource())).toBe('opds');
    expect(bookSourceKind({ type: 'opds', url: 'https://opds.example', id: 'x', name: 'x' })).toBe('opds');
  });

  it('treats explicit Legado sources as chapter-capable', () => {
    expect(bookSourceKind(legadoSource())).toBe('legado');
    expect(bookSourceKind({ id: 'x', name: 'x', url: 'https://x', legado: {} })).toBe('legado');
  });
});

describe('OPDS chapters rejection path', () => {
  it('builds a 422 payload that points clients at file/manifest APIs', () => {
    const payload = chaptersNotApplicablePayload(opdsSource());
    expect(payload).toEqual({
      error:
        '当前书源为文件/OPDS 资源，章节目录接口不适用。请使用 /api/books/file 或 /api/books/read/manifest 获取整本文件。',
      code: CHAPTERS_NOT_APPLICABLE_CODE,
      sourceType: 'opds',
      format: 'epub',
      acquisitionHint: '/api/books/file',
      manifestHint: '/api/books/read/manifest',
    });
  });

  it('uses the source preferFormat when it is pdf', () => {
    expect(chaptersNotApplicablePayload(opdsSource({ preferFormat: ['pdf'] })).format).toBe('pdf');
  });

  it('throws before any Legado chapter lookup for Gutenberg-style sources', () => {
    expect(() => assertChaptersSupported(opdsSource())).toThrow(BookChaptersNotApplicableError);
    try {
      assertChaptersSupported(opdsSource());
    } catch (error) {
      expect(error).toBeInstanceOf(BookChaptersNotApplicableError);
      const mapped = bookReadError(error);
      expect(mapped.status).toBe(422);
      expect(mapped.body.code).toBe(CHAPTERS_NOT_APPLICABLE_CODE);
      expect(mapped.body.format).toBe('epub');
      expect(String(mapped.body.error)).not.toContain('未找到对应的 Legado 书源');
    }
  });

  it('allows Legado sources through so chapter lookup can run', () => {
    expect(() => assertChaptersSupported(legadoSource())).not.toThrow();
  });

  it('keeps an opaque bookId and uses the search detail href as the TOC fallback', () => {
    expect(
      resolveBookChaptersRequest({
        bookId: '377259',
        href: 'https://books.example/info/santi',
      })
    ).toEqual({
      mode: 'detail',
      bookId: '377259',
      detailHref: 'https://books.example/info/santi',
    });
    expect(
      resolveBookChaptersRequest({
        bookId: '377259',
        detailHref: 'https://books.example/info/santi',
        href: 'https://books.example/toc/santi',
      })
    ).toEqual({
      mode: 'detail',
      bookId: '377259',
      detailHref: 'https://books.example/info/santi',
    });
  });

  it('treats tocHref as a direct chapter list and href-only as the legacy TOC url', () => {
    expect(resolveBookChaptersRequest({ bookId: '377259', tocHref: 'https://books.example/toc/santi' })).toEqual({
      mode: 'toc',
      href: 'https://books.example/toc/santi',
    });
    expect(resolveBookChaptersRequest({ href: 'https://books.example/toc/santi' })).toEqual({
      mode: 'toc',
      href: 'https://books.example/toc/santi',
    });
    expect(resolveBookChaptersRequest({})).toEqual({ mode: 'missing' });
  });

  it('puts detailHref on the chapters URL so clients can recover when bookId is opaque', () => {
    expect(buildBookChaptersPath('legado_1', '377259', 'https://books.example/info/santi')).toBe(
      '/api/books/read/chapters?sourceId=legado_1&bookId=377259&detailHref=https%3A%2F%2Fbooks.example%2Finfo%2Fsanti'
    );
  });

  it('maps ordinary failures to 500 without claiming the source is missing', () => {
    expect(bookReadError(new Error('源站拒绝了目录抓取（可能需登录/Cookie/更新请求头）'))).toEqual({
      status: 500,
      body: { error: '源站拒绝了目录抓取（可能需登录/Cookie/更新请求头）' },
    });
  });
});
