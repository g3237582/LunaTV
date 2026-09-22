import type { BookSource } from './book.types';

export const CHAPTERS_NOT_APPLICABLE_CODE = 'chapters_not_applicable';

export type BookSourceKind = 'legado' | 'opds';

export type BookChaptersNotApplicablePayload = {
  error: string;
  code: typeof CHAPTERS_NOT_APPLICABLE_CODE;
  sourceType: 'opds';
  format: 'epub' | 'pdf';
  acquisitionHint: string;
  manifestHint: string;
};

export function bookSourceKind(source?: Pick<BookSource, 'type' | 'legado'> | null): BookSourceKind {
  if (source?.type === 'legado' || source?.legado) return 'legado';
  return 'opds';
}

export function chaptersNotApplicablePayload(
  source?: Pick<BookSource, 'preferFormat'> | null
): BookChaptersNotApplicablePayload {
  const format = source?.preferFormat?.find((item) => item === 'epub' || item === 'pdf') || 'epub';
  return {
    error:
      '当前书源为文件/OPDS 资源，章节目录接口不适用。请使用 /api/books/file 或 /api/books/read/manifest 获取整本文件。',
    code: CHAPTERS_NOT_APPLICABLE_CODE,
    sourceType: 'opds',
    format,
    acquisitionHint: '/api/books/file',
    manifestHint: '/api/books/read/manifest',
  };
}

export class BookChaptersNotApplicableError extends Error {
  readonly status = 422;
  readonly payload: BookChaptersNotApplicablePayload;

  constructor(source?: Pick<BookSource, 'preferFormat' | 'type' | 'legado'> | null) {
    const payload = chaptersNotApplicablePayload(source);
    super(payload.error);
    this.name = 'BookChaptersNotApplicableError';
    this.payload = payload;
  }
}

export function assertChaptersSupported(source: Pick<BookSource, 'type' | 'legado' | 'preferFormat'>): void {
  if (bookSourceKind(source) !== 'legado') {
    throw new BookChaptersNotApplicableError(source);
  }
}

export type BookChaptersRequest =
  | { mode: 'toc'; href: string }
  | { mode: 'detail'; bookId: string; detailHref?: string }
  | { mode: 'missing' };

function cleanQuery(value?: string | null) {
  return value?.trim() || '';
}

/**
 * 章节目录定位。
 * 有 `detailHref` 时它是主定位符，优先于 `bookId` / `bookUrl` / `href`。
 * 没有 `detailHref` 时，再用 `bookUrl`，然后才是和 `bookId` 一起传来的 `href`。
 * `tocHref` 是已经解析好的目录地址。
 * 仅有 `href`、没有 bookId / detailHref / bookUrl 时，`href` 仍表示目录地址。
 */
export function resolveBookChaptersRequest(input: {
  bookId?: string | null;
  href?: string | null;
  detailHref?: string | null;
  bookUrl?: string | null;
  tocHref?: string | null;
}): BookChaptersRequest {
  const bookId = cleanQuery(input.bookId);
  const href = cleanQuery(input.href);
  const detailHref = cleanQuery(input.detailHref);
  const bookUrl = cleanQuery(input.bookUrl);
  const tocHref = cleanQuery(input.tocHref);

  if (tocHref) return { mode: 'toc', href: tocHref };
  if (detailHref) return { mode: 'detail', bookId: bookId || detailHref, detailHref };
  if (bookId) {
    const fallback = bookUrl || href;
    return { mode: 'detail', bookId, detailHref: fallback || undefined };
  }
  if (bookUrl) return { mode: 'detail', bookId: bookUrl, detailHref: bookUrl };
  if (href) return { mode: 'toc', href };
  return { mode: 'missing' };
}

export function buildBookChaptersPath(sourceId: string, bookId: string, detailHref?: string) {
  const params = new URLSearchParams({ sourceId, bookId });
  const href = detailHref?.trim();
  if (href) params.set('detailHref', href);
  return `/api/books/read/chapters?${params.toString()}`;
}

export function bookReadError(error: unknown): { status: number; body: Record<string, unknown> } {
  if (error instanceof BookChaptersNotApplicableError) {
    return { status: error.status, body: error.payload };
  }
  return {
    status: 500,
    body: { error: error instanceof Error ? error.message : String(error || '电子书请求失败') },
  };
}
