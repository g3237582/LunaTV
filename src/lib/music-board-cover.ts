const BOARD_COVER_KEYS = [
  'img',
  'pic',
  'cover',
  'coverImgUrl',
  'picUrl',
  'image',
  'imageUrl',
  'albumPicUrl',
] as const;

function cleanUrl(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 榜单列表上的封面。lxserver 的 /leaderboard/boards 通常只有 id/name/bangid，
 * 但个别源或后续版本会把图放在 img / pic / coverImgUrl 上。有就用，避免再打歌曲接口。
 */
export function pickBoardCoverUrl(
  item: Record<string, unknown> | null | undefined
): string {
  if (!item) return '';
  for (const key of BOARD_COVER_KEYS) {
    const url = cleanUrl(item[key]);
    if (url) return url;
  }
  return '';
}

/** 榜单歌曲里的专辑图。歌曲对象经过 normalizeLxSong 后封面在 cover，原始 lx 对象在 img。 */
export function pickFirstSongCover(
  songs: Array<Record<string, unknown> | null | undefined>
): string {
  for (const song of songs) {
    if (!song) continue;
    const url =
      cleanUrl(song.cover) || cleanUrl(song.img) || cleanUrl(song.pic);
    if (url) return url;
  }
  return '';
}

export interface DiscoveryBoard {
  id: string;
  name: string;
  cover?: string;
  source: string;
}

/** 把 lx /leaderboard/boards 的一项收成发现页用的榜单。id 继续用 bangid，别改成内部 id。 */
export function mapLxBoards(
  items: Array<Record<string, unknown>>,
  source: string
): DiscoveryBoard[] {
  return items.map((item) => {
    const cover = pickBoardCoverUrl(item);
    const board: DiscoveryBoard = {
      id: String(item.bangid || item.id || ''),
      name: String(item.name || ''),
      source,
    };
    if (cover) board.cover = cover;
    return board;
  });
}

export async function fillMissingBoardCovers<
  T extends { id: string; cover?: string }
>(
  boards: T[],
  loadCover: (boardId: string) => Promise<string>,
  options?: { concurrency?: number }
): Promise<T[]> {
  const concurrency = Math.max(1, options?.concurrency ?? 4);
  const next = boards.map((board) => ({ ...board }));
  const pending = next
    .map((board, index) => ({ board, index }))
    .filter(({ board }) => board.id && !cleanUrl(board.cover));

  if (pending.length === 0) return next;

  let cursor = 0;
  const worker = async () => {
    while (cursor < pending.length) {
      const current = pending[cursor];
      cursor += 1;
      try {
        const cover = cleanUrl(await loadCover(current.board.id));
        if (cover) next[current.index] = { ...next[current.index], cover };
      } catch {
        // 这一张榜单的歌曲接口失败时留空，卡片退回目录号版式。
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, pending.length) }, () =>
      worker()
    )
  );
  return next;
}

export function missingBoardCoverIds(
  boards: Array<{ id?: string; cover?: string; pic?: string }>
): string[] {
  return boards
    .filter(
      (board) => board.id && !cleanUrl(board.cover) && !cleanUrl(board.pic)
    )
    .map((board) => board.id as string);
}

/** 只补还没有封面的榜单，已有 cover/pic 的不动。 */
export function mergeBoardCovers<
  T extends { id: string; cover?: string; pic?: string }
>(
  boards: T[],
  covers: Record<string, string | undefined>
): { boards: T[]; changed: boolean } {
  let changed = false;
  const next = boards.map((board) => {
    const cover = cleanUrl(covers[board.id]);
    if (!cover || cleanUrl(board.cover) || cleanUrl(board.pic)) return board;
    changed = true;
    return { ...board, cover };
  });
  return { boards: changed ? next : boards, changed };
}

/**
 * 榜单列表接口后返回时，保住已经解析好的封面。
 * 只沿用同一音源的封面：不同音源的 bangid 会撞号。
 */
export function preserveBoardCovers<
  T extends { id: string; source?: string; cover?: string; pic?: string }
>(previous: T[], next: T[], source: string): T[] {
  const previousCover = new Map(
    previous
      .filter((item) => (item.source || source) === source)
      .map((item) => [item.id, cleanUrl(item.cover) || cleanUrl(item.pic)])
  );
  return next.map((item) => {
    if (cleanUrl(item.cover) || cleanUrl(item.pic)) return item;
    const cover = previousCover.get(item.id);
    return cover ? { ...item, cover } : item;
  });
}
