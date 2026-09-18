export interface OpdsEntryLike {
  title?: string;
  author?: string;
  links: Array<{ href: string; rel?: string; type?: string }>;
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
  return entry.links.some((link) =>
    /\/ebooks\/\d+(?:\.opds)?(?:[?#]|$)/i.test(link.href || '')
  );
}

export function isLikelyNavigationEntry(entry: OpdsEntryLike): boolean {
  if (hasAcquisition(entry)) return false;
  if (!entry.links.some((link) => isNavigationLink(link))) return false;
  if (looksLikeBookWork(entry)) return false;
  return true;
}
