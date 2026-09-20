/**
 * HLS recoverMediaError / 重新 attach 时的 startLoad 起点。
 * -1 表示从默认起点加载；已有有效进度时必须接着播，不能再传 -1。
 */
export function resolveHlsStartPosition(lastMediaTime: number): number {
  if (!Number.isFinite(lastMediaTime) || lastMediaTime < 1) {
    return -1;
  }
  return lastMediaTime;
}

/**
 * canplay 恢复进度时：进行中的播放头优先于过期的历史记录。
 * remount 后即使 currentTime 已经到了开头附近（2 秒），也要拉回 3:54，
 * 不能把「已经在播」当成可以放弃恢复。
 */
export function resolvePreferredResumeTime(
  historyTime: number | null | undefined,
  livePlayhead: number,
  currentTime = 0
): number | null {
  const history = Number(historyTime);
  const live = Number(livePlayhead);
  const historyOk = Number.isFinite(history) && history > 0;
  const liveOk = Number.isFinite(live) && live >= 1;

  let target: number | null = null;
  if (liveOk && (!historyOk || live > history + 1)) {
    target = live;
  } else if (historyOk) {
    target = history;
  } else if (liveOk) {
    target = live;
  }

  if (target == null) {
    return null;
  }

  // 已经在目标附近或超过目标，不要再拉进度。
  // remount 后从 0 附近重新起播（例如 2 秒）必须拉回 3:54。
  if (Number.isFinite(currentTime) && currentTime >= 1 && currentTime >= target - 1) {
    return null;
  }

  return target;
}
