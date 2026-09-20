import { createHash } from 'crypto';
import { TextDecoder as NodeTextDecoder } from 'util';
import { inflateRawSync } from 'zlib';

const TEXT_HREF_PREFIX = 'legado-text:';
const ZIP_LOCAL = 0x04034b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_EOCD = 0x06054b50;
const textChapterStore = new Map<string, string>();

export interface LegadoTextChapter {
  title: string;
  href: string;
  order: number;
}

export interface LegadoTextBook {
  chapters: LegadoTextChapter[];
  contents: Map<string, string>;
}

export function isLegadoTextHref(href?: string): boolean {
  return !!href && href.startsWith(TEXT_HREF_PREFIX);
}

export function isBrowserChallengeHtml(html: string): boolean {
  const text = String(html || '');
  return /正在验证浏览器|正在進行安全驗證|請稍等|Just a moment|Attention Required/i.test(text);
}

export function findTextDownloadHref(html: string, baseUrl: string): string | undefined {
  const source = String(html || '');
  const hrefs: string[] = [];
  const labeled = source.match(/href\s*=\s*["']([^"']+)["'][^>]*>\s*[^<]*TXT\s*下载/i)
    || source.match(/TXT\s*下载[\s\S]{0,120}?href\s*=\s*["']([^"']+)["']/i);
  if (labeled?.[1]) hrefs.push(labeled[1]);

  const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRe.exec(source))) {
    const href = match[1];
    if (/\.(zip|txt)(?:[?#]|$)/i.test(href)) hrefs.push(href);
  }

  const resolved = hrefs.map((href) => resolveHref(href, baseUrl)).find(Boolean);
  if (resolved) return resolved;

  const bookId = baseUrl.match(/\/read\/(\d+)\/?/i)?.[1];
  if (bookId && /ixdzs/i.test(baseUrl)) return `https://down7.ixdzs8.com/${bookId}.zip`;
  return undefined;
}

export function extractTextFromArchive(data: Uint8Array): string {
  if (!data?.length) return '';
  if (isZip(data)) {
    const files = extractZipFiles(data)
      .filter((file) => file.content.length > 0 && !file.name.endsWith('/'));
    const preferred = files.find((file) => /\.txt$/i.test(file.name)) || files[0];
    return preferred ? decodeTextBytes(preferred.content) : '';
  }
  return decodeTextBytes(data);
}

export function chaptersFromPlainText(text: string, bookUrl: string): LegadoTextBook {
  const normalized = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
  const contents = new Map<string, string>();
  if (!normalized) return { chapters: [], contents };

  const parts = splitPlainTextChapters(normalized);
  const chapters = parts.map((part, index) => {
    const href = `${TEXT_HREF_PREFIX}${createHash('sha1').update(`${bookUrl}|${index}|${part.title}`).digest('hex').slice(0, 16)}`;
    contents.set(href, part.body);
    textChapterStore.set(href, part.body);
    return { title: part.title, href, order: index };
  });
  return { chapters, contents };
}

export function readTextChapterContent(href: string): string | undefined {
  return textChapterStore.get(href);
}

function resolveHref(href: string, baseUrl: string): string | undefined {
  const trimmed = href.trim();
  if (!trimmed || /^javascript:/i.test(trimmed)) return undefined;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return trimmed;
  }
}

function isZip(data: Uint8Array): boolean {
  return data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b;
}

function decodeTextBytes(bytes: Uint8Array): string {
  const candidates = ['utf-8', 'gb18030', 'gbk']
    .map((encoding) => decodeWith(encoding, bytes))
    .filter((text): text is string => typeof text === 'string')
    .map((text) => ({
      text,
      score:
        (text.match(/[\u4e00-\u9fff]/g) || []).length
        - (text.match(/\uFFFD/g) || []).length * 50,
    }))
    .sort((left, right) => right.score - left.score);
  return (candidates[0]?.text || Buffer.from(bytes).toString('utf8')).replace(/^\uFEFF/, '');
}

function decodeWith(encoding: string, bytes: Uint8Array): string | undefined {
  try {
    return new NodeTextDecoder(encoding).decode(bytes);
  } catch {
    return undefined;
  }
}

function extractZipFiles(data: Uint8Array): Array<{ name: string; content: Uint8Array }> {
  const buf = Buffer.from(data);
  const fromCentral = extractViaCentralDirectory(buf);
  return fromCentral.length > 0 ? fromCentral : extractViaLocalHeaders(buf);
}

function extractViaCentralDirectory(buf: Buffer): Array<{ name: string; content: Uint8Array }> {
  const eocd = findEocd(buf);
  if (eocd < 0) return [];
  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  const files: Array<{ name: string; content: Uint8Array }> = [];
  for (let i = 0; i < count && offset + 46 <= buf.length; i += 1) {
    if (buf.readUInt32LE(offset) !== ZIP_CENTRAL) break;
    const method = buf.readUInt16LE(offset + 10);
    const compSize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localOffset = buf.readUInt32LE(offset + 42);
    const name = buf.subarray(offset + 46, offset + 46 + nameLen).toString('utf8');
    const content = inflateZipEntry(buf, localOffset, method, compSize);
    if (content) files.push({ name, content });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function extractViaLocalHeaders(buf: Buffer): Array<{ name: string; content: Uint8Array }> {
  const files: Array<{ name: string; content: Uint8Array }> = [];
  let offset = 0;
  while (offset + 30 <= buf.length) {
    if (buf.readUInt32LE(offset) !== ZIP_LOCAL) break;
    const method = buf.readUInt16LE(offset + 8);
    const flags = buf.readUInt16LE(offset + 6);
    const compSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const name = buf.subarray(offset + 30, offset + 30 + nameLen).toString('utf8');
    if (flags & 0x08) break;
    const content = inflateZipEntry(buf, offset, method, compSize);
    if (content) files.push({ name, content });
    offset += 30 + nameLen + extraLen + compSize;
  }
  return files;
}

function inflateZipEntry(buf: Buffer, localOffset: number, method: number, compSize: number): Uint8Array | null {
  if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== ZIP_LOCAL) return null;
  const nameLen = buf.readUInt16LE(localOffset + 26);
  const extraLen = buf.readUInt16LE(localOffset + 28);
  const start = localOffset + 30 + nameLen + extraLen;
  const compressed = buf.subarray(start, start + compSize);
  if (method === 0) return compressed;
  if (method === 8) {
    try {
      return inflateRawSync(compressed);
    } catch {
      return null;
    }
  }
  return null;
}

function findEocd(buf: Buffer): number {
  const min = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= min; i -= 1) {
    if (buf.readUInt32LE(i) === ZIP_EOCD) return i;
  }
  return -1;
}

function execAll(pattern: RegExp, text: string): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  let found = pattern.exec(text);
  while (found) {
    matches.push(found);
    found = pattern.exec(text);
  }
  return matches;
}

