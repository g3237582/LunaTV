import {
  isPlaceholderBookTitle,
  PLACEHOLDER_BOOK_TITLE,
  resolveBookTitle,
  withBookNames,
} from '@/lib/book-title';

describe('isPlaceholderBookTitle', () => {
  it('treats empty, whitespace, and the literal placeholder as missing titles', () => {
    expect(isPlaceholderBookTitle(undefined)).toBe(true);
    expect(isPlaceholderBookTitle(null)).toBe(true);
    expect(isPlaceholderBookTitle('')).toBe(true);
    expect(isPlaceholderBookTitle('   ')).toBe(true);
    expect(isPlaceholderBookTitle(PLACEHOLDER_BOOK_TITLE)).toBe(true);
    expect(isPlaceholderBookTitle(` ${PLACEHOLDER_BOOK_TITLE} `)).toBe(true);
  });

  it('keeps a real book title', () => {
    expect(isPlaceholderBookTitle('朝花夕拾')).toBe(false);
    expect(isPlaceholderBookTitle('Pride and Prejudice')).toBe(false);
  });
});

describe('resolveBookTitle', () => {
  it('prefers a non-placeholder fallback over a missing rule name', () => {
    expect(resolveBookTitle('', undefined, '朝花夕拾')).toBe('朝花夕拾');
    expect(resolveBookTitle(PLACEHOLDER_BOOK_TITLE, '朝花夕拾')).toBe('朝花夕拾');
  });

  it('reads a Legado name field when title is missing', () => {
    expect(resolveBookTitle(undefined, '朝花夕拾', 'list-card title')).toBe('朝花夕拾');
  });

  it('never returns the literal placeholder when a better title was provided', () => {
    expect(resolveBookTitle(PLACEHOLDER_BOOK_TITLE, '  朝花夕拾  ')).toBe('朝花夕拾');
    expect(resolveBookTitle(undefined, PLACEHOLDER_BOOK_TITLE, 'Gutenberg 条目')).toBe('Gutenberg 条目');
  });

  it('falls back to the placeholder only when every candidate is empty', () => {
    expect(resolveBookTitle(undefined, '', PLACEHOLDER_BOOK_TITLE)).toBe(PLACEHOLDER_BOOK_TITLE);
  });
});

describe('withBookNames', () => {
  it('emits title and name consistently', () => {
    expect(withBookNames('朝花夕拾')).toEqual({ title: '朝花夕拾', name: '朝花夕拾' });
    expect(withBookNames(PLACEHOLDER_BOOK_TITLE)).toEqual({
      title: PLACEHOLDER_BOOK_TITLE,
      name: PLACEHOLDER_BOOK_TITLE,
    });
  });
});
