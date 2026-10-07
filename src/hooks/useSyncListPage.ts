'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { assignListPage } from '@/lib/list-return-state';

/**
 * 把当前列表页写进地址栏，用 replace 避免翻页变成浏览器后退的一站。
 * 其它查询参数原样保留。
 */
export function useSyncListPage(page: number, enabled = true) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!enabled) return;
    const nextParams = assignListPage(
      new URLSearchParams(searchParams.toString()),
      page
    );
    const nextQuery = nextParams.toString();
    if (nextQuery === searchParams.toString()) return;
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [enabled, page, pathname, router, searchParams]);
}
