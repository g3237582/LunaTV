import {
  hasRenderableBookCover,
  isLikelyNavigationEntry,
  isPlaceholderCoverHref,
  resolveCoverHref,
  resolveOpdsAuthor,
} from '@/lib/opds-entry';

const GUTENBERG_PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('resolveCoverHref', () => {
  it('skips Gutenberg list data-URI thumbnails and derives the real cover from the ebook id', () => {
    expect(
      resolveCoverHref([
        {
          href: 'https://www.gutenberg.org/ebooks/1342.opds',
          rel: 'subsection',
          type: 'application/atom+xml;profile=opds-catalog',
        },
        {
          href: GUTENBERG_PLACEHOLDER,
          rel: 'http://opds-spec.org/image/thumbnail',
          type: 'image/png',
        },
      ])
    ).toBe('https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg');
  });

  it('prefers a real HTTP cover over a data-URI thumbnail', () => {
    expect(
      resolveCoverHref([
        {
          href: GUTENBERG_PLACEHOLDER,
          rel: 'http://opds-spec.org/image/thumbnail',
          type: 'image/png',
        },
        {
          href: 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg',
          rel: 'http://opds-spec.org/image',
          type: 'image/jpeg',
        },
      ])
    ).toBe('https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg');
  });

  it('returns undefined when the only cover is a data-URI placeholder', () => {
    expect(
      resolveCoverHref([
        {
          href: GUTENBERG_PLACEHOLDER,
          rel: 'http://opds-spec.org/image/thumbnail',
          type: 'image/png',
        },
      ])
    ).toBeUndefined();
  });
});

describe('resolveOpdsAuthor', () => {
  it('uses a short Gutenberg content field as the author when atom:author is missing', () => {
    expect(
      resolveOpdsAuthor({
        content: 'Jane Austen',
      })
    ).toBe('Jane Austen');
  });

  it('prefers an explicit author over content', () => {
    expect(
      resolveOpdsAuthor({
        author: 'Austen, Jane',
        content: 'Free eBooks since 1971.',
      })
    ).toBe('Austen, Jane');
  });

  it('does not treat a long summary as an author', () => {
    expect(
      resolveOpdsAuthor({
        content:
          'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
      })
    ).toBeUndefined();
  });
});

describe('isLikelyNavigationEntry', () => {
  it('treats Gutenberg popular works as books, not empty categories', () => {
    expect(
      isLikelyNavigationEntry({
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        links: [
          {
            href: 'https://www.gutenberg.org/ebooks/1342.opds',
            rel: 'subsection',
            type: 'application/atom+xml;profile=opds-catalog',
          },
        ],
      })
    ).toBe(false);
  });

  it('keeps real OPDS categories as navigation', () => {
    expect(
      isLikelyNavigationEntry({
        title: 'Fiction',
        links: [
          {
            href: 'https://www.gutenberg.org/ebooks/bookshelf/123.opds',
            rel: 'subsection',
            type: 'application/atom+xml;profile=opds-catalog;kind=navigation',
          },
        ],
      })
    ).toBe(true);
  });
});

describe('isPlaceholderCoverHref', () => {
  it('treats 爱下 nopic placeholders as missing covers', () => {
    expect(isPlaceholderCoverHref('https://img22.ixdzs.com/nopic2.jpg')).toBe(true);
    expect(
      isPlaceholderCoverHref(
        '/api/books/image?sourceId=legado_1&url=https%3A%2F%2Fimg22.ixdzs.com%2Fnopic2.jpg'
      )
    ).toBe(true);
  });

  it('keeps a real cover URL', () => {
    expect(
      isPlaceholderCoverHref('https://img22.ixdzs.com/97/7a/977a212b3b190ed689bbba80c96e8713.jpg')
    ).toBe(false);
    expect(
      hasRenderableBookCover(
        '/api/books/image?sourceId=legado_1&url=https%3A%2F%2Fimg22.ixdzs.com%2F97%2F7a%2F977a212b3b190ed689bbba80c96e8713.jpg'
      )
    ).toBe(true);
  });
});
