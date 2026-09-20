import { asLiteralLegadoValue } from '@/lib/legado-rule-value';

describe('asLiteralLegadoValue', () => {
  it('treats a static https cover URL as a literal value, not a CSS selector', () => {
    expect(asLiteralLegadoValue('https://z3.ax1x.com/2021/08/22/fzzNBq.png')).toBe(
      'https://z3.ax1x.com/2021/08/22/fzzNBq.png'
    );
  });

  it('normalizes protocol-relative image URLs', () => {
    expect(asLiteralLegadoValue('//z3.ax1x.com/2021/08/22/fzzNBq.png')).toBe(
      'https://z3.ax1x.com/2021/08/22/fzzNBq.png'
    );
  });

  it('does not treat CSS or field selectors as literals', () => {
    expect(asLiteralLegadoValue('class.sons')).toBeUndefined();
    expect(asLiteralLegadoValue('tag.img@src')).toBeUndefined();
    expect(asLiteralLegadoValue('text.送别')).toBeUndefined();
  });
});
