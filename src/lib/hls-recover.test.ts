import {
  decideHlsMediaRecover,
  nextRecoverCount,
  playheadBucket,
  rememberFailedHlsPlayhead,
  rememberHlsPlayhead,
  rememberHlsRecoverState,
  resolveSafeResumeTime,
  resolveTrackedPlayhead,
} from './hls-recover';
import { resolvePreferredResumeTime } from './hls-start-position';

describe('rememberHlsPlayhead', () => {
  it('keeps the previous playhead when current time is emptied to 0', () => {
    expect(rememberHlsPlayhead(234.18, 0)).toBe(234.18);
    expect(rememberHlsPlayhead(234.18, Number.NaN)).toBe(234.18);
  });

  it('keeps the previous playhead when remount reports a near-zero currentTime', () => {
    expect(rememberHlsPlayhead(234.18, 0.3)).toBe(234.18);
    expect(rememberHlsPlayhead(234.18, 0.99)).toBe(234.18);
  });

  it('updates when the video is still at a real media time', () => {
    expect(rememberHlsPlayhead(228, 234.18)).toBe(234.18);
  });

  it('does not let a stalled 3:54 playhead pull back a skip target', () => {
    expect(rememberHlsPlayhead(242.18, 234.18)).toBe(242.18);
  });
});

describe('resolveTrackedPlayhead', () => {
  it('keeps the tracked playhead when a sample moves backward without a user seek', () => {
    expect(
      resolveTrackedPlayhead({
        tracked: 100,
        observed: 40,
        pendingUserSeek: null,
      })
    ).toEqual({ playhead: 100, pendingUserSeek: null });
    expect(
      resolveTrackedPlayhead({
        tracked: 100,
        observed: 0,
        pendingUserSeek: null,
      }).playhead
    ).toBe(100);
  });

  it('follows a progress-bar seek backward, including a small step and the start', () => {
    expect(
      resolveTrackedPlayhead({
        tracked: 100,
        observed: 40,
        pendingUserSeek: 40,
      })
    ).toEqual({ playhead: 40, pendingUserSeek: null });

    expect(
      resolveTrackedPlayhead({
        tracked: 100,
        observed: 100,
        pendingUserSeek: 95,
      })
    ).toEqual({ playhead: 95, pendingUserSeek: 95 });

    expect(
      resolveTrackedPlayhead({
        tracked: 100,
        observed: 0.2,
        pendingUserSeek: 0,
      })
    ).toEqual({ playhead: 0, pendingUserSeek: null });
  });

  it('still ignores a near-zero glitch while a backward seek has not landed', () => {
    const holding = resolveTrackedPlayhead({
      tracked: 100,
      observed: 0.2,
      pendingUserSeek: 40,
    });
    expect(holding).toEqual({ playhead: 40, pendingUserSeek: 40 });

    expect(
      resolveTrackedPlayhead({
        tracked: holding.playhead,
        observed: 40.4,
        pendingUserSeek: holding.pendingUserSeek,
      })
    ).toEqual({ playhead: 40, pendingUserSeek: null });
  });

  it('adopts a backward seeking target from the progress bar before canplay', () => {
    expect(
      resolveTrackedPlayhead({
        tracked: 100,
        observed: 40,
        pendingUserSeek: null,
        adoptBackwardSeek: true,
      })
    ).toEqual({ playhead: 40, pendingUserSeek: null });

    expect(
      resolveTrackedPlayhead({
        tracked: 100,
        observed: 95,
        pendingUserSeek: null,
        adoptBackwardSeek: true,
      })
    ).toEqual({ playhead: 95, pendingUserSeek: null });
  });

  it('does not adopt a backward timeupdate or a near-zero seek', () => {
    expect(
      resolveTrackedPlayhead({
        tracked: 242.18,
        observed: 234.18,
        pendingUserSeek: null,
        adoptBackwardSeek: false,
      }).playhead
    ).toBe(242.18);
    expect(
      resolveTrackedPlayhead({
        tracked: 100,
        observed: 0.3,
        pendingUserSeek: null,
        adoptBackwardSeek: true,
      }).playhead
    ).toBe(100);
  });

  it('still moves forward and protects a skip target when the user is not scrubbing', () => {
    expect(
      resolveTrackedPlayhead({
        tracked: 228,
        observed: 234.18,
        pendingUserSeek: null,
      }).playhead
    ).toBe(234.18);
    expect(
      resolveTrackedPlayhead({
        tracked: 242.18,
        observed: 234.18,
        pendingUserSeek: null,
      }).playhead
    ).toBe(242.18);
  });
});

