import { resolveHlsStartPosition } from './hls-start-position';

export const HLS_RECOVER_MIN_INTERVAL_MS = 800;
export const HLS_RECOVER_SKIP_AFTER = 2;
export const HLS_RECOVER_SKIP_SECONDS = 8;
export const HLS_RECOVER_BUCKET_SECONDS = 16;
export const HLS_UNSAFE_RESUME_RADIUS = 2;

export type HlsRecoverAction = 'wait' | 'recover' | 'skip';

export type HlsRecoverState = {
  bucket: number;
  count: number;
  lastAt: number;
};

export function createHlsRecoverState(): HlsRecoverState {
  return { bucket: 0, count: 0, lastAt: 0 };
}

export function rememberHlsRecoverState(
  state: HlsRecoverState,
  playhead: number,
  _now = Date.now()
): HlsRecoverState {
  const bucket = playheadBucket(playhead);
  return {
    bucket,
    count: nextRecoverCount(state.count, state.bucket, bucket),
    lastAt: state.lastAt,
  };
}

export function markHlsRecovered(
  state: HlsRecoverState,
  now: number
): HlsRecoverState {
  return { ...state, lastAt: now };
}

export function rememberHlsPlayhead(previous: number, current: number): number {
  // remount / recover 后 currentTime 常短暂变成 0.x，不能盖掉真正的播放头
  if (!Number.isFinite(current) || current < 1) {
    return previous;
  }
  // 跳过坏切口后，卡住的 3:54 不能把 4:02 的目标拉回去
  if (
    previous >= 1 &&
    current < previous &&
    previous - current <= HLS_RECOVER_BUCKET_SECONDS
  ) {
    return previous;
  }
  return current;
}

export type TrackedPlayhead = {
  playhead: number;
  pendingUserSeek: number | null;
};

/**
 * 把一次媒体时间采样并进恢复用播放头。
 *
 * 没有用户拖动时播放头只前进：remount 会把 currentTime 打成 0.x，
 * 坏切口跳过之后卡住的旧时间也不能把跳过目标拉回去。
 *
 * 进度条点击/拖动和方向键会留下 pendingUserSeek。这个目标允许小于当前播放头。
 * 若这里继续单调取最大，随后的 canplay 会按最远观看点把时间拉回去，
 * 进度条就只能往前拖。
 */
export function resolveTrackedPlayhead(input: {
  tracked: number;
  observed: number;
  pendingUserSeek: number | null;
  /**
   * 仅用于 video seeking。进度条把 currentTime 设到更早的位置时，这次 seeking
   * 的 currentTime 就是用户目标，必须立刻采纳。timeupdate 不能开这个口子，
   * 否则坏切口上卡住的旧时间会把跳过目标拉回去。
   */
  adoptBackwardSeek?: boolean;
}): TrackedPlayhead {
  const tracked = Number.isFinite(input.tracked) ? input.tracked : 0;
  let pendingUserSeek = input.pendingUserSeek;
  const observed = Number(input.observed);

  if (
    pendingUserSeek == null &&
    input.adoptBackwardSeek &&
    Number.isFinite(observed) &&
    observed >= 1 &&
    observed + 0.25 < tracked
  ) {
    pendingUserSeek = observed;
  }

  const pending = Number(pendingUserSeek);
  if (pendingUserSeek != null && Number.isFinite(pending) && pending >= 0) {
    const landed =
      Number.isFinite(observed) && Math.abs(observed - pending) <= 1.5;
    return {
      playhead: pending,
      pendingUserSeek: landed ? null : pending,
    };
  }

  const next = rememberHlsPlayhead(tracked, input.observed);
  return {
    playhead: Math.max(tracked, next),
    pendingUserSeek: null,
  };
}

export function playheadBucket(time: number): number {
  if (!Number.isFinite(time) || time < 1) {
    return 0;
  }
  return Math.floor(time / HLS_RECOVER_BUCKET_SECONDS);
}

export function nextRecoverCount(
  prevCount: number,
  prevBucket: number,
  nextBucket: number
): number {
  if (nextBucket === 0) {
    return 0;
  }
  if (nextBucket === prevBucket) {
    return prevCount + 1;
  }
  return 1;
}

export function rememberFailedHlsPlayhead(
  previousFailedAt: number,
  currentFailedAt: number
): number {
  if (!Number.isFinite(currentFailedAt) || currentFailedAt < 1) {
    return previousFailedAt;
  }
  return currentFailedAt;
}

export function resolveSafeResumeTime(
  target: number | null | undefined,
  failedAt: number
): number | null {
  if (target == null) {
    return null;
  }

  const resume = Number(target);
  if (!Number.isFinite(resume) || resume <= 0) {
    return null;
  }

  const failed = Number(failedAt);
  if (!Number.isFinite(failed) || failed < 1) {
    return resume;
  }

  // 继续观看落在坏包上会直接 PIPELINE_ERROR_DECODE，整集卡死
  if (
    Math.abs(resume - failed) <= HLS_UNSAFE_RESUME_RADIUS ||
    (resume >= failed - 1 && resume < failed + HLS_RECOVER_SKIP_SECONDS)
  ) {
    return failed + HLS_RECOVER_SKIP_SECONDS;
  }

  return resume;
}

export function hlsBadSpliceStorageKey(
  source: string,
  id: string,
  episodeIndex: number
): string {
  return `lunatv:hls-bad-splice:${source}:${id}:${episodeIndex}`;
}

export function readFailedHlsPlayhead(key: string): number {
  if (typeof window === 'undefined') {
    return 0;
  }
  try {
    const failedAt = Number(window.localStorage.getItem(key));
    return Number.isFinite(failedAt) && failedAt >= 1 ? failedAt : 0;
  } catch {
    return 0;
  }
}

export function writeFailedHlsPlayhead(key: string, failedAt: number): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (!Number.isFinite(failedAt) || failedAt < 1) {
    return;
  }
  try {
    window.localStorage.setItem(key, String(failedAt));
  } catch {
    // ignore quota / private mode
  }
}

export function decideHlsMediaRecover(input: {
  lastPlayhead: number;
  recoverCountAtPlayhead: number;
  elapsedSinceLastRecoverMs: number;
}): { action: HlsRecoverAction; startPosition: number } {
  const startPosition = resolveHlsStartPosition(input.lastPlayhead);

  if (input.elapsedSinceLastRecoverMs < HLS_RECOVER_MIN_INTERVAL_MS) {
    return { action: 'wait', startPosition };
  }

  // 坏包上原地 recover 会直接卡死，有有效进度时第一次就跳过切口
  if (startPosition !== -1) {
    return {
      action: 'skip',
      startPosition: startPosition + HLS_RECOVER_SKIP_SECONDS,
    };
  }

  return { action: 'recover', startPosition };
}
