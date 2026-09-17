import { groupSearchResults } from '@/lib/search-result-aggregator';
import { SearchResult } from '@/lib/types';

function result(partial: {
  id: string;
  title: string;
  year?: string;
  episodes?: number;
  source?: string;
  poster?: string;
  douban_id?: number;
}): SearchResult {
  const episodeCount = partial.episodes ?? 1;
  return {
    id: partial.id,
    title: partial.title,
    poster: partial.poster ?? '',
    episodes: Array.from({ length: episodeCount }, () => 'e'),
    episodes_titles: [],
    source: partial.source ?? 'a',
    source_name: partial.source ?? 'a',
    year: partial.year ?? '2024',
    douban_id: partial.douban_id,
  };
}

describe('groupSearchResults', () => {
  it('merges titles that only differ by space, brackets, or quality tags', () => {
    const grouped = groupSearchResults([
      result({ id: '1', title: '流浪地球', source: '源A' }),
      result({ id: '2', title: ' 流浪地球 ', source: '源B' }),
      result({ id: '3', title: '【4K】流浪地球', source: '源C' }),
      result({ id: '4', title: '流浪地球(2024)', source: '源D' }),
      result({ id: '5', title: '另一部', source: '源A' }),
    ]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0][1].map((item) => item.id)).toEqual(['1', '2', '3', '4']);
  });

  it('merges the same work when one source omits the year', () => {
    const grouped = groupSearchResults([
      result({ id: '1', title: '同一部', year: '2024', source: '源A' }),
      result({ id: '2', title: '同一部', year: '', source: '源B' }),
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0][1]).toHaveLength(2);
  });

  it('does not merge the same title from different years', () => {
    const grouped = groupSearchResults([
      result({ id: '1', title: '同一部', year: '2019', source: '源A' }),
      result({ id: '2', title: '同一部', year: '2023', source: '源B' }),
    ]);
    expect(grouped).toHaveLength(2);
  });

  it('merges season titles even when sources disagree on year', () => {
    const grouped = groupSearchResults([
      result({ id: '1', title: '良医 第四季', year: '2017', source: '源A' }),
      result({ id: '2', title: '良医第四季', year: '2025', source: '源B' }),
      result({ id: '3', title: '良医第4季', year: '2020', source: '源C' }),
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0][1]).toHaveLength(3);
  });

  it('does not merge a series with a specific season', () => {
    const grouped = groupSearchResults([
      result({ id: '1', title: '良医', year: '2017', source: '源A' }),
      result({ id: '2', title: '良医第四季', year: '2017', source: '源B' }),
    ]);
    expect(grouped).toHaveLength(2);
  });

  it('merges a trailing season number with the spelled-out season', () => {
    const grouped = groupSearchResults([
      result({ id: '1', title: '某剧4', source: '源A' }),
      result({ id: '2', title: '某剧第四季', source: '源B' }),
      result({ id: '3', title: '某剧 第4季', source: '源C' }),
    ]);
    expect(grouped).toHaveLength(1);
  });

  it('keeps a numbered season out of the unqualified series even with the same poster hash', () => {
    const poster = 'https://cdn.example.com/upload/vod/p2884280704.jpg';
    const grouped = groupSearchResults(
      [
        result({ id: '1', title: '某剧', poster, source: '源A' }),
        result({ id: '2', title: '某剧4', poster, source: '源B' }),
      ],
      { [poster]: '0123456789abcdef' }
    );
    expect(grouped).toHaveLength(2);
  });

  it('does not merge different seasons that only share a poster file', () => {
    const poster =
      'https://cdn.example.com/upload/vod/p2884280704.jpg?imageView=1';
    const grouped = groupSearchResults([
      result({ id: '1', title: '某剧第一季', poster }),
      result({ id: '2', title: '某剧第四季', poster }),
    ]);
    expect(grouped).toHaveLength(2);
  });

  it('does not merge different seasons that only share a poster hash', () => {
    const grouped = groupSearchResults(
      [
        result({
          id: '1',
          title: '某剧第一季',
          poster: 'https://a.example.com/a.jpg',
        }),
        result({
          id: '2',
          title: '某剧第四季',
          poster: 'https://b.example.com/b.jpg',
        }),
      ],
      {
        'https://a.example.com/a.jpg': '0123456789abcdef',
        'https://b.example.com/b.jpg': '0123456789abcdef',
      }
    );
    expect(grouped).toHaveLength(2);
  });

  it('merges commentary retitles that share a poster path', () => {
    const grouped = groupSearchResults([
      result({
        id: '1',
        title: '奇迹[电影解说]',
        year: '2004',
        source: '源A',
        poster: 'https://a.example.com/upload/vod/5f3a9c2e1b88aa/1.jpg',
      }),
      result({
        id: '2',
        title: '天赐良医【影视解说】',
        year: '2004',
        source: '源B',
        poster: 'https://b.example.com/upload/vod/5f3a9c2e1b88aa/1.jpg?w=300',
      }),
    ]);
    expect(grouped).toHaveLength(1);
  });

  it('merges movie and series cuts of the same title', () => {
    const grouped = groupSearchResults([
      result({ id: '1', title: '同一部', episodes: 1, source: '源A' }),
      result({ id: '2', title: '同一部', episodes: 24, source: '源B' }),
    ]);
    expect(grouped).toHaveLength(1);
  });

  it('merges different titles that share a distinctive poster', () => {
    const poster =
      'https://cdn.example.com/upload/vod/p2884280704.jpg?imageView=1';
    const grouped = groupSearchResults([
      result({
        id: '1',
        title: 'The Wandering Earth',
        source: '源A',
        poster,
      }),
      result({
        id: '2',
        title: '流浪地球',
        source: '源B',
        poster: 'https://img.other.com/static/p2884280704.jpg',
      }),
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0][1]).toHaveLength(2);
  });

  it('does not merge different titles that only share a generic poster name', () => {
    const grouped = groupSearchResults([
      result({
        id: '1',
        title: '影片甲',
        source: '源A',
        poster: 'https://a.example.com/images/cover.jpg',
      }),
      result({
        id: '2',
        title: '影片乙',
        source: '源B',
        poster: 'https://b.example.com/images/cover.jpg',
      }),
    ]);
    expect(grouped).toHaveLength(2);
  });

  it('does not merge empty posters', () => {
    const grouped = groupSearchResults([
      result({ id: '1', title: '影片甲', source: '源A', poster: '' }),
      result({ id: '2', title: '影片乙', source: '源B', poster: '' }),
    ]);
    expect(grouped).toHaveLength(2);
  });

  it('merges by douban id even when titles differ', () => {
    const grouped = groupSearchResults([
      result({ id: '1', title: '英文名', source: '源A', douban_id: 12345 }),
      result({ id: '2', title: '中文名', source: '源B', douban_id: 12345 }),
    ]);
    expect(grouped).toHaveLength(1);
  });

  it('merges different titles that share a poster dHash', () => {
    const grouped = groupSearchResults(
      [
        result({
          id: '1',
          title: '奇迹[电影解说]',
          poster: 'https://a.example.com/a.jpg',
        }),
        result({
          id: '2',
          title: '天赐良医【影视解说】',
          poster: 'https://b.example.com/b.jpg',
        }),
      ],
      {
        'https://a.example.com/a.jpg': '0123456789abcdef',
        'https://b.example.com/b.jpg': '0123456789abcdef',
      }
    );
    expect(grouped).toHaveLength(1);
  });

  it('merges posters whose dHash only differs by a few bits', () => {
    const grouped = groupSearchResults(
      [
        result({
          id: '1',
          title: '影片甲',
          poster: 'https://a.example.com/a.jpg',
        }),
        result({
          id: '2',
          title: '影片乙',
          poster: 'https://b.example.com/b.jpg',
        }),
      ],
      {
        'https://a.example.com/a.jpg': '0000000000000000',
        'https://b.example.com/b.jpg': '0000000000000001',
      }
    );
    expect(grouped).toHaveLength(1);
  });

  it('keeps a stable key when later hits join an existing group', () => {
    const first = groupSearchResults([
      result({ id: '1', title: '同一部', source: '源A' }),
    ]);
    const second = groupSearchResults([
      result({ id: '1', title: '同一部', source: '源A' }),
      result({ id: '2', title: '【4K】同一部', source: '源B' }),
    ]);
    expect(first[0][0]).toBe(second[0][0]);
    expect(second[0][1]).toHaveLength(2);
  });
});
