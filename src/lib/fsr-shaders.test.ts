import { fsrEasuWGSL, fsrRcasWGSL } from './fsr-shaders';

describe('FSR shaders', () => {
  it('avoids function pointers so Chrome Tint can compile EASU', () => {
    expect(fsrEasuWGSL).not.toContain('ptr<function');
    expect(fsrEasuWGSL).not.toContain('*aC');
    expect(fsrEasuWGSL).toContain('fn fs_easu');
    expect(fsrRcasWGSL).toContain('fn fs_rcas');
  });

  it('consumes the fullscreen quad UV so vertex and fragment stages match', () => {
    expect(fsrEasuWGSL).toContain('@location(0) uv');
    expect(fsrRcasWGSL).toContain('@location(0) uv');
  });

  it('uses WGSL inverseSqrt instead of GLSL inversesqrt', () => {
    expect(fsrEasuWGSL).not.toContain('inversesqrt');
    expect(fsrEasuWGSL).toContain('inverseSqrt');
  });
});
