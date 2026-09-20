import {
  canProcessAnime4KVideoFrame,
  describeAnime4KEffect,
  describeAnime4KHud,
  isFsrMode,
  parseSuperResMode,
  resolveAnime4KOutputScale,
} from './anime4k-policy';

describe('resolveAnime4KOutputScale', () => {
  it('uses 2x for 1080p even when the window is already filled', () => {
    expect(
      resolveAnime4KOutputScale({
        sourceWidth: 1920,
        sourceHeight: 1080,
        displayWidth: 960,
        displayHeight: 540,
        devicePixelRatio: 1,
        userScale: 'auto',
      })
    ).toBe(2);
  });

  it('uses 2x when 720p is shown on a 1080p screen', () => {
    expect(
      resolveAnime4KOutputScale({
        sourceWidth: 1280,
        sourceHeight: 720,
        displayWidth: 1920,
        displayHeight: 1080,
        devicePixelRatio: 1,
        userScale: 'auto',
      })
    ).toBe(2);
  });

  it('uses 2x for 1080p on a 4K screen', () => {
    expect(
      resolveAnime4KOutputScale({
        sourceWidth: 1920,
        sourceHeight: 1080,
        displayWidth: 3840,
        displayHeight: 2160,
        devicePixelRatio: 1,
        userScale: 'auto',
      })
    ).toBe(2);
  });

  it('uses 3x so a 480p source can fill a 1080p screen', () => {
    expect(
      resolveAnime4KOutputScale({
        sourceWidth: 640,
        sourceHeight: 480,
        displayWidth: 1920,
        displayHeight: 1080,
        devicePixelRatio: 1,
        userScale: 'auto',
      })
    ).toBe(3);
  });

  it('uses 3x so a 576p source can fill a 1080p screen', () => {
    expect(
      resolveAnime4KOutputScale({
        sourceWidth: 720,
        sourceHeight: 576,
        displayWidth: 1920,
        displayHeight: 1080,
        devicePixelRatio: 1,
        userScale: 'auto',
      })
    ).toBe(3);
  });

  it('keeps 4K sources at 1x so auto never renders 8K', () => {
    expect(
      resolveAnime4KOutputScale({
        sourceWidth: 3840,
        sourceHeight: 2160,
        displayWidth: 3840,
        displayHeight: 2160,
        devicePixelRatio: 1,
        userScale: 'auto',
      })
    ).toBe(1);
  });

  it('honors an explicit user scale', () => {
    expect(
      resolveAnime4KOutputScale({
        sourceWidth: 1920,
        sourceHeight: 1080,
        displayWidth: 960,
        displayHeight: 540,
        devicePixelRatio: 1,
        userScale: 3,
      })
    ).toBe(3);
  });

  it('falls back to 2x when source size is missing', () => {
    expect(
      resolveAnime4KOutputScale({
        sourceWidth: 0,
        sourceHeight: 0,
        displayWidth: 1920,
        displayHeight: 1080,
        devicePixelRatio: 1,
        userScale: 'auto',
      })
    ).toBe(2);
  });
});

describe('canProcessAnime4KVideoFrame', () => {
  const HAVE_CURRENT_DATA = 2;

  it('rejects frames before the video has current data', () => {
    expect(
      canProcessAnime4KVideoFrame({
        readyState: 1,
        HAVE_CURRENT_DATA,
        paused: false,
      })
    ).toBe(false);
  });

  it('still processes a paused frame so users can compare quality', () => {
    expect(
      canProcessAnime4KVideoFrame({
        readyState: 4,
        HAVE_CURRENT_DATA,
        paused: true,
      })
    ).toBe(true);
  });
});

describe('describeAnime4KHud', () => {
  it('labels the original while comparing', () => {
    expect(describeAnime4KHud(2, 'ModeB', true)).toBe('原片');
  });

  it('shows mode and scale when super-resolution is visible', () => {
    expect(describeAnime4KHud(2, 'ModeB', false)).toBe('超分 ModeB 2x');
  });

  it('shows source resolution so SD rips are obvious', () => {
    expect(
      describeAnime4KHud(3, 'ModeB', false, { width: 640, height: 480 })
    ).toBe('超分 480p · ModeB 3x');
    expect(
      describeAnime4KHud(3, 'ModeB', true, { width: 640, height: 480 })
    ).toBe('原片 480p');
  });

  it('labels FSR so live-action sharpening is obvious', () => {
    expect(
      describeAnime4KHud(3, 'FSR', false, { width: 720, height: 576 })
    ).toBe('超分 576p · FSR 3x');
  });
});

describe('parseSuperResMode', () => {
  it('defaults new users to FSR for live-action sources', () => {
    expect(parseSuperResMode(null)).toBe('FSR');
    expect(parseSuperResMode('')).toBe('FSR');
    expect(parseSuperResMode('unknown')).toBe('FSR');
  });

  it('keeps saved Anime4K modes', () => {
    expect(parseSuperResMode('ModeCA')).toBe('ModeCA');
    expect(parseSuperResMode('ModeB')).toBe('ModeB');
  });

  it('accepts FSR as a first-class mode', () => {
    expect(parseSuperResMode('FSR')).toBe('FSR');
    expect(isFsrMode('FSR')).toBe(true);
    expect(isFsrMode('ModeB')).toBe(false);
  });
});

describe('describeAnime4KEffect', () => {
  it('tells the user FSR is the live-action preset', () => {
    expect(describeAnime4KEffect(3, 'FSR')).toBe(
      '超分已启用 (FSR 真人, 3x，可用「对比原片」对照)'
    );
  });
});
