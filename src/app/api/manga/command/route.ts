import { NextRequest, NextResponse } from 'next/server';

import { CONFIRM_ADULT_COMMAND, mangaErrorPayload } from '@/lib/manga-error';
import { suwayomiClient } from '@/lib/suwayomi.client';

import { getAuthorizedUsername } from '../_utils';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const username = await getAuthorizedUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const body = (await request.json()) as {
      command?: string;
      mangaId?: string;
      sourceId?: string;
      title?: string;
      cover?: string;
      sourceName?: string;
    };
    const command = body.command?.trim();
    const mangaId = body.mangaId?.trim();
    const sourceId = body.sourceId?.trim();

    if (command !== CONFIRM_ADULT_COMMAND) {
      return NextResponse.json({ error: `不支持的指令: ${command || ''}` }, { status: 400 });
    }
    if (!mangaId || !sourceId) {
      return NextResponse.json({ error: '缺少 mangaId 或 sourceId' }, { status: 400 });
    }

    const detail = await suwayomiClient.confirmAdultAndGetDetail({
      mangaId,
      sourceId,
      title: body.title,
      cover: body.cover,
      sourceName: body.sourceName,
    });
    return NextResponse.json(detail);
  } catch (error) {
    const payload = mangaErrorPayload(error);
    return NextResponse.json(payload, { status: payload.action ? 403 : 500 });
  }
}
