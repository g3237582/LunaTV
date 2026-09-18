import { applyLegadoPageRule } from '@/lib/legado-page-rule';

describe('applyLegadoPageRule', () => {
  it('expands first-page empty suffix for list URLs', () => {
    expect(applyLegadoPageRule('/dsyq/<,index_{{page}}.html>', 1)).toBe(
      '/dsyq/'
    );
  });

  it('keeps later-page suffix for list URLs', () => {
    expect(applyLegadoPageRule('/dsyq/<,index_{{page}}.html>', 2)).toBe(
      '/dsyq/index_{{page}}.html'
    );
  });

  it('leaves <prefix,{{expr}}> for the existing template evaluator', () => {
    expect(applyLegadoPageRule('search?page=<,{{page}}>', 1)).toBe(
      'search?page=<,{{page}}>'
    );
  });
});
