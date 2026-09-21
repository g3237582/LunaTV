import { NextRequest, NextResponse } from 'next/server';

import { bookReadError } from '@/lib/book-chapters';
import { bookProvider } from '@/lib/book-provider';

import { getAuthorizedBooksUsername } from '../../_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const username = await getAuthorizedBooksUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId')?.trim();
    const bookId = searchParams.get('bookId')?.trim();
    const href = searchParams.get('href')?.trim() || '';

    if (!sourceId) return NextResponse.json({ error: '缺少 sourceId' }, { status: 400 });

    const chapters = bookId
      ? await bookProvider.getChaptersByBookId(sourceId, bookId)
      : href
        ? await bookProvider.getChapters(sourceId, href)
        : null;
    if (!chapters) return NextResponse.json({ error: '缺少 bookId 或 href，无法定位章节目录' }, { status: 400 });
    return NextResponse.json({ chapters }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const mapped = bookReadError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
