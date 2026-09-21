export const PLACEHOLDER_BOOK_TITLE = '未命名电子书';

export function isPlaceholderBookTitle(title?: string | null): boolean {
  if (title == null) return true;
  const trimmed = title.trim();
  return !trimmed || trimmed === PLACEHOLDER_BOOK_TITLE;
}

export function resolveBookTitle(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && !isPlaceholderBookTitle(candidate)) {
      return candidate.trim();
    }
  }
  return PLACEHOLDER_BOOK_TITLE;
}

export function withBookNames(title: string): { title: string; name: string } {
  const resolved = resolveBookTitle(title);
  return { title: resolved, name: resolved };
}
