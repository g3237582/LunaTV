import { filterAdsFromM3U8 } from './hls-ad-filter.client';

const SPLICE_PLAYLIST = [
  '#EXTM3U',
  '#EXTINF:9.962,',
  'https://cdn.example.com/content-a.ts',
  '#EXT-X-DISCONTINUITY',
  '#EXTINF:1.365,',
  'https://cdn.example.com/ad/midroll-1.ts',
  '#EXT-X-DISCONTINUITY',
  '#EXTINF:4.991,',
  'https://cdn.example.com/content-b.ts',
  '#EXT-X-ENDLIST',
].join('\n');

describe('client filterAdsFromM3U8', () => {
  it('drops ad segments and keeps discontinuity when no custom code is set', () => {
    const filtered = filterAdsFromM3U8('source-a', SPLICE_PLAYLIST);

    expect(filtered).toContain('content-a.ts');
    expect(filtered).toContain('content-b.ts');
    expect(filtered).not.toContain('/ad/midroll-1.ts');
    expect(filtered).toContain('#EXT-X-DISCONTINUITY');
  });
});
