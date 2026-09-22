import { NextRequest, NextResponse } from 'next/server';

import { bookReadError, resolveBookChaptersRequest } from '@/lib/book-chapters';
import { bookProvider } from '@/lib/book-provider';

import { getAuthorizedBooksUsername } from '../../_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const username = await getAuthorizedBooksUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId')?.trim();
    if (!sourceId) return NextResponse.json({ error: '缺少 sourceId' }, { status: 400 });

    const lookup = resolveBookChaptersRequest({
      bookId: searchParams.get('bookId'),
      href: searchParams.get('href'),
      detailHref: searchParams.get('detailHref'),
      bookUrl: searchParams.get('bookUrl'),
      tocHref: searchParams.get('tocHref'),
    });
    if (lookup.mode === 'missing') {
      return NextResponse.json({ error: '缺少 bookId、detailHref 或 href，无法定位章节目录' }, { status: 400 });
    }

    const chapters = lookup.mode === 'toc'
      ? await bookProvider.getChapters(sourceId, lookup.href)
      : await bookProvider.getChaptersByBookId(sourceId, lookup.bookId, { detailHref: lookup.detailHref });
    return NextResponse.json({ chapters }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const mapped = bookReadError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
