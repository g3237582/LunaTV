import { isLikelyNavigationEntry } from '@/lib/opds-entry';

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
