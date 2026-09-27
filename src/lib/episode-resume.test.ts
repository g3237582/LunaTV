import {
  isPlaybackOnSelectedEpisode,
  resolveEpisodeResumeAction,
  resolveSkipBoundaries,
} from './episode-resume';

describe('resolveEpisodeResumeAction', () => {
  it('rewinds auto-next when the media clock is still at the previous episode end', () => {
    expect(
      resolveEpisodeResumeAction({
        targetEpisode: 1,
        episodeProgress: null,
        livePlayhead: 2410,
        livePlayheadEpisode: 0,
        currentTime: 2410,
        duration: 2400,
      })
    ).toEqual({ action: 'seek', time: 0 });
  });

  it('starts a new episode at 0 when playback has already been reset', () => {
    expect(
      resolveEpisodeResumeAction({
        targetEpisode: 1,
        episodeProgress: null,
        livePlayhead: 2410,
        livePlayheadEpisode: 0,
        currentTime: 0,
        duration: 2400,
      })
    ).toEqual({ action: 'start' });
  });

  it('seeks a newly selected episode to its own saved progress', () => {
    expect(
      resolveEpisodeResumeAction({
        targetEpisode: 1,
        episodeProgress: 125,
        livePlayhead: 2410,
        livePlayheadEpisode: 0,
        currentTime: 2410,
        duration: 2400,
      })
    ).toEqual({ action: 'seek', time: 125 });
  });

  it('keeps a same-episode remount on the live playhead', () => {
    expect(
      resolveEpisodeResumeAction({
        targetEpisode: 0,
        episodeProgress: 20,
        livePlayhead: 234.18,
        livePlayheadEpisode: 0,
        currentTime: 0.4,
        duration: 2400,
      })
    ).toEqual({ action: 'seek', time: 234.18 });
  });

  it('does not seek again when playback is already at the same-episode playhead', () => {
    expect(
      resolveEpisodeResumeAction({
        targetEpisode: 0,
        episodeProgress: 20,
        livePlayhead: 234.18,
        livePlayheadEpisode: 0,
        currentTime: 236,
        duration: 2400,
      })
    ).toEqual({ action: 'keep' });
  });

  it('continues the last watched episode from the show record time', () => {
    expect(
      resolveEpisodeResumeAction({
        targetEpisode: 4,
        episodeProgress: 860,
        livePlayhead: 0,
        livePlayheadEpisode: null,
        currentTime: 0,
        duration: 2400,
      })
    ).toEqual({ action: 'seek', time: 860 });
  });

  it('does not let another episode bad-splice marker skip this episode', () => {
    expect(
      resolveEpisodeResumeAction({
        targetEpisode: 2,
        episodeProgress: 100,
        livePlayhead: 0,
        livePlayheadEpisode: null,
        failedPlayhead: 100,
        failedPlayheadEpisode: 1,
        currentTime: 0,
        duration: 2400,
      })
    ).toEqual({ action: 'seek', time: 100 });
  });

  it('still skips a bad splice that belongs to this episode', () => {
    expect(
      resolveEpisodeResumeAction({
        targetEpisode: 2,
        episodeProgress: 100,
        livePlayhead: 0,
        livePlayheadEpisode: null,
        failedPlayhead: 100,
        failedPlayheadEpisode: 2,
        currentTime: 0,
        duration: 2400,
      })
    ).toEqual({ action: 'seek', time: 108 });
  });

  it('does not resume into the last two seconds of the same episode', () => {
    expect(
      resolveEpisodeResumeAction({
        targetEpisode: 0,
        episodeProgress: 2398,
        livePlayhead: 0,
        livePlayheadEpisode: null,
        currentTime: 0,
        duration: 2400,
      })
    ).toEqual({ action: 'seek', time: 2395 });
  });
});

describe('resolveSkipBoundaries', () => {
  it('skips this episode intro from the beginning instead of a foreign playhead', () => {
    expect(
      resolveSkipBoundaries({
        currentTime: 0,
        duration: 2400,
        introTime: 90,
        outroTime: -120,
      })
    ).toEqual({ skipIntroTo: 90, reachedOutro: false });
  });

  it('does not rewind once playback is already past the intro', () => {
    expect(
      resolveSkipBoundaries({
        currentTime: 125,
        duration: 2400,
        introTime: 90,
        outroTime: -120,
      })
    ).toEqual({ skipIntroTo: null, reachedOutro: false });
  });

  it('reaches outro from this episode duration, not the previous episode clock', () => {
    expect(
      resolveSkipBoundaries({
        currentTime: 2300,
        duration: 2400,
        introTime: 90,
        outroTime: -120,
      })
    ).toEqual({ skipIntroTo: null, reachedOutro: true });
  });
});

describe('isPlaybackOnSelectedEpisode', () => {
  it('blocks saving until the player has caught up to the selected episode', () => {
    expect(isPlaybackOnSelectedEpisode(0, 1)).toBe(false);
    expect(isPlaybackOnSelectedEpisode(null, 1)).toBe(false);
    expect(isPlaybackOnSelectedEpisode(1, 1)).toBe(true);
  });
});
