/**
 * Legado 书源脚本里的 java.ajax / java.post 是同步的。
 * 脚本在 vm 里跑，遇到网络请求时抛出这个错误，外层用真实 HTTP 完成后再重放脚本。
 */
export class LegadoJsHttpPause extends Error {
  readonly cacheKey: string;

  constructor(
    readonly request: {
      method: string;
      url: string;
      body?: string;
      headers?: Record<string, string>;
    }
  ) {
    super('legado-js-http');
    this.name = 'LegadoJsHttpPause';
    const headers = request.headers || {};
    const sorted = Object.keys(headers)
      .sort()
      .reduce<Record<string, string>>((acc, key) => {
        acc[key] = headers[key];
        return acc;
      }, {});
    this.cacheKey = JSON.stringify({
      method: (request.method || 'GET').toUpperCase(),
      url: request.url,
      body: request.body || '',
      headers: sorted,
    });
  }
}

export interface LegadoJsHttpHit {
  status: number;
  body: string;
  url: string;
}

export function normalizeJsHeaders(headers: unknown): Record<string, string> {
  if (!headers) return {};
  if (typeof headers === 'string') {
    try {
      return normalizeJsHeaders(JSON.parse(headers));
    } catch {
      return {};
    }
  }
  if (typeof headers !== 'object') return {};
  const out: Record<string, string> = {};
  Object.entries(headers as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    out[key] = String(value);
  });
  return out;
}

/** 对齐 Legado StrResponse：脚本里通过 resp.body() 取响应文本。 */
export function makeLegadoStrResponse(hit: LegadoJsHttpHit) {
  return {
    body: () => hit.body,
    code: () => hit.status,
    url: () => hit.url,
    headers: () => ({}),
    toString: () => hit.body,
  };
}
