export const DHASH_WIDTH = 9;
export const DHASH_HEIGHT = 8;
export const MATCH_DISTANCE = 10;

export function fromLuma(luma: number[]): string {
  if (luma.length !== DHASH_WIDTH * DHASH_HEIGHT) {
    throw new Error('expected 72 luma values');
  }
  let bits = '';
  for (let row = 0; row < DHASH_HEIGHT; row += 1) {
    for (let col = 0; col < DHASH_WIDTH - 1; col += 1) {
      const left = luma[row * DHASH_WIDTH + col];
      const right = luma[row * DHASH_WIDTH + col + 1];
      bits += left > right ? '1' : '0';
    }
  }
  return bitsToHex(bits);
}

export function rgbaToLuma(
  rgba: ArrayLike<number>,
  srcWidth: number,
  srcHeight: number
): number[] {
  const luma = new Array<number>(DHASH_WIDTH * DHASH_HEIGHT).fill(0);
  if (srcWidth <= 0 || srcHeight <= 0) {
    return luma;
  }
  for (let row = 0; row < DHASH_HEIGHT; row += 1) {
    const srcY = Math.min(
      srcHeight - 1,
      Math.floor((row * srcHeight) / DHASH_HEIGHT)
    );
    for (let col = 0; col < DHASH_WIDTH; col += 1) {
      const srcX = Math.min(
        srcWidth - 1,
        Math.floor((col * srcWidth) / DHASH_WIDTH)
      );
      const index = (srcY * srcWidth + srcX) * 4;
      luma[row * DHASH_WIDTH + col] = Math.max(
        0,
        Math.min(
          255,
          Math.round(
            0.299 * rgba[index] +
              0.587 * rgba[index + 1] +
              0.114 * rgba[index + 2]
          )
        )
      );
    }
  }
  return luma;
}

export function hammingHex(left: string, right: string): number {
  if (!left || left.length !== right.length) {
    return 64;
  }
  let distance = 0;
  for (let offset = 0; offset < left.length; offset += 8) {
    const end = Math.min(offset + 8, left.length);
    const a = parseInt(left.slice(offset, end), 16);
    const b = parseInt(right.slice(offset, end), 16);
    distance += bitCount((a ^ b) >>> 0);
  }
  return distance;
}

export function isMatch(left: string, right: string): boolean {
  return hammingHex(left, right) <= MATCH_DISTANCE;
}

function bitsToHex(bits: string): string {
  let hex = '';
  for (let offset = 0; offset < bits.length; offset += 4) {
    hex += parseInt(bits.slice(offset, offset + 4), 2).toString(16);
  }
  return hex;
}

function bitCount(value: number): number {
  let count = 0;
  let current = value;
  while (current) {
    current &= current - 1;
    count += 1;
  }
  return count;
}
