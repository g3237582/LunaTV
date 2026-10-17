import {
  isSpecialSourceContext,
  isSpecialSourceKey,
} from './special-source.client';

/** 换源面板未设置时的测速窗口，和原来的 localStorage 默认值一致。 */
export const DEFAULT_PANEL_SPEED_TEST_TIMEOUT_MS = 4000;

/** 优选在用户没改过设置时仍用 6 秒，避免把普通源的默认等待改短。 */
export const DEFAULT_PREFER_SPEED_TEST_TIMEOUT_MS = 6000;

/**
 * 特殊源视频在海外 CDN 上，浏览器拉 m3u8 和首个分片经常要 4–30 秒。
 * 沿用 4 秒会把还能播的源全部标成超时。
 */
export const SPECIAL_SOURCE_SPEED_TEST_TIMEOUT_MS = 20000;

/** 和设置面板滑条上限一致，避免一次测速无限挂起。 */
export const MAX_SPEED_TEST_TIMEOUT_MS = 30000;

const MIN_SPEED_TEST_TIMEOUT_MS = 4000;

export const SPEED_TEST_TIMEOUT_STORAGE_KEY = 'speedTestTimeout';

/** 分片没在窗口内测完，但播放列表已经回来：源是慢，不是死。 */
export const SPEED_TEST_SLOW_LABEL = '慢';

const DIRECTPLAY_PROXY_DOMAINS_KEY = 'directplay_proxy_domains';

export function readStoredSpeedTestTimeoutMs(
  storage: {
    getItem: (key: string) => string | null;
  } | null = typeof window === 'undefined' ? null : window.localStorage
): number | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SPEED_TEST_TIMEOUT_STORAGE_KEY);
    if (raw == null || raw.trim() === '') return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    return value;
  } catch {
    return null;
  }
}

function clampTimeout(value: number): number {
  return Math.min(
    MAX_SPEED_TEST_TIMEOUT_MS,
    Math.max(MIN_SPEED_TEST_TIMEOUT_MS, Math.round(value))
  );
}

/**
 * 普通源：用用户保存的 speedTestTimeout，没保存过就用各自原来的默认值。
 * 特殊源：至少 20 秒；用户设得更高则跟着升高，上限 30 秒。
 */
export function resolveSpeedTestTimeoutMs(options: {
  storedMs: number | null;
  fallbackMs: number;
  special: boolean;
}): number {
  const base = clampTimeout(options.storedMs ?? options.fallbackMs);
  if (!options.special) return base;
  return Math.max(
    base,
    Math.min(SPECIAL_SOURCE_SPEED_TEST_TIMEOUT_MS, MAX_SPEED_TEST_TIMEOUT_MS)
  );
}

/** special=1 的播放页，或这条源本身是特殊源，都走更长的测速窗口。 */
export function sourceNeedsLongerSpeedTest(source?: string): boolean {
  if (isSpecialSourceContext()) return true;
  return !!source && isSpecialSourceKey(source);
}

export function isDirectplayDomainProxied(url: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const domain = new URL(url).hostname;
    const domains: string[] = JSON.parse(
      window.localStorage.getItem(DIRECTPLAY_PROXY_DOMAINS_KEY) || '[]'
    );
    return Array.isArray(domains) && domains.includes(domain);
  } catch {
    return false;
  }
}

function isLikelyM3u8(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('.m3u') ||
    !lower.match(/\.(mp4|flv|webm|mkv|avi|mov)(\?.*)?$/)
  );
}

/**
 * 优选和换源面板共用的测速地址。
 * 开了代理的 m3u8 必须走服务端代理，否则浏览器侧测速会和真实播放路径不一致。
 */
export function prepareSpeedTestEpisodeUrl(input: {
  episodeUrl: string;
  source: string;
  proxyMode?: boolean;
  proxyToken?: string;
}): string {
  const { episodeUrl, source, proxyMode, proxyToken } = input;
  if (
    !episodeUrl ||
    episodeUrl.startsWith('/api/proxy/') ||
    episodeUrl.startsWith('/api/proxy-m3u8')
  ) {
    return episodeUrl;
  }

  if (!isLikelyM3u8(episodeUrl)) return episodeUrl;

  if (source === 'directplay') {
    if (!isDirectplayDomainProxied(episodeUrl)) return episodeUrl;
    const tokenParam = proxyToken
      ? `&token=${encodeURIComponent(proxyToken)}`
      : '';
    return `/api/proxy-m3u8?url=${encodeURIComponent(
      episodeUrl
    )}&source=directplay${tokenParam}`;
  }

  if (proxyMode) {
    return `/api/proxy/vod/m3u8?url=${encodeURIComponent(
      episodeUrl
    )}&source=${encodeURIComponent(source)}`;
  }

  return episodeUrl;
}

export type SpeedTestTimeoutDecision =
  | { action: 'resolve'; loadSpeed: string }
  | { action: 'reject' };

/**
 * 超时窗口结束时怎么收场。
 * 播放列表已经到达，只是分片测速没完成：保留该源并标成「慢」。
 * 连 m3u8 都没回来，才是超时。
 */
export function decideSpeedTestTimeout(progress: {
  manifestLoaded: boolean;
  metadataLoaded: boolean;
  speedCalculated: boolean;
  loadSpeed: string;
}): SpeedTestTimeoutDecision {
  const playlistArrived =
    progress.manifestLoaded ||
    progress.metadataLoaded ||
    progress.speedCalculated;
  if (!playlistArrived) return { action: 'reject' };

  const measured =
    progress.speedCalculated ||
    (progress.loadSpeed !== '未知' && progress.loadSpeed !== '');
  return {
    action: 'resolve',
    loadSpeed: measured ? progress.loadSpeed : SPEED_TEST_SLOW_LABEL,
  };
}

/**
 * 让 HLS.js 的清单/分片超时不短于外层测速窗口。
 * 默认分片首字节超时只有 10 秒，海外 CDN 会在外层 20 秒窗口用完之前被掐断。
 */
export function buildSpeedTestHlsConfig(timeoutMs: number): {
  manifestLoadPolicy: {
    default: {
      maxTimeToFirstByteMs: number;
      maxLoadTimeMs: number;
      timeoutRetry: null;
      errorRetry: null;
    };
  };
  playlistLoadPolicy: {
    default: {
      maxTimeToFirstByteMs: number;
      maxLoadTimeMs: number;
      timeoutRetry: null;
      errorRetry: null;
    };
  };
  fragLoadPolicy: {
    default: {
      maxTimeToFirstByteMs: number;
      maxLoadTimeMs: number;
      timeoutRetry: null;
      errorRetry: null;
    };
  };
  manifestLoadingTimeOut: number;
  manifestLoadingMaxRetry: number;
  levelLoadingTimeOut: number;
  levelLoadingMaxRetry: number;
  fragLoadingTimeOut: number;
  fragLoadingMaxRetry: number;
} {
  const budget = Math.max(1000, timeoutMs) + 1000;
  const policy = {
    default: {
      maxTimeToFirstByteMs: budget,
      maxLoadTimeMs: budget,
      timeoutRetry: null,
      errorRetry: null,
    },
  };
  return {
    manifestLoadPolicy: policy,
    playlistLoadPolicy: policy,
    fragLoadPolicy: policy,
    manifestLoadingTimeOut: budget,
    manifestLoadingMaxRetry: 0,
    levelLoadingTimeOut: budget,
    levelLoadingMaxRetry: 0,
    fragLoadingTimeOut: budget,
    fragLoadingMaxRetry: 0,
  };
}
