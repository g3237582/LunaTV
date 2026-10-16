import {
  compareSearchMatch,
  normalizeSearchMatchText,
  rankBySearchMatch,
  rankSearchGroups,
  searchMatchTier,
} from '@/lib/search-match';

describe('normalizeSearchMatchText', () => {
  it('trims, ignores case, and folds full-width characters', () => {
    expect(normalizeSearchMatchText('  ＡＢＣ１２３  ')).toBe('abc123');
  });

  it('drops whitespace and punctuation', () => {
    expect(normalizeSearchMatchText(' 流 浪·地球 （4K） ')).toBe('流浪地球4k');
    expect(normalizeSearchMatchText('Hello, World!')).toBe('helloworld');
  });
});

describe('searchMatchTier', () => {
  it('ranks exact, prefix, contains, then everything else', () => {
    expect(searchMatchTier(' 流浪地球 ', '流浪地球')).toBe(0);
    expect(searchMatchTier('流浪地球2', '流浪地球')).toBe(1);
    expect(searchMatchTier('前传：流浪地球', '流浪地球')).toBe(2);
    expect(searchMatchTier('星际穿越', '流浪地球')).toBe(3);
  });

  it('treats an empty or punctuation-only query as no match', () => {
    expect(searchMatchTier('流浪地球', '   ')).toBe(3);
    expect(searchMatchTier('流浪地球', '···')).toBe(3);
  });
});

describe('rankBySearchMatch', () => {
  it('keeps the original order inside a tier', () => {
    const items = [
      { id: 'a', title: '其他甲' },
      { id: 'b', title: '流浪地球2' },
      { id: 'c', title: '其他乙' },
      { id: 'd', title: '（流浪地球）' },
      { id: 'e', title: '新流浪地球' },
      { id: 'f', title: '流浪地球前传' },
    ];

    expect(
      rankBySearchMatch(items, '流浪地球', (item) => item.title).map(
        (item) => item.id
      )
    ).toEqual(['d', 'b', 'f', 'e', 'a', 'c']);
    expect(items.map((item) => item.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
    ]);
  });

  it('uses an exact secondary field only as a tiebreaker', () => {
    const items = [
      { name: '晴天', artist: '周杰伦' },
      { name: '周杰伦的床边故事', artist: '别人' },
      { name: '周杰伦', artist: '别人' },
      { name: '七里香', artist: '周杰伦' },
      { name: '周杰伦', artist: '周杰伦' },
      { name: '无关', artist: '别人' },
    ];

    expect(
      rankBySearchMatch(items, '周杰伦', (item) => item.name, {
        getTiebreak: (item) => item.artist,
      }).map((item) => `${item.name}/${item.artist}`)
    ).toEqual([
      '周杰伦/周杰伦',
      '周杰伦/别人',
      '周杰伦的床边故事/别人',
      '晴天/周杰伦',
      '七里香/周杰伦',
      '无关/别人',
    ]);
  });

  it('lets compareBefore outrank the title tiers', () => {
    const items = [
      { title: '流浪地球', year: 2019 },
      { title: '其他', year: 2024 },
    ];

    expect(
      rankBySearchMatch(items, '流浪地球', (item) => item.title, {
        compareBefore: (left, right) => right.year - left.year,
      }).map((item) => item.year)
    ).toEqual([2024, 2019]);
  });

  it('does not reorder when the query normalizes to empty', () => {
    const items = [{ title: '乙' }, { title: '甲' }];
    expect(
      rankBySearchMatch(items, '  · ', (item) => item.title).map(
        (item) => item.title
      )
    ).toEqual(['乙', '甲']);
  });
});

describe('compareSearchMatch', () => {
  it('returns zero for the same tier without a tiebreak difference', () => {
    expect(compareSearchMatch('甲前传', '乙前传', '前传')).toBe(0);
  });
});

describe('rankSearchGroups', () => {
  it('puts the group with an exact title first and moves that item to the front', () => {
    const groups: Array<[string, Array<{ id: string; title: string }>]> = [
      [
        'agg:0',
        [
          { id: 'fuzzy', title: '某剧解说' },
          { id: 'exact', title: '某剧' },
        ],
      ],
      ['agg:1', [{ id: 'prefix', title: '某剧2' }]],
      ['agg:2', [{ id: 'other', title: '另一部' }]],
    ];

    const ranked = rankSearchGroups(groups, '某剧', (item) => item.title);

    expect(ranked.map(([key]) => key)).toEqual(['agg:0', 'agg:1', 'agg:2']);
    expect(ranked[0][1].map((item) => item.id)).toEqual(['exact', 'fuzzy']);
  });

  it('keeps same-tier groups in their existing order', () => {
    const groups: Array<[string, Array<{ id: string; title: string }>]> = [
      ['agg:1', [{ id: 'a', title: '其他甲' }]],
      ['agg:2', [{ id: 'b', title: '其他乙' }]],
      ['agg:0', [{ id: 'c', title: '目标' }]],
    ];

    expect(
      rankSearchGroups(groups, '目标', (item) => item.title).map(([key]) => key)
    ).toEqual(['agg:0', 'agg:1', 'agg:2']);
  });
});
