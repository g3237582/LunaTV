import {
  resolveHlsStartPosition,
  resolvePreferredResumeTime,
} from './hls-start-position';

describe('resolveHlsStartPosition', () => {
  it('starts from the live/default edge when no progress exists yet', () => {
    expect(resolveHlsStartPosition(0)).toBe(-1);
    expect(resolveHlsStartPosition(Number.NaN)).toBe(-1);
    expect(resolveHlsStartPosition(0.4)).toBe(-1);
  });

  it('resumes from the last media time after a mid-play remount', () => {
    expect(resolveHlsStartPosition(233.16)).toBe(233.16);
  });
});

describe('resolvePreferredResumeTime', () => {
  it('prefers the live playhead over stale history after a remount at 0', () => {
    expect(resolvePreferredResumeTime(20, 234.18, 0)).toBe(234.18);
  });

  it('uses history before the first real playhead exists', () => {
    expect(resolvePreferredResumeTime(20, 0, 0)).toBe(20);
  });

  it('does not seek again once playback is already at a real time', () => {
    expect(resolvePreferredResumeTime(20, 234.18, 236)).toBeNull();
  });

  it('seeks back to the live playhead when remount restarted near the beginning', () => {
    expect(resolvePreferredResumeTime(20, 234.18, 2)).toBe(234.18);
    expect(resolvePreferredResumeTime(null, 234.18, 0.4)).toBe(234.18);
  });
});
