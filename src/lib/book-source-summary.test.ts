import {
  BOOK_SOURCE_PAGE_SIZE,
  filterBookSources,
  pageBookSources,
  summarizeBookSource,
} from '@/lib/book-source-summary';
import type { BookSource } from '@/lib/book.types';

function source(partial: Partial<BookSource> & Pick<BookSource, 'id' | 'name' | 'url'>): BookSource {
  return {
    type: 'legado',
    enabled: true,
    ...partial,
  };
}

describe('summarizeBookSource', () => {
  it('drops legado rules and secrets from listing payloads', () => {
    const summary = summarizeBookSource(
      source({
        id: 'legado_1',
        name: '笔仙阁',
        url: 'https://m.bixiange.me',
        password: 'secret',
        headerValue: 'token',
        legado: {
          bookSourceName: '笔仙阁',
          bookSourceUrl: 'https://m.bixiange.me',
          bookSourceGroup: '小说',
          searchUrl: 'https://m.bixiange.me/search.php?q={{key}}',
          ruleSearch: { bookList: '.item', name: 'h3' },
        },
      })
    );

    expect(summary).toEqual({
      id: 'legado_1',
      name: '笔仙阁',
      type: 'legado',
      url: 'https://m.bixiange.me',
      enabled: true,
      group: '小说',
      capabilities: undefined,
    });
    expect(summary).not.toHaveProperty('legado');
    expect(summary).not.toHaveProperty('password');
    expect(summary).not.toHaveProperty('headerValue');
  });
});

describe('filterBookSources', () => {
  const sources = [
    source({ id: 'a', name: '笔仙阁', url: 'https://a.example', legado: { bookSourceGroup: '小说' } }),
    source({ id: 'b', name: 'Gutenberg', type: 'opds', url: 'https://gutenberg.org' }),
  ];

  it('matches name or group', () => {
    expect(filterBookSources(sources, '仙').map((item) => item.id)).toEqual(['a']);
    expect(filterBookSources(sources, '小说').map((item) => item.id)).toEqual(['a']);
  });
});

describe('pageBookSources', () => {
  it('keeps listing pages small', () => {
    const sources = Array.from({ length: 50 }, (_, index) =>
      source({ id: `s${index}`, name: `源${index}`, url: `https://n${index}.example` })
    );
    expect(BOOK_SOURCE_PAGE_SIZE).toBe(24);
    expect(pageBookSources(sources, 1)).toHaveLength(24);
    expect(pageBookSources(sources, 3).map((item) => item.id)).toEqual(['s48', 's49']);
  });
});
