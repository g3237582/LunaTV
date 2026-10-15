/* eslint-disable @typescript-eslint/no-explicit-any */
import { AsyncLocalStorage } from 'async_hooks';

/**
 * Legado 的 java.put / java.get 挂在书上，不挂在进程全局。
 * 详情 init 写入的变量要在之后的目录、章节和正文请求里还能按这本书取回。
 * 并发打开两本书时，各自的变量放在异步上下文里，避免后打开的书盖掉先打开的书。
 */
const variableStore = new Map<string, any>();
const bookVariableStorage = new AsyncLocalStorage<{
  key: string;
  vars: Map<string, any>;
}>();
const bookVariableSnapshots = new Map<string, Map<string, any>>();
const tocOwners = new Map<string, string>();
const knownBookDetails = new Map<string, Set<string>>();

function bookVariableKey(sourceId: string, detailHref: string) {
  return `${sourceId}\n${detailHref}`;
}

export function activeVariables(): Map<string, any> {
  return bookVariableStorage.getStore()?.vars || variableStore;
}

export function isCurrentBookScope(
  sourceId: string,
  detailHref: string
): boolean {
  return (
    bookVariableStorage.getStore()?.key ===
    bookVariableKey(sourceId, detailHref.trim())
  );
}

export async function withBookVariables<T>(
  sourceId: string,
  detailHref: string,
  fn: () => Promise<T>
): Promise<T> {
  const href = detailHref.trim();
  if (!href) return fn();
  const key = bookVariableKey(sourceId, href);
  if (bookVariableStorage.getStore()?.key === key) return fn();
  const saved = bookVariableSnapshots.get(key);
  // 第一次进入这本书时继承源级别变量（搜索规则里的 java.put）。
  // 之后用这本书自己的快照，避免另一本书刚写进全局的值串过来。
  const vars = saved ? new Map(saved) : new Map(variableStore);
  return bookVariableStorage.run({ key, vars }, async () => {
    try {
      return await fn();
    } finally {
      bookVariableSnapshots.set(key, new Map(vars));
    }
  });
}

export function rememberBookDetail(
  sourceId: string,
  detailHref: string,
  tocHref?: string
) {
  const href = detailHref.trim();
  if (!sourceId || !href) return;
  let known = knownBookDetails.get(sourceId);
  if (!known) {
    known = new Set<string>();
    knownBookDetails.set(sourceId, known);
  }
  known.add(href);
  const toc = tocHref?.trim();
  if (toc) tocOwners.set(`${sourceId}\n${toc}`, href);
}

export function lookupBookDetail(
  sourceId: string,
  chapterHref: string,
  tocHref?: string
): string {
  const toc = tocHref?.trim();
  if (toc) {
    const owner = tocOwners.get(`${sourceId}\n${toc}`);
    if (owner) return owner;
  }
  const known = knownBookDetails.get(sourceId);
  if (!known || !chapterHref) return '';
  let best = '';
  // tsconfig target 是 es5，直接 for...of Set 会让 next build 的类型检查失败。
  for (const detail of Array.from(known)) {
    if (!chapterHref.startsWith(detail)) continue;
    const next = chapterHref.charAt(detail.length);
    // 详情地址通常以 / 结尾，章节页接在后面，例如 /read/220620/p1.html。
    const boundaryOk = !next || detail.endsWith('/') || /[/?#]/.test(next);
    if (!boundaryOk) continue;
    if (detail.length > best.length) best = detail;
  }
  return best;
}
