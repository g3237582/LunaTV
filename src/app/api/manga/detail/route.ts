import { NextRequest, NextResponse } from 'next/server';

import { mangaErrorPayload } from '@/lib/manga-error';
import { suwayomiClient } from '@/lib/suwayomi.client';

import { getAuthorizedUsername } from '../_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const username = await getAuthorizedUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const { searchParams } = new URL(request.url);
    const mangaId = searchParams.get('mangaId')?.trim();
    const sourceId = searchParams.get('sourceId')?.trim();

    if (!mangaId || !sourceId) {
      return NextResponse.json({ error: '缺少 mangaId 或 sourceId' }, { status: 400 });
    }

    const confirmAdult =
      searchParams.get('confirmAdult') === '1' ||
      searchParams.get('confirmAdult') === 'true';
    const input = {
      mangaId,
      sourceId,
      title: searchParams.get('title') || undefined,
      cover: searchParams.get('cover') || undefined,
      sourceName: searchParams.get('sourceName') || undefined,
      description: searchParams.get('description') || undefined,
      author: searchParams.get('author') || undefined,
      status: searchParams.get('status') || undefined,
    };
    const detail = confirmAdult
      ? await suwayomiClient.confirmAdultAndGetDetail(input)
      : await suwayomiClient.getMangaDetail(input);

    return NextResponse.json(detail);
  } catch (error) {
    const payload = mangaErrorPayload(error);
    return NextResponse.json(payload, { status: payload.action ? 403 : 500 });
  }
}
