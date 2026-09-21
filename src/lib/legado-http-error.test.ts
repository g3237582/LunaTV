import { formatLegadoHttpError, rewriteLegadoFetchError } from '@/lib/legado-http-error';

describe('formatLegadoHttpError', () => {
  it('explains a 403 directory scrape as a source-site rejection', () => {
    expect(formatLegadoHttpError(403, 'toc')).toBe(
      '源站拒绝了目录抓取（可能需登录/Cookie/更新请求头）'
    );
  });

  it('keeps ordinary HTTP failures as status-prefixed messages', () => {
    expect(formatLegadoHttpError(502)).toBe('请求失败: 502');
  });
});

describe('rewriteLegadoFetchError', () => {
  it('upgrades a wrapped 403 into the toc-specific message', () => {
    expect(rewriteLegadoFetchError(new Error('请求失败: 403'), 'toc').message).toBe(
      '源站拒绝了目录抓取（可能需登录/Cookie/更新请求头）'
    );
  });

  it('upgrades the generic 403 wording when the caller knows this was a toc fetch', () => {
    expect(
      rewriteLegadoFetchError(new Error('源站拒绝了请求（可能需登录/Cookie/更新请求头）'), 'toc')
        .message
    ).toBe('源站拒绝了目录抓取（可能需登录/Cookie/更新请求头）');
  });
});
