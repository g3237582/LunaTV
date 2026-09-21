export type LegadoFetchPurpose = 'toc' | 'content' | 'generic';

// 猫眼看书等订阅源的 403 通常来自线上规则过期或缺少 Cookie/请求头。
// 仓库内没有这些私有书源 URL，部署实例需要自行刷新订阅，不要在代码里写死源站地址。
export function formatLegadoHttpError(
  status: number,
  purpose: LegadoFetchPurpose = 'generic'
): string {
  if (status === 401 || status === 403) {
    if (purpose === 'toc') {
      return '源站拒绝了目录抓取（可能需登录/Cookie/更新请求头）';
    }
    if (purpose === 'content') {
      return '源站拒绝了正文抓取（可能需登录/Cookie/更新请求头）';
    }
    return '源站拒绝了请求（可能需登录/Cookie/更新请求头）';
  }
  return `请求失败: ${status}`;
}

export function rewriteLegadoFetchError(
  error: unknown,
  purpose: LegadoFetchPurpose = 'generic'
): Error {
  const message = error instanceof Error ? error.message : String(error || '');
  const statusMatch = /请求失败:\s*(\d+)/.exec(message);
  const rejected = /源站拒绝/.test(message);
  const status = statusMatch ? Number(statusMatch[1]) : rejected ? 403 : undefined;
  if (status === 401 || status === 403) {
    return new Error(formatLegadoHttpError(status, purpose));
  }
  return error instanceof Error ? error : new Error(message || '请求失败');
}
