import { resolveSafeResumeTime } from './hls-recover';
import { resolvePreferredResumeTime } from './hls-start-position';

/**
 * 切集后续播决策。
 *
 * 播放记录按 source+id 存整部剧的「最后一集 + 一个 play_time」，
 * 单集进度在本地另存。HLS 重挂用的 live playhead 是会话级的，
 * 不带集数时会被 canplay 当成当前集的进度，自动下一集就会从上一集结尾接着播。
 * 只有 live playhead / 坏切口标记明确属于目标集时才能参与续播。
 */
export interface EpisodeResumeInput {
  /** 即将播放的集，0 起 */
  targetEpisode: number;
  /** 这一集自己的进度。null 表示从 0 开始 */
  episodeProgress: number | null;
  livePlayhead: number;
  /** live playhead 属于哪一集。null 表示当前没有可信的播放头 */
  livePlayheadEpisode: number | null;
  failedPlayhead?: number;
  failedPlayheadEpisode?: number | null;
  currentTime?: number;
  duration?: number;
}

export type EpisodeResumeAction =
  | { action: 'start' }
  | { action: 'keep' }
  | { action: 'seek'; time: number };

function hasOwnProgress(progress: number | null | undefined) {
  return progress != null && Number.isFinite(progress) && progress > 1;
}

function clampResumeTime(time: number, duration: number | undefined) {
  if (!Number.isFinite(duration) || !duration || duration <= 0) {
    return time;
  }
  if (time >= duration - 2) {
    return Math.max(0, duration - 5);
  }
  return time;
}

export function resolveEpisodeResumeAction(
  input: EpisodeResumeInput
): EpisodeResumeAction {
  const currentTime = Number(input.currentTime) || 0;
  const foreignClock =
    input.livePlayheadEpisode != null &&
    input.livePlayheadEpisode !== input.targetEpisode;
  const sameEpisodeLive =
    input.livePlayheadEpisode != null &&
    input.livePlayheadEpisode === input.targetEpisode
      ? input.livePlayhead
      : 0;
  const sameEpisodeFailed =
    input.failedPlayheadEpisode != null &&
    input.failedPlayheadEpisode === input.targetEpisode
      ? Number(input.failedPlayhead) || 0
      : 0;
  const ownProgress = hasOwnProgress(input.episodeProgress);

  // 上一集的 currentTime 不能参与「已经播到这里」判断，否则新集停在片尾也会被当成已续播。
  const preferred = resolvePreferredResumeTime(
    ownProgress ? input.episodeProgress : null,
    sameEpisodeLive,
    foreignClock ? 0 : currentTime
  );
  const safe = resolveSafeResumeTime(preferred, sameEpisodeFailed);

  if (safe != null && safe > 0) {
    const time = clampResumeTime(safe, input.duration);
    if (time <= 0) {
      return currentTime > 1
        ? { action: 'seek', time: 0 }
        : { action: 'start' };
    }
    if (!foreignClock && currentTime >= 1 && currentTime >= time - 1) {
      return { action: 'keep' };
    }
    return { action: 'seek', time };
  }

  // 有本集进度或本集播放头，但当前时间已经不早于目标：不要再拉一次。
  if (ownProgress || sameEpisodeLive >= 1) {
    return { action: 'keep' };
  }

  // 新的一集。媒体时钟如果还停在上一集结尾，必须拉回 0。
  if (currentTime > 1) {
    return { action: 'seek', time: 0 };
  }
  return { action: 'start' };
}

export function resolveSkipBoundaries(input: {
  currentTime: number;
  duration: number;
  introTime: number;
  outroTime: number;
}) {
  const currentTime = Number(input.currentTime) || 0;
  const duration = Number(input.duration) || 0;
  const introTime = Number(input.introTime) || 0;
  const outroTime = Number(input.outroTime) || 0;

  return {
    skipIntroTo: introTime > 0 && currentTime < introTime ? introTime : null,
    reachedOutro:
      outroTime < 0 && duration > 0 && currentTime > duration + outroTime,
  };
}

export function isPlaybackOnSelectedEpisode(
  playbackEpisode: number | null,
  selectedEpisode: number
) {
  return playbackEpisode === selectedEpisode;
}
