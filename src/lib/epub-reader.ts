export const JSZIP_SCRIPT_SRC =
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
export const EPUBJS_SCRIPT_SRC =
  'https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js';

export type EpubReaderMode = 'paginated' | 'scrolled';

export function isEpubZipBuffer(data: ArrayBuffer | Uint8Array): boolean {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

export function sanitizeEpubDisplayTarget(
  target?: string | null
): string | undefined {
  const value = target?.trim();
  return value ? value : undefined;
}

export function getEpubReaderReopenKey(input: {
  sourceId?: string;
  bookId?: string;
  acquisitionHref?: string;
  mode: EpubReaderMode;
}): string {
  return [
    input.sourceId || '',
    input.bookId || '',
    input.acquisitionHref || '',
    input.mode,
  ].join('::');
}

export function getEpubRenditionOptions(
  mode: EpubReaderMode,
  size?: { width: number; height: number }
) {
  const width = size && size.width > 0 ? Math.round(size.width) : '100%';
  const height = size && size.height > 0 ? Math.round(size.height) : '100%';
  return mode === 'scrolled'
    ? {
        width,
        height,
        spread: 'none' as const,
        manager: 'default',
        flow: 'scrolled-doc',
      }
    : {
        width,
        height,
        spread: 'none' as const,
        manager: 'default',
        flow: 'paginated',
      };
}
