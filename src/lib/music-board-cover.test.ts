import {
  fillMissingBoardCovers,
  mapLxBoards,
  mergeBoardCovers,
  missingBoardCoverIds,
  pickBoardCoverUrl,
  pickFirstSongCover,
  preserveBoardCovers,
} from './music-board-cover';

describe('pickBoardCoverUrl', () => {
  it('reads a board pic when the leaderboard payload already has one', () => {
    expect(pickBoardCoverUrl({ img: ' https://y.gtimg.cn/a.jpg ' })).toBe(
      'https://y.gtimg.cn/a.jpg'
    );
    expect(
      pickBoardCoverUrl({ coverImgUrl: 'https://p1.music.126.net/b.jpg' })
    ).toBe('https://p1.music.126.net/b.jpg');
    expect(pickBoardCoverUrl({ pic: 'https://img1.kwcdn.kuwo.cn/c.jpg' })).toBe(
      'https://img1.kwcdn.kuwo.cn/c.jpg'
    );
  });

  it('returns empty when the board has no picture field', () => {
    expect(pickBoardCoverUrl({ id: '93', name: '飙升榜', bangid: '93' })).toBe(
      ''
    );
    expect(pickBoardCoverUrl({ img: '  ' })).toBe('');
    expect(pickBoardCoverUrl(null)).toBe('');
  });
});

describe('pickFirstSongCover', () => {
  it('uses the first song that actually has album art', () => {
    expect(
      pickFirstSongCover([
        { name: '无图' },
        { img: 'https://imge.kugou.com/a.jpg' },
        { cover: 'https://p1.music.126.net/later.jpg' },
      ])
    ).toBe('https://imge.kugou.com/a.jpg');
  });
});

describe('mapLxBoards', () => {
  it('keeps bangid as the id and only attaches a cover when one exists', () => {
    expect(
      mapLxBoards(
        [
          { id: 'kw__93', bangid: '93', name: '飙升榜' },
          {
            id: 'wy__1',
            bangid: '1',
            name: '云音乐热歌榜',
            img: 'https://p1.music.126.net/hot.jpg',
          },
        ],
        'kw'
      )
    ).toEqual([
      { id: '93', name: '飙升榜', source: 'kw' },
      {
        id: '1',
        name: '云音乐热歌榜',
        cover: 'https://p1.music.126.net/hot.jpg',
        source: 'kw',
      },
    ]);
  });
});

describe('fillMissingBoardCovers', () => {
  it('does not fetch songs for boards that already have a cover', async () => {
    const loadCover = jest.fn(async () => 'https://example.com/should-not.jpg');
    const boards = [
      { id: '93', name: '飙升榜', cover: 'https://y.gtimg.cn/a.jpg' },
    ];

    await expect(fillMissingBoardCovers(boards, loadCover)).resolves.toEqual(
      boards
    );
    expect(loadCover).not.toHaveBeenCalled();
  });

  it('fills a missing cover from the chart song list and leaves failures blank', async () => {
    const loadCover = jest.fn(async (id: string) => {
      if (id === '16') throw new Error('upstream down');
      return id === '93' ? 'https://img1.kwcdn.kuwo.cn/rise.jpg' : '';
    });

    const filled = await fillMissingBoardCovers(
      [
        { id: '93', name: '飙升榜' },
        { id: '16', name: '热歌榜' },
        { id: '158', name: '抖音热歌榜', cover: '' },
      ],
      loadCover,
      { concurrency: 2 }
    );

    expect(filled).toEqual([
      {
        id: '93',
        name: '飙升榜',
        cover: 'https://img1.kwcdn.kuwo.cn/rise.jpg',
      },
      { id: '16', name: '热歌榜' },
      { id: '158', name: '抖音热歌榜', cover: '' },
    ]);
    expect(loadCover.mock.calls.map((call) => call[0]).sort()).toEqual([
      '158',
      '16',
      '93',
    ]);
  });
});

describe('missingBoardCoverIds', () => {
  it('skips boards that already have a picture', () => {
    expect(
      missingBoardCoverIds([
        { id: '93', cover: 'https://y.gtimg.cn/a.jpg' },
        { id: '16' },
        { id: '158', pic: 'https://p1.music.126.net/b.jpg' },
        { id: '', cover: '' },
      ])
    ).toEqual(['16']);
  });
});

describe('mergeBoardCovers', () => {
  it('writes resolved covers without replacing one the board already has', () => {
    const boards = [
      { id: '93', name: '飙升榜' },
      { id: '16', name: '热歌榜', cover: 'https://y.gtimg.cn/keep.jpg' },
    ];
    const merged = mergeBoardCovers(boards, {
      '93': ' https://img1.kwcdn.kuwo.cn/rise.jpg ',
      '16': 'https://example.com/replace.jpg',
    });

    expect(merged.changed).toBe(true);
    expect(merged.boards[0].cover).toBe('https://img1.kwcdn.kuwo.cn/rise.jpg');
    expect(merged.boards[1].cover).toBe('https://y.gtimg.cn/keep.jpg');
  });
});

describe('preserveBoardCovers', () => {
  it('keeps a resolved cover when a later board list arrives without pictures', () => {
    const next = preserveBoardCovers(
      [
        {
          id: '93',
          source: 'kw',
          cover: 'https://img1.kwcdn.kuwo.cn/rise.jpg',
        },
      ],
      [{ id: '93', source: 'kw', name: '飙升榜' }],
      'kw'
    );
    expect(next[0].cover).toBe('https://img1.kwcdn.kuwo.cn/rise.jpg');
  });

  it('does not reuse a cover from a different source that shares the bangid', () => {
    const next = preserveBoardCovers(
      [{ id: '93', source: 'wy', cover: 'https://p1.music.126.net/wy.jpg' }],
      [{ id: '93', source: 'kw', name: '飙升榜' }],
      'kw'
    );
    expect(next[0].cover).toBeUndefined();
  });
});
