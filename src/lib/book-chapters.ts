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

export function bookReadError(error: unknown): { status: number; body: Record<string, unknown> } {
  if (error instanceof BookChaptersNotApplicableError) {
    return { status: error.status, body: error.payload };
  }
  return {
    status: 500,
    body: { error: error instanceof Error ? error.message : String(error || '电子书请求失败') },
  };
}
