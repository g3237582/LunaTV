export interface OpdsEntryLike {
  title?: string;
  author?: string;
  links: Array<{ href: string; rel?: string; type?: string }>;
}

const GUTENBERG_EBOOK_ID_RE = /\/ebooks\/(\d+)(?:\.opds)?(?:[?#]|$)/i;

const PLACEHOLDER_COVER_RE =
  /(?:^|[/?=&])(?:nopic\d*|no[-_]?cover|nocover|cover[-_]?placeholder|default[-_]?cover)(?:\.[a-z0-9]+)?(?:$|[/?#&])/i;

function decodeCoverHref(href: string): string {
  let current = href.trim();
  for (let i = 0; i < 2; i += 1) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }
  return current;
}

export function isPlaceholderCoverHref(href?: string): boolean {
  if (!href) return true;
  const trimmed = href.trim();
  if (/^data:/i.test(trimmed)) return true;
  return PLACEHOLDER_COVER_RE.test(decodeCoverHref(trimmed));
}

export function hasRenderableBookCover(src?: string): boolean {
  return !!src && !isPlaceholderCoverHref(src);
}

function isCoverRel(rel?: string): boolean {
  if (!rel) return false;
  const normalized = rel.toLowerCase();
  return (
    normalized.includes('opds-spec.org/cover') ||
    normalized.includes('opds-spec.org/image') ||
    normalized.includes('image/thumbnail') ||
    normalized === 'thumbnail' ||
    normalized === 'cover'
  );
}

function isImageType(type?: string): boolean {
  return !!type && type.toLowerCase().startsWith('image/');
}

export function resolveCoverHref(
  links: Array<{ href: string; rel?: string; type?: string }>
): string | undefined {
  const usable = links.filter((link) => link.href && !isPlaceholderCoverHref(link.href));
  const thumbnail = usable.find((link) => {
    const rel = (link.rel || '').toLowerCase();
    return rel.includes('thumbnail') && (isCoverRel(link.rel) || isImageType(link.type));
  });
  const cover =
    thumbnail ||
    usable.find((link) => isCoverRel(link.rel)) ||
    usable.find((link) => isImageType(link.type) && !isAcquisitionRel(link.rel));
  if (cover?.href) return cover.href;

  for (const link of links) {
    const match = (link.href || '').match(GUTENBERG_EBOOK_ID_RE);
    if (match) {
      const id = match[1];
      return `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
    }
  }
  return undefined;
}

export function toBookCoverSrc(
  sourceId: string,
  href?: string,
  via: 'file' | 'image' = 'file'
): string | undefined {
  if (!href || isPlaceholderCoverHref(href)) return undefined;
  if (href.startsWith('/')) return href;
  if (via === 'image') {
    return `/api/books/image?sourceId=${encodeURIComponent(sourceId)}&url=${encodeURIComponent(href)}`;
  }
  return `/api/books/file?sourceId=${encodeURIComponent(sourceId)}&href=${encodeURIComponent(href)}`;
}

export function isAcquisitionRel(rel?: string): boolean {
  return !!rel && rel.includes('opds-spec.org/acquisition');
}

export function isNavigationRel(rel?: string): boolean {
  return rel === 'subsection' || rel === 'collection' || rel === 'start';
}

export function isCatalogChromeRel(rel?: string): boolean {
  const normalized = (rel || '').toLowerCase();
  return (
    normalized === 'self' ||
    normalized === 'start' ||
    normalized === 'alternate' ||
    normalized === 'next' ||
    normalized === 'previous'
  );
}

export function isNavigationLink(link: { rel?: string; type?: string }): boolean {
  const type = (link.type || '').toLowerCase();
  return (
    isNavigationRel(link.rel) ||
    type.includes('kind=navigation') ||
    (type.includes('opds-catalog') && !isAcquisitionRel(link.rel))
  );
}

function hasAcquisition(entry: OpdsEntryLike): boolean {
  return entry.links.some(
    (link) =>
      isAcquisitionRel(link.rel) || /\b(epub|pdf)\b/i.test(link.type || '')
  );
}

function looksLikeBookWork(entry: OpdsEntryLike): boolean {
  if (entry.author?.trim()) return true;
  return entry.links.some((link) => GUTENBERG_EBOOK_ID_RE.test(link.href || ''));
}

export function resolveOpdsAuthor(entry: {
  author?: string;
  content?: string;
  summary?: string;
}): string | undefined {
  const explicit = entry.author?.trim();
  if (explicit) return explicit;

  const fallback = (entry.content || entry.summary || '').trim();
  if (!fallback || fallback.length > 80 || fallback.includes('\n')) return undefined;
  return fallback;
}

export function isLikelyNavigationEntry(entry: OpdsEntryLike): boolean {
  if (hasAcquisition(entry)) return false;
  if (!entry.links.some((link) => isNavigationLink(link))) return false;
  if (looksLikeBookWork(entry)) return false;
  return true;
}
