import { fromLuma, hammingHex, MATCH_DISTANCE } from '@/lib/poster-dhash';

describe('poster dHash', () => {
  it('hashes identical luma as the same value', () => {
    const luma = Array.from({ length: 72 }, (_, index) => (index % 9) * 28);
    expect(fromLuma(luma)).toBe(fromLuma([...luma]));
  });

  it('keeps a small hamming distance after a mild luma change', () => {
    const left = Array.from({ length: 72 }, (_, index) => (index % 9) * 28);
    const right = [...left];
    right[10] = 255;
    expect(hammingHex(fromLuma(left), fromLuma(right))).toBeLessThanOrEqual(
      MATCH_DISTANCE
    );
  });

  it('treats inverted luma as a different picture', () => {
    const left = Array.from({ length: 72 }, (_, index) => (index % 9) * 28);
    const right = left.map((value) => 255 - value);
    expect(hammingHex(fromLuma(left), fromLuma(right))).toBeGreaterThan(
      MATCH_DISTANCE
    );
  });
});
