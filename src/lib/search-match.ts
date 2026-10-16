/**
 * 搜索相关性排序。
 * 比较前先 trim、忽略大小写，并把全角折成半角，再去掉空白和标点。
 * 同一档内保持原顺序，避免打乱已有的来源权重。
 */

const IGNORED_SEARCH_CHARS = /[\s\p{P}\p{S}]+/gu;

export function normalizeSearchMatchText(value: string): string {
  return (value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(IGNORED_SEARCH_CHARS, '');
}

/** 0 精确，1 前缀，2 包含，3 其余。空关键词不参与排序。 */
export function searchMatchTier(text: string, query: string): 0 | 1 | 2 | 3 {
  const normalizedQuery = normalizeSearchMatchText(query);
  if (!normalizedQuery) return 3;
  const normalizedText = normalizeSearchMatchText(text);
  if (!normalizedText) return 3;
  if (normalizedText === normalizedQuery) return 0;
  if (normalizedText.startsWith(normalizedQuery)) return 1;
  if (normalizedText.includes(normalizedQuery)) return 2;
  return 3;
}

function tiebreakRank(value: string | undefined, query: string): number {
  const normalizedQuery = normalizeSearchMatchText(query);
  if (!normalizedQuery || value == null) return 1;
  return normalizeSearchMatchText(value) === normalizedQuery ? 0 : 1;
}

export function compareSearchMatch(
  leftTitle: string,
  rightTitle: string,
  query: string,
  leftTiebreak?: string,
  rightTiebreak?: string
): number {
  const tierDiff =
    searchMatchTier(leftTitle, query) - searchMatchTier(rightTitle, query);
  if (tierDiff !== 0) return tierDiff;
  return tiebreakRank(leftTiebreak, query) - tiebreakRank(rightTiebreak, query);
}

export interface SearchRankOptions<T> {
  getTiebreak?: (item: T) => string | undefined;
  /** 比标题档位更优先，例如用户手动选择的年份排序。返回 0 则继续比匹配档。 */
  compareBefore?: (left: T, right: T) => number;
  /** 匹配档和次级精确字段都相同之后的比较。返回 0 则保留原顺序。 */
  compareAfter?: (left: T, right: T) => number;
}

export function rankBySearchMatch<T>(
  items: readonly T[],
  query: string,
  getTitle: (item: T) => string,
  options?: SearchRankOptions<T>
): T[] {
  const getTiebreak = options?.getTiebreak;
  const compareBefore = options?.compareBefore;
  const compareAfter = options?.compareAfter;
  const decorated = items.map((item, index) => ({ item, index }));
  decorated.sort((left, right) => {
    if (compareBefore) {
      const primary = compareBefore(left.item, right.item);
      if (primary !== 0) return primary;
    }
    const byMatch = compareSearchMatch(
      getTitle(left.item),
      getTitle(right.item),
      query,
      getTiebreak?.(left.item),
      getTiebreak?.(right.item)
    );
    if (byMatch !== 0) return byMatch;
    if (compareAfter) {
      const extra = compareAfter(left.item, right.item);
      if (extra !== 0) return extra;
    }
    return left.index - right.index;
  });
  return decorated.map((entry) => entry.item);
}

/**
 * 聚合卡片按组内最佳标题分档。
 * 精确命中的条目挪到组内最前，卡片标题才会显示精确名。
 */
export function rankSearchGroups<T>(
  groups: ReadonlyArray<readonly [string, readonly T[]]>,
  query: string,
  getTitle: (item: T) => string
): Array<[string, T[]]> {
  const prepared = groups.map(([key, items]) => {
    return [key, rankBySearchMatch(items, query, getTitle)] as [string, T[]];
  });
  return rankBySearchMatch(prepared, query, ([, items]) =>
    items.length > 0 ? getTitle(items[0]) : ''
  );
}
