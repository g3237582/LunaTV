import { SPECIAL_SOURCE_COOKIE } from './special-source.client';
import {
  activateSpecialSourceDeviceGate,
  buildNormalVideoSearchHref,
  buildSourceSearchModeHref,
  buildSpecialVideoSearchHref,
  shouldShowSpecialSourceSearchEntry,
} from './special-source-entry';

describe('特殊源搜索入口是否展示', () => {
  it('站点没有特殊源时不展示', () => {
    expect(
      shouldShowSpecialSourceSearchEntry({
        loggedIn: true,
        configuredCount: 0,
        allowedCount: 0,
      })
    ).toBe(false);
  });

  it('未登录不展示，即使站点配了特殊源', () => {
    expect(
      shouldShowSpecialSourceSearchEntry({
        loggedIn: false,
        configuredCount: 2,
        allowedCount: 2,
      })
    ).toBe(false);
  });

  it('用户组或个人源权限里没有可用特殊源时不展示', () => {
    expect(
      shouldShowSpecialSourceSearchEntry({
        loggedIn: true,
        configuredCount: 2,
        allowedCount: 0,
      })
    ).toBe(false);
  });

  it('已登录且至少有一个可用特殊源时展示', () => {
    expect(
      shouldShowSpecialSourceSearchEntry({
        loggedIn: true,
        configuredCount: 2,
        allowedCount: 1,
      })
    ).toBe(true);
  });
});

describe('特殊源与普通源搜索地址', () => {
  it('切换到特殊源时保留当前关键词，并走 /under', () => {
    expect(buildSpecialVideoSearchHref('  进击的巨人  ')).toBe(
      '/under?q=%E8%BF%9B%E5%87%BB%E7%9A%84%E5%B7%A8%E4%BA%BA'
    );
    expect(buildSpecialVideoSearchHref('')).toBe('/under');
  });

  it('切回普通源时保留关键词，且不带 special=1', () => {
    expect(buildNormalVideoSearchHref('巨人')).toBe(
      '/search?q=%E5%B7%A8%E4%BA%BA&type=video'
    );
    expect(buildNormalVideoSearchHref('')).toBe('/search');
    expect(buildNormalVideoSearchHref('巨人')).not.toContain('special=1');
  });

  it('源站寻片在两种模式间切换时保留关键词，特殊模式才带 special=1', () => {
    expect(
      buildSourceSearchModeHref({ special: true, keyword: ' 巨人 ' })
    ).toBe('/source-search?special=1&keyword=%E5%B7%A8%E4%BA%BA');
    expect(buildSourceSearchModeHref({ special: false, keyword: '巨人' })).toBe(
      '/source-search?keyword=%E5%B7%A8%E4%BA%BA'
    );
    expect(buildSourceSearchModeHref({ special: false })).toBe(
      '/source-search'
    );
  });
});

describe('进入特殊源前打开本机开关', () => {
  it('写入特殊源 cookie，否则 /under 会 404', () => {
    document.cookie = `${SPECIAL_SOURCE_COOKIE}=; path=/; max-age=0`;
    activateSpecialSourceDeviceGate();
    expect(document.cookie).toContain(`${SPECIAL_SOURCE_COOKIE}=1`);
  });
});
