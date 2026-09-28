/**
 * @jest-environment <rootDir>/src/test/next-server-environment.js
 *
 * lxserver 的歌曲搜索不理会 limit，type=song 固定每页 20 首。
 * 请求 limit=24 时仍应认为满页，否则搜索页不会出现下一页。
 */
import { NextRequest } from 'next/server';

import { lxGetJson } from '@/lib/music-v2';

import { GET } from '@/app/api/music/v2/search/route';

jest.mock('@/lib/music-v2', () => ({
  isMusicSource: (source: string | null | undefined) =>
    !!source && ['wy', 'tx', 'kw', 'kg', 'mg'].includes(source),
  lxGetJson: jest.fn(),
  normalizeLxSong: (song: {
    id: string;
    name: string;
    singer: string;
    source: string;
  }) => ({
    songId: song.id,
    source: song.source,
    name: song.name,
    artist: song.singer,
  }),
}));

const mockedLxGetJson = lxGetJson as jest.MockedFunction<typeof lxGetJson>;

function songs(count: number, source: string) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${source}-${index + 1}`,
    name: `歌曲${index + 1}`,
    singer: '歌手',
    source,
  }));
}

function searchRequest(params: Record<string, string>) {
  const query = new URLSearchParams({ q: '周杰伦', page: '1', ...params });
  return new NextRequest(
    `http://localhost/api/music/v2/search?${query.toString()}`
  );
}

describe('GET /api/music/v2/search', () => {
  beforeEach(() => {
    mockedLxGetJson.mockReset();
  });

  it('treats a fixed 20-song page as having more when the client asked for 24', async () => {
    mockedLxGetJson.mockResolvedValue(songs(20, 'kw'));

    const response = await GET(
      searchRequest({ source: 'kw', type: 'song', page: '1', limit: '24' })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.list).toHaveLength(20);
    expect(body.data.hasMore).toBe(true);
    expect(body.data.total).toBeNull();
    expect(mockedLxGetJson).toHaveBeenCalledTimes(1);
    expect(mockedLxGetJson).toHaveBeenCalledWith(
      expect.stringContaining('/api/music/search?'),
      'none'
    );
    const upstream = String(mockedLxGetJson.mock.calls[0][0]);
    expect(upstream).toContain('source=kw');
    expect(upstream).toContain('type=song');
    expect(upstream).toContain('page=1');
    expect(upstream).toContain('limit=24');
  });

  it.each(['kg', 'tx', 'wy'])(
    'keeps the next page for %s song search on the same single upstream page',
    async (source) => {
      mockedLxGetJson.mockResolvedValue(songs(20, source));

      const response = await GET(
        searchRequest({ source, type: 'song', page: '2', limit: '24' })
      );
      const body = await response.json();

      expect(body.data.hasMore).toBe(true);
      expect(mockedLxGetJson).toHaveBeenCalledTimes(1);
      const upstream = String(mockedLxGetJson.mock.calls[0][0]);
      expect(upstream).toContain(`source=${source}`);
      expect(upstream).toContain('page=2');
      expect(upstream).toContain('limit=24');
    }
  );

  it('does not invent a next page when the song page is shorter than 20', async () => {
    mockedLxGetJson.mockResolvedValue(songs(19, 'kw'));

    const response = await GET(
      searchRequest({ source: 'kw', type: 'song', page: '3', limit: '24' })
    );
    const body = await response.json();

    expect(body.data.hasMore).toBe(false);
    expect(mockedLxGetJson).toHaveBeenCalledTimes(1);
  });

  it('keeps migu song pagination when the backend fills the requested limit', async () => {
    mockedLxGetJson.mockResolvedValue(songs(24, 'mg'));

    const response = await GET(
      searchRequest({ source: 'mg', type: 'song', page: '1', limit: '24' })
    );
    const body = await response.json();

    expect(body.data.list).toHaveLength(24);
    expect(body.data.hasMore).toBe(true);
  });

  it('passes a catalog total through when lxserver returns the SDK object', async () => {
    mockedLxGetJson.mockResolvedValue({
      list: songs(20, 'wy'),
      total: 312,
      allPage: 16,
      limit: 20,
      source: 'wy',
    } as never);

    const response = await GET(
      searchRequest({ source: 'wy', type: 'song', page: '2', limit: '20' })
    );
    const body = await response.json();

    expect(body.data.list).toHaveLength(20);
    expect(body.data.list[0].name).toBe('歌曲1');
    expect(body.data.hasMore).toBe(true);
    expect(body.data.total).toBe(312);
    expect(mockedLxGetJson).toHaveBeenCalledTimes(1);
  });

  it('does not treat a QQ estimate as an exact catalog total', async () => {
    mockedLxGetJson.mockResolvedValue({
      list: songs(20, 'tx'),
      total: 312,
      allPage: 16,
      source: 'tx',
    } as never);

    const response = await GET(
      searchRequest({ source: 'tx', type: 'song', page: '1', limit: '20' })
    );
    const body = await response.json();

    expect(body.data.list).toHaveLength(20);
    expect(body.data.hasMore).toBe(true);
    expect(body.data.total).toBeNull();
  });

  it('keeps singer and album pagination tied to the requested limit', async () => {
    mockedLxGetJson.mockResolvedValue(
      Array.from({ length: 24 }, (_, index) => ({ id: index }))
    );
    const singer = await GET(
      searchRequest({ source: 'wy', type: 'singer', limit: '24' })
    );
    expect((await singer.json()).data.hasMore).toBe(true);

    mockedLxGetJson.mockResolvedValue(
      Array.from({ length: 20 }, (_, index) => ({ id: index }))
    );
    const shortSinger = await GET(
      searchRequest({ source: 'wy', type: 'singer', limit: '24' })
    );
    expect((await shortSinger.json()).data.hasMore).toBe(false);

    mockedLxGetJson.mockResolvedValue(
      Array.from({ length: 24 }, (_, index) => ({ id: index }))
    );
    const album = await GET(
      searchRequest({ source: 'tx', type: 'album', limit: '24' })
    );
    expect((await album.json()).data.hasMore).toBe(true);

    mockedLxGetJson.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => ({ id: index }))
    );
    const shortAlbum = await GET(
      searchRequest({ source: 'tx', type: 'album', limit: '24' })
    );
    expect((await shortAlbum.json()).data.hasMore).toBe(false);
  });
});
