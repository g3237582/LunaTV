'use client';

import React from 'react';

import { searchListSummaryText } from '@/lib/search-list-paging';

interface SearchPaginationBarProps {
  totalItems: number;
  page: number;
  pageCount: number;
  onPageChanged: (page: number) => void;
}

const SearchPaginationBar: React.FC<SearchPaginationBarProps> = ({
  totalItems,
  page,
  pageCount,
  onPageChanged,
}) => {
  if (totalItems <= 0) {
    return null;
  }

  const canPrev = page > 1;
  const canNext = pageCount > 0 && page < pageCount;

  return (
    <div className='mt-6 mb-2 flex items-center gap-3 px-0 sm:px-2'>
      <div className='min-w-0 flex-1 text-sm text-gray-500 dark:text-gray-400'>
        {searchListSummaryText({ totalItems, page, pageCount })}
      </div>
      <button
        type='button'
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
      <span className='text-sm font-semibold text-green-500'>
        {page}/{pageCount}
      </span>
      <button
        type='button'
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
};

export default SearchPaginationBar;