function splitPlainTextChapters(text: string): Array<{ title: string; body: string }> {
  const numbered = execAll(/第[零〇一二三四五六七八九十百千万0-9]+[章节回部卷]/g, text);
  const firstNumbered = numbered[0]?.index ?? text.length;
  const lastNumbered = numbered.length > 0
    ? (numbered[numbered.length - 1].index || 0) + numbered[numbered.length - 1][0].length
    : 0;
  const namedBefore = execAll(/前言|序章|楔子/g, text).filter((match) => (match.index || 0) < firstNumbered);
  const namedAfter = execAll(/尾声|后记/g, text).filter((match) => (match.index || 0) >= lastNumbered);
  const matches = [...namedBefore, ...numbered, ...namedAfter]
    .sort((left, right) => (left.index || 0) - (right.index || 0));

  if (matches.length > 0) {
    const parts: Array<{ title: string; body: string }> = [];
    matches.forEach((match, index) => {
      const start = match.index || 0;
      const end = index + 1 < matches.length ? (matches[index + 1].index || text.length) : text.length;
      const title = match[0].trim();
      const body = text.slice(start, end).trim();
      if (body.length > title.length) parts.push({ title, body });
    });
    if (parts.length > 0) return parts;
  }

  const named = text.match(/『([^/』]+)/)?.[1]?.trim();
  return [{ title: named || '全文', body: text }];
}
