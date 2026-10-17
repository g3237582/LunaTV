/**
 * 播放页测速窗口：普通源维持原超时，特殊源给海外 CDN 更长的时间，
 * 并且换源面板和优选走同一套代理地址。
 */
import { isSpecialSourceContext } from './special-source.client';
import {
  decideSpeedTestTimeout,
  DEFAULT_PANEL_SPEED_TEST_TIMEOUT_MS,
  DEFAULT_PREFER_SPEED_TEST_TIMEOUT_MS,
  prepareSpeedTestEpisodeUrl,
  readStoredSpeedTestTimeoutMs,
  resolveSpeedTestTimeoutMs,
  sourceNeedsLongerSpeedTest,
  SPECIAL_SOURCE_SPEED_TEST_TIMEOUT_MS,
} from './speed-test';

describe('resolveSpeedTestTimeoutMs', () => {
  it('普通源未设置时，换源面板仍是 4 秒，优选仍是 6 秒', () => {
    expect(
      resolveSpeedTestTimeoutMs({
        storedMs: null,
        fallbackMs: DEFAULT_PANEL_SPEED_TEST_TIMEOUT_MS,
        special: false,
      })
    ).toBe(4000);
    expect(
      resolveSpeedTestTimeoutMs({
        storedMs: null,
        fallbackMs: DEFAULT_PREFER_SPEED_TEST_TIMEOUT_MS,
        special: false,
      })
    ).toBe(6000);
  });

  it('普通源尊重用户把测速超时改成 10 秒', () => {
    expect(
      resolveSpeedTestTimeoutMs({
        storedMs: 10000,
        fallbackMs: DEFAULT_PREFER_SPEED_TEST_TIMEOUT_MS,
        special: false,
      })
    ).toBe(10000);
  });

  it('特殊源默认至少 20 秒，用户设得更高时跟着升高，且不超过 30 秒', () => {
    expect(SPECIAL_SOURCE_SPEED_TEST_TIMEOUT_MS).toBe(20000);
    expect(
      resolveSpeedTestTimeoutMs({
        storedMs: null,
        fallbackMs: DEFAULT_PANEL_SPEED_TEST_TIMEOUT_MS,
        special: true,
      })
    ).toBe(20000);
    expect(
      resolveSpeedTestTimeoutMs({
        storedMs: 4000,
        fallbackMs: DEFAULT_PREFER_SPEED_TEST_TIMEOUT_MS,
        special: true,
      })
    ).toBe(20000);
    expect(
      resolveSpeedTestTimeoutMs({
        storedMs: 30000,
        fallbackMs: DEFAULT_PANEL_SPEED_TEST_TIMEOUT_MS,
        special: true,
      })
    ).toBe(30000);
    expect(
      resolveSpeedTestTimeoutMs({
        storedMs: 45000,
        fallbackMs: DEFAULT_PANEL_SPEED_TEST_TIMEOUT_MS,
        special: true,
      })
    ).toBe(30000);
  });
});

describe('sourceNeedsLongerSpeedTest', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/play?source=normal&id=1');
    (
      window as Window & { RUNTIME_CONFIG?: { SPECIAL_SOURCE_APIS?: string[] } }
    ).RUNTIME_CONFIG = { SPECIAL_SOURCE_APIS: ['r18src'] };
  });

  it('special=1 的播放页，以及特殊源 key，都用更长超时', () => {
    expect(isSpecialSourceContext()).toBe(false);
    expect(sourceNeedsLongerSpeedTest('normal')).toBe(false);
    expect(sourceNeedsLongerSpeedTest('r18src')).toBe(true);

    window.history.replaceState({}, '', '/play?source=r18src&id=1&special=1');
    expect(sourceNeedsLongerSpeedTest('whatever')).toBe(true);
  });
});

describe('readStoredSpeedTestTimeoutMs', () => {
  it('没有保存过设置时返回 null，非法值也忽略', () => {
    const storage = {
      getItem: (key: string) => (key === 'speedTestTimeout' ? null : null),
    };
    expect(readStoredSpeedTestTimeoutMs(storage)).toBeNull();
    expect(
      readStoredSpeedTestTimeoutMs({
        getItem: () => 'abc',
      })
    ).toBeNull();
    expect(
      readStoredSpeedTestTimeoutMs({
        getItem: () => '10000',
      })
    ).toBe(10000);
  });
});

describe('prepareSpeedTestEpisodeUrl', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('代理模式的 m3u8 走和优选一样的 vod 代理', () => {
    expect(
      prepareSpeedTestEpisodeUrl({
        episodeUrl: 'https://cdn.example/a.m3u8',
        source: 'r18src',
        proxyMode: true,
      })
    ).toBe(
      '/api/proxy/vod/m3u8?url=' +
        encodeURIComponent('https://cdn.example/a.m3u8') +
        '&source=r18src'
    );
  });

  it('没开代理、以及明确的 mp4，保持原地址', () => {
    expect(
      prepareSpeedTestEpisodeUrl({
        episodeUrl: 'https://cdn.example/a.m3u8',
        source: 'normal',
        proxyMode: false,
      })
    ).toBe('https://cdn.example/a.m3u8');
    expect(
      prepareSpeedTestEpisodeUrl({
        episodeUrl: 'https://cdn.example/a.mp4',
        source: 'r18src',
        proxyMode: true,
      })
    ).toBe('https://cdn.example/a.mp4');
  });

  it('直链域名被记住需要代理时，走 directplay 代理', () => {
    localStorage.setItem(
      'directplay_proxy_domains',
      JSON.stringify(['slow.example'])
    );
    expect(
      prepareSpeedTestEpisodeUrl({
        episodeUrl: 'https://slow.example/play.m3u8',
        source: 'directplay',
        proxyToken: 'tok',
      })
    ).toBe(
      '/api/proxy-m3u8?url=' +
        encodeURIComponent('https://slow.example/play.m3u8') +
        '&source=directplay&token=tok'
    );
  });
});

describe('decideSpeedTestTimeout', () => {
  it('什么都没拿到才是超时', () => {
    expect(
      decideSpeedTestTimeout({
        manifestLoaded: false,
        metadataLoaded: false,
        speedCalculated: false,
        loadSpeed: '未知',
      })
    ).toEqual({ action: 'reject' });
  });

  it('m3u8 已到但速度没测完时保留源，并标成慢', () => {
    expect(
      decideSpeedTestTimeout({
        manifestLoaded: true,
        metadataLoaded: false,
        speedCalculated: false,
        loadSpeed: '未知',
      })
    ).toEqual({ action: 'resolve', loadSpeed: '慢' });
  });

  it('速度已经测出来时保留测速结果', () => {
    expect(
      decideSpeedTestTimeout({
        manifestLoaded: true,
        metadataLoaded: true,
        speedCalculated: true,
        loadSpeed: '1.2 MB/s',
      })
    ).toEqual({ action: 'resolve', loadSpeed: '1.2 MB/s' });
  });
});
