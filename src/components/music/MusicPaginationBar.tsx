'use client';

import SearchPaginationBar from '@/components/SearchPaginationBar';
import { MUSIC_LIST_PAGE_SIZE, musicPageState } from '@/lib/music-page-data';

export default function MusicPaginationBar({
  totalItems,
  page,
  pageSize = MUSIC_LIST_PAGE_SIZE,
  hasMore,
  onPageChanged,
}: {
  totalItems?: number;
  page: number;
  pageSize?: number;
  hasMore?: boolean;
  onPageChanged: (page: number) => void;
}) {
  if (typeof totalItems === 'number') {
    const state = musicPageState(totalItems, page, pageSize);
    if (state.pageCount <= 1) return null;
    return (
      <SearchPaginationBar
        totalItems={totalItems}
        page={state.page}
        pageCount={state.pageCount}
        onPageChanged={onPageChanged}
      />
    );
  }

  const canPrev = page > 1;
  const canNext = Boolean(hasMore);
  if (!canPrev && !canNext) return null;

  return (
    <div className="mt-6 mb-2 flex items-center justify-end gap-3">
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => onPageChanged(page - 1)}
        className={`text-sm font-medium transition-colors ${
          canPrev
            ? 'text-green-500 hover:text-green-600'
            : 'cursor-not-allowed text-gray-300 dark:text-gray-600'
        }`}
      >
        上一页
      </button>
      <span className="text-sm font-semibold text-green-500">{page}</span>
      <button
        type="button"
        disabled={!canNext}
        onClick={() => onPageChanged(page + 1)}
        className={`text-sm font-medium transition-colors ${
          canNext
            ? 'text-green-500 hover:text-green-600'
            : 'cursor-not-allowed text-gray-300 dark:text-gray-600'
        }`}
      >
        下一页
      </button>
    </div>
  );
}
