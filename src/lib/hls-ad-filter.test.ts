import { filterAdsFromM3U8Default } from './hls-ad-filter';

const SPLICE_PLAYLIST = [
  '#EXTM3U',
  '#EXT-X-VERSION:3',
  '#EXT-X-TARGETDURATION:10',
  '#EXTINF:9.962,',
  'https://cdn.example.com/content-a.ts',
  '#EXT-X-DISCONTINUITY',
  '#EXTINF:1.365,',
  'https://cdn.example.com/ad/midroll-1.ts',
  '#EXTINF:3.370,',
  'https://cdn.example.com/ads/midroll-2.ts',
  '#EXT-X-DISCONTINUITY',
  '#EXTINF:4.991,',
  'https://cdn.example.com/content-b.ts',
  '#EXT-X-ENDLIST',
  '',
].join('\n');

const ENCODER_RESET_PLAYLIST = [
  '#EXTM3U',
  '#EXTINF:9.962,',
  'https://cdn.example.com/hls/aaaa.ts',
  '#EXT-X-DISCONTINUITY',
  '#EXTINF:1.365,',
  'https://cdn.example.com/hls/bbbb.ts',
  '#EXTINF:3.370,',
  'https://cdn.example.com/hls/cccc.ts',
  '#EXT-X-DISCONTINUITY',
  '#EXTINF:4.991,',
  'https://cdn.example.com/hls/dddd.ts',
  '#EXT-X-ENDLIST',
].join('\n');

describe('filterAdsFromM3U8Default', () => {
  it('returns empty string for empty playlist', () => {
    expect(filterAdsFromM3U8Default('m3u8', '')).toBe('');
  });

  it('drops ad segments but keeps discontinuity so the next content can reset PTS', () => {
    const filtered = filterAdsFromM3U8Default('m3u8', SPLICE_PLAYLIST);

    expect(filtered).toContain('content-a.ts');
    expect(filtered).toContain('content-b.ts');
    expect(filtered).not.toContain('/ad/midroll-1.ts');
    expect(filtered).not.toContain('/ads/midroll-2.ts');
    expect(filtered).toContain('#EXT-X-DISCONTINUITY');
  });

  it('keeps encoder-reset discontinuity even when no ad keyword is present', () => {
    const filtered = filterAdsFromM3U8Default('m3u8', ENCODER_RESET_PLAYLIST);
    const discCount = filtered.split('\n').filter((line) =>
      line.includes('#EXT-X-DISCONTINUITY')
    ).length;

    expect(filtered).toContain('bbbb.ts');
    expect(filtered).toContain('dddd.ts');
    expect(discCount).toBe(2);
  });
});
