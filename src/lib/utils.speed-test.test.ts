/**
 * 播放页测速：m3u8 已经返回、分片还没测完时，不能把源当成超时丢掉。
 */
import { getVideoResolutionFromM3u8, SpeedTestError } from './utils';

type Handler = (event: string, data?: unknown) => void;

class FakeHls {
  static Events = {
    FRAG_LOADING: 'hlsFragLoading',
    FRAG_LOADED: 'hlsFragLoaded',
    ERROR: 'hlsError',
    MANIFEST_LOADED: 'hlsManifestLoaded',
    MANIFEST_PARSED: 'hlsManifestParsed',
  };

  static instances: FakeHls[] = [];

  config: {
    xhrSetup?: (xhr: XMLHttpRequest, url: string) => void;
    fragLoadPolicy?: {
      default?: { maxTimeToFirstByteMs?: number; maxLoadTimeMs?: number };
    };
  };
  destroyed = false;
  private listeners = new Map<string, Handler[]>();

  constructor(config?: FakeHls['config']) {
    this.config = { ...(config || {}) };
    FakeHls.instances.push(this);
  }

  on(event: string, callback: Handler) {
    const list = this.listeners.get(event) || [];
    list.push(callback);
    this.listeners.set(event, list);
  }

  emit(event: string, data?: unknown) {
    (this.listeners.get(event) || []).forEach((callback) =>
      callback(event, data)
    );
  }

  loadSource() {
    return undefined;
  }

  attachMedia() {
    return undefined;
  }

  destroy() {
    this.destroyed = true;
  }
}

jest.mock('hls.js', () => ({
  __esModule: true,
  default: FakeHls,
}));

function latestHls(): FakeHls {
  const instance = FakeHls.instances[FakeHls.instances.length - 1];
  if (!instance) {
    throw new Error('测速没有创建 HLS 实例');
  }
  return instance;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('getVideoResolutionFromM3u8 超时判定', () => {
  beforeEach(() => {
    FakeHls.instances = [];
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('m3u8 已加载但分片测速没完成时返回「慢」，而不是超时', async () => {
    const pending = getVideoResolutionFromM3u8(
      'https://cdn.example/video.m3u8',
      4000
    );
    await flushMicrotasks();

    latestHls().emit(FakeHls.Events.MANIFEST_LOADED);
    jest.advanceTimersByTime(4000);

    await expect(pending).resolves.toMatchObject({
      loadSpeed: '慢',
      quality: '未知',
    });
  });

  it('播放列表和分片都没返回时仍然是超时', async () => {
    const pending = getVideoResolutionFromM3u8(
      'https://cdn.example/dead.m3u8',
      4000
    );
    await flushMicrotasks();

    jest.advanceTimersByTime(4000);

    await expect(pending).rejects.toBeInstanceOf(SpeedTestError);
    await expect(pending).rejects.toMatchObject({ type: 'timeout' });
  });

  it('m3u8 已加载后分片加载超时，同样记为「慢」', async () => {
    const pending = getVideoResolutionFromM3u8(
      'https://cdn.example/slow-frag.m3u8',
      20000
    );
    await flushMicrotasks();

    const hls = latestHls();
    hls.emit(FakeHls.Events.MANIFEST_PARSED);
    hls.emit(FakeHls.Events.ERROR, {
      fatal: true,
      type: 'networkError',
      details: 'fragLoadTimeOut',
    });

    await expect(pending).resolves.toMatchObject({ loadSpeed: '慢' });
  });

  it('HLS 分片超时不短于本次测速窗口，避免 10 秒内部超时提前掐断', async () => {
    const pending = getVideoResolutionFromM3u8(
      'https://cdn.example/budget.m3u8',
      20000
    );
    await flushMicrotasks();

    const policy = latestHls().config.fragLoadPolicy?.default;
    expect(policy?.maxTimeToFirstByteMs).toBeGreaterThanOrEqual(20000);
    expect(policy?.maxLoadTimeMs).toBeGreaterThanOrEqual(20000);

    jest.advanceTimersByTime(20000);
    await pending.catch(() => undefined);
  });

  it('m3u8 已加载但分片无法访问时，仍然算无法访问', async () => {
    const pending = getVideoResolutionFromM3u8(
      'https://cdn.example/broken.m3u8',
      4000
    );
    await flushMicrotasks();

    const hls = latestHls();
    hls.emit(FakeHls.Events.MANIFEST_LOADED);
    hls.emit(FakeHls.Events.ERROR, {
      fatal: true,
      type: 'networkError',
      details: 'fragLoadError',
    });

    await expect(pending).rejects.toMatchObject({ type: 'unreachable' });
  });
});
