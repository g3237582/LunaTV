const AD_KEYWORDS = [
  'sponsor',
  '/ad/',
  '/ads/',
  'advert',
  'advertisement',
  '/adjump',
  'redtraffic',
];

/**
 * 默认 HLS 去广告：只丢掉广告分片，保留 #EXT-X-DISCONTINUITY。
 * 片源在广告切口或编码重置处会改 PTS，剥掉 discontinuity 会导致
 * MSE bufferAppendError，随后 recover 从 0 重播。
 */
export function filterAdsFromM3U8Default(
  _type: string,
  m3u8Content: string
): string {
  if (!m3u8Content) return '';

  const lines = m3u8Content.split('\n');
  const filteredLines: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.includes('#EXTINF:') && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const containsAdKeyword = AD_KEYWORDS.some((keyword) =>
        nextLine.toLowerCase().includes(keyword.toLowerCase())
      );

      if (containsAdKeyword) {
        i += 2;
        continue;
      }
    }

    filteredLines.push(line);
    i++;
  }

  return filteredLines.join('\n');
}
