import {
  createTtlCache,
  firstAvailableSourceList,
  isLxTransportError,
  shouldStopLxSourceFallback,
} from '@/lib/music-discovery';

describe('isLxTransportError', () => {
  it('detects undici connect timeout from lxserver', () => {
    const error = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('Connect Timeout Error (attempted address: lxserver:9527, timeout: 10000ms)'), {
        name: 'ConnectTimeoutError',
        code: 'UND_ERR_CONNECT_TIMEOUT',
      }),
    });

    expect(isLxTransportError(error)).toBe(true);
    expect(shouldStopLxSourceFallback(error)).toBe(true);
  });

  it('does not treat empty-source application errors as transport failures', () => {
    expect(isLxTransportError(new Error('请求失败(404)'))).toBe(false);
    expect(shouldStopLxSourceFallback(new Error('请求失败(404)'))).toBe(false);
  });

  it('stops fallback when the music backend is not configured', () => {
    expect(shouldStopLxSourceFallback(new Error('音乐功能未开启'))).toBe(true);
    expect(shouldStopLxSourceFallback(new Error('未配置音乐服务地址'))).toBe(true);
  });
});

describe('firstAvailableSourceList', () => {
  it('returns the first source that produces a non-empty list', async () => {
    const load = jest.fn(async (source: string) => {
      if (source === 'wy') return { list: [] };
      return { list: [{ id: `${source}-1` }] };
    });

    const result = await firstAvailableSourceList({
      sources: ['wy', 'kg', 'kw'],
      load,
      unwrap: (payload: any) => payload.list,
    });

    expect(result).toEqual({
      source: 'kg',
      list: [{ id: 'kg-1' }],
      errors: [],
    });
    expect(load.mock.calls.map((call) => call[0])).toEqual(['wy', 'kg']);
  });

  it('does not try later sources when lxserver itself cannot be reached', async () => {
    const transportError = Object.assign(new TypeError('fetch failed'), {
      cause: { name: 'ConnectTimeoutError', code: 'UND_ERR_CONNECT_TIMEOUT' },
    });
    const load = jest.fn(async (source: string) => {
      if (source === 'wy') throw transportError;
      return { list: [{ id: `${source}-1` }] };
    });

    const result = await firstAvailableSourceList({
      sources: ['wy', 'kg', 'kw', 'tx', 'mg'],
      load,
      unwrap: (payload: any) => payload.list,
    });

    expect(result.list).toEqual([]);
    expect(result.errors[0]).toContain('wy:');
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('createTtlCache', () => {
  it('returns cached discovery data before ttl expires', () => {
    const cache = createTtlCache<string>(60_000);
    cache.set('wy', 'boards');
    expect(cache.get('wy')).toBe('boards');
  });
});
