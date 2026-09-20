export const MUSIC_DISCOVERY_TIMEOUT_MS = 20000;
export const MUSIC_DISCOVERY_CACHE_TTL_MS = 5 * 60 * 1000;

export function isLxTransportError(error: unknown): boolean {
  const err = error as {
    name?: string;
    message?: string;
    code?: string;
    cause?: { name?: string; code?: string; message?: string };
  };
  const name = `${err?.name || ''} ${err?.cause?.name || ''}`;
  const code = `${err?.code || ''} ${err?.cause?.code || ''}`;
  const message = `${err?.message || ''} ${err?.cause?.message || ''}`;
  return (
    name.includes('TimeoutError') ||
    name.includes('AbortError') ||
    name.includes('ConnectTimeoutError') ||
    code.includes('UND_ERR_CONNECT') ||
    code.includes('UND_ERR_HEADERS_TIMEOUT') ||
    code.includes('UND_ERR_BODY_TIMEOUT') ||
    code.includes('ECONNREFUSED') ||
    code.includes('ENOTFOUND') ||
    code.includes('EAI_AGAIN') ||
    code.includes('ETIMEDOUT') ||
    message.includes('Connect Timeout') ||
    message.includes('fetch failed') ||
    message.includes('aborted')
  );
}

export function shouldStopLxSourceFallback(error: unknown): boolean {
  const message = String((error as Error)?.message || '');
  if (message.includes('音乐功能未开启') || message.includes('未配置音乐服务')) {
    return true;
  }
  return isLxTransportError(error);
}

export async function firstAvailableSourceList<T>(options: {
  sources: string[];
  load: (source: string) => Promise<unknown>;
  unwrap: (payload: unknown) => T[];
}): Promise<{ source: string; list: T[]; errors: string[] }> {
  const sources = options.sources.filter((item, index, arr) => arr.indexOf(item) === index);
  const errors: string[] = [];
  let lastSource = sources[0] || '';

  for (const source of sources) {
    lastSource = source;
    try {
      const list = options.unwrap(await options.load(source));
      if (Array.isArray(list) && list.length > 0) {
        return { source, list, errors };
      }
    } catch (error) {
      errors.push(`${source}: ${(error as Error).message}`);
      if (shouldStopLxSourceFallback(error)) {
        break;
      }
    }
  }

  return { source: lastSource, list: [], errors };
}

export function createTtlCache<T>(ttlMs: number) {
  const map = new Map<string, { expiresAt: number; value: T }>();
  return {
    get(key: string): T | undefined {
      const hit = map.get(key);
      if (!hit) return undefined;
      if (hit.expiresAt <= Date.now()) {
        map.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key: string, value: T) {
      map.set(key, { expiresAt: Date.now() + ttlMs, value });
    },
  };
}
