const AUTO_SCALES = [1, 1.5, 2, 3, 4] as const;
const MANUAL_SCALES = [1, 1.5, 2, 3, 4] as const;
const AUTO_MIN_SCALE = 2;
const AUTO_MAX_OUTPUT_WIDTH = 3840;

export const SUPER_RES_MODES = [
  'FSR',
  'ModeA',
  'ModeB',
  'ModeC',
  'ModeAA',
  'ModeBB',
  'ModeCA',
] as const;

export type SuperResMode = (typeof SUPER_RES_MODES)[number];
export type Anime4KUserScale = (typeof MANUAL_SCALES)[number] | 'auto';

export function parseSuperResMode(value: string | null | undefined): SuperResMode {
  if (value && (SUPER_RES_MODES as readonly string[]).includes(value)) {
    return value as SuperResMode;
  }
  return 'FSR';
}

export function isFsrMode(mode: string | null | undefined): boolean {
  return mode === 'FSR';
}

export interface Anime4KScaleInput {
  sourceWidth: number;
  sourceHeight: number;
  displayWidth: number;
  displayHeight: number;
  devicePixelRatio: number;
  userScale?: Anime4KUserScale;
}

export function parseAnime4KUserScale(value: string | null | undefined): Anime4KUserScale {
  if (value == null || value === '' || value === 'auto') {
    return 'auto';
  }
  const parsed = Number(value);
  return (MANUAL_SCALES as readonly number[]).includes(parsed)
    ? (parsed as (typeof MANUAL_SCALES)[number])
    : 'auto';
}

export function resolveAnime4KOutputScale(input: Anime4KScaleInput): number {
  const userScale = input.userScale ?? 'auto';
  if (userScale !== 'auto') {
    return userScale;
  }

  const sourceWidth = input.sourceWidth;
  const sourceHeight = input.sourceHeight;
  if (!sourceWidth || !sourceHeight) {
    return AUTO_MIN_SCALE;
  }

  const dpr = input.devicePixelRatio > 0 ? input.devicePixelRatio : 1;
  const needed = Math.max(
    (input.displayWidth * dpr) / sourceWidth,
    (input.displayHeight * dpr) / sourceHeight
  );

  let scale: number = AUTO_SCALES[AUTO_SCALES.length - 1];
  for (const candidate of AUTO_SCALES) {
    if (candidate + 1e-6 >= needed) {
      scale = candidate;
      break;
    }
  }

  // 超分要真正放大，否则 1080p 贴屏时只会做几乎看不见的 1x 修复。
  scale = Math.max(scale, AUTO_MIN_SCALE);

  const maxScaleByMemory = AUTO_MAX_OUTPUT_WIDTH / sourceWidth;
  if (Number.isFinite(maxScaleByMemory) && maxScaleByMemory > 0) {
    scale = Math.min(scale, maxScaleByMemory);
  }

  for (let i = AUTO_SCALES.length - 1; i >= 0; i -= 1) {
    if (AUTO_SCALES[i] <= scale + 1e-6) {
      return AUTO_SCALES[i];
    }
  }
  return AUTO_SCALES[0];
}

export function canProcessAnime4KVideoFrame(video: {
  readyState: number;
  HAVE_CURRENT_DATA: number;
  paused?: boolean;
}): boolean {
  return video.readyState >= video.HAVE_CURRENT_DATA;
}

export function describeAnime4KEffect(scale: number, mode: string): string {
  const modeLabel = isFsrMode(mode) ? 'FSR 真人' : mode;
  if (scale <= 1) {
    return `超分已启用 (${modeLabel}, 1x 修复画质，可用「对比原片」对照)`;
  }
  return `超分已启用 (${modeLabel}, ${scale}x，可用「对比原片」对照)`;
}

function formatSourceRes(source?: { width: number; height: number }): string {
  const height = source?.height || 0;
  if (!height) {
    return '';
  }
  if (height <= 500) {
    return `${height}p`;
  }
  if (height <= 600) {
    return '576p';
  }
  if (height <= 800) {
    return '720p';
  }
  if (height <= 1200) {
    return '1080p';
  }
  if (height <= 1600) {
    return '1440p';
  }
  return '2160p';
}

export function describeAnime4KHud(
  scale: number,
  mode: string,
  compareOriginal: boolean,
  source?: { width: number; height: number }
): string {
  const sourceLabel = formatSourceRes(source);
  if (compareOriginal) {
    return sourceLabel ? `原片 ${sourceLabel}` : '原片';
  }
  return sourceLabel
    ? `超分 ${sourceLabel} · ${mode} ${scale}x`
    : `超分 ${mode} ${scale}x`;
}
