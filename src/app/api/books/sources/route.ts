import { NextRequest, NextResponse } from 'next/server';

import { bookProvider } from '@/lib/book-provider';
import {
  BOOK_SOURCE_PAGE_SIZE,
  filterBookSources,
  pageBookSources,
  summarizeBookSource,
} from '@/lib/book-source-summary';

import { getAuthorizedBooksUsername } from '../_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const username = await getAuthorizedBooksUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const includeId = searchParams.get('includeId')?.trim() || '';
    const page = Number(searchParams.get('page') || '1');
    const pageSize = Math.min(
      100,
      Math.max(1, Number(searchParams.get('pageSize') || BOOK_SOURCE_PAGE_SIZE) || BOOK_SOURCE_PAGE_SIZE)
    );
    const summaries = (await bookProvider.getSources()).map(summarizeBookSource);
    const filtered = filterBookSources(summaries, query);
    const sources = pageBookSources(filtered, page, pageSize);
    if (includeId && !sources.some((item) => item.id === includeId)) {
      const extra = summaries.find((item) => item.id === includeId);
      if (extra) sources.unshift(extra);
    }
    return NextResponse.json(
      {
        sources: sources.slice(0, pageSize),
        total: filtered.length,
        allCount: summaries.length,
        catalogCount: summaries.filter((item) => item.capabilities?.catalogSupported).length,
        searchCount: summaries.filter((item) => item.capabilities?.searchSupported).length,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30',
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