describe('decideHlsMediaRecover', () => {
  it('skips past a broken splice on the first media error instead of remounting on it', () => {
    expect(
      decideHlsMediaRecover({
        lastPlayhead: 234.18,
        recoverCountAtPlayhead: 1,
        elapsedSinceLastRecoverMs: 5000,
      })
    ).toEqual({ action: 'skip', startPosition: 242.18 });
  });

  it('waits instead of recover-looping in the same second', () => {
    expect(
      decideHlsMediaRecover({
        lastPlayhead: 234.18,
        recoverCountAtPlayhead: 2,
        elapsedSinceLastRecoverMs: 200,
      })
    ).toEqual({ action: 'wait', startPosition: 234.18 });
  });

  it('skips farther after repeated recoveries at the same playhead', () => {
    expect(
      decideHlsMediaRecover({
        lastPlayhead: 234.18,
        recoverCountAtPlayhead: 2,
        elapsedSinceLastRecoverMs: 900,
      })
    ).toEqual({ action: 'skip', startPosition: 242.18 });
  });
});

describe('persisted recover state', () => {
  it('keeps the recover count when a remount reports the same playhead', () => {
    const afterFirst = rememberHlsRecoverState(
      { bucket: 0, count: 0, lastAt: 0 },
      234.18,
      1_000
    );
    const afterRemount = rememberHlsRecoverState(afterFirst, 234.18, 5_000);

    expect(afterFirst.count).toBe(1);
    expect(afterRemount.count).toBe(2);
    expect(
      decideHlsMediaRecover({
        lastPlayhead: 234.18,
        recoverCountAtPlayhead: afterRemount.count,
        elapsedSinceLastRecoverMs: afterRemount.lastAt
          ? 5_000 - afterRemount.lastAt
          : 10_000,
      }).action
    ).toBe('skip');
  });
});

describe('recover count buckets', () => {
  it('counts recoveries in the same splice window, including 3:48 vs 3:54', () => {
    expect(playheadBucket(228)).toBe(playheadBucket(234.18));
    expect(playheadBucket(234.18)).toBe(playheadBucket(235.9));
    expect(
      nextRecoverCount(1, playheadBucket(234.18), playheadBucket(228))
    ).toBe(2);
  });

  it('resets after the playhead leaves the broken splice', () => {
    expect(
      nextRecoverCount(3, playheadBucket(234.18), playheadBucket(260))
    ).toBe(1);
  });
});

describe('resolvePreferredResumeTime', () => {
  it('does not let a stale 20s history clobber a live 3:54 playhead', () => {
    expect(resolvePreferredResumeTime(20, 234.18, 0)).toBe(234.18);
  });

  it('still uses history when there is no live playhead yet', () => {
    expect(resolvePreferredResumeTime(20, 0, 0)).toBe(20);
  });
});

describe('resolveSafeResumeTime', () => {
  it('skips a continue-watching resume that sits on a failed decode splice', () => {
    expect(resolveSafeResumeTime(234.04, 234.18)).toBe(242.18);
    expect(resolveSafeResumeTime(234.18, 234.18)).toBe(242.18);
  });

  it('keeps a resume that is already past the broken splice', () => {
    expect(resolveSafeResumeTime(260, 234.18)).toBe(260);
  });

  it('leaves a normal resume alone when nothing has failed', () => {
    expect(resolveSafeResumeTime(20, 0)).toBe(20);
    expect(resolveSafeResumeTime(null, 234.18)).toBeNull();
  });
});

describe('rememberFailedHlsPlayhead', () => {
  it('keeps the last real decode-fail playhead', () => {
    expect(rememberFailedHlsPlayhead(0, 234.18)).toBe(234.18);
    expect(rememberFailedHlsPlayhead(234.18, 0)).toBe(234.18);
  });
});
