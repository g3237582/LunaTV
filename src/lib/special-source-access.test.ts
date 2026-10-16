jest.mock('@/lib/config', () => ({
  getConfig: jest.fn(),
  getAvailableApiSites: jest.fn(),
}));

import { getAvailableApiSites, getConfig } from '@/lib/config';

import { resolveSpecialSourceSearchEnabled } from './special-source-access';

const mockedGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;
const mockedGetAvailableApiSites = getAvailableApiSites as jest.MockedFunction<
  typeof getAvailableApiSites
>;

describe('resolveSpecialSourceSearchEnabled', () => {
  beforeEach(() => {
    mockedGetConfig.mockReset();
    mockedGetAvailableApiSites.mockReset();
  });

  it('未登录直接关闭，不去查配置', async () => {
    await expect(resolveSpecialSourceSearchEnabled(null)).resolves.toBe(false);
    await expect(resolveSpecialSourceSearchEnabled('')).resolves.toBe(false);
    expect(mockedGetConfig).not.toHaveBeenCalled();
  });

  it('SpecialSourceApis 为空时关闭', async () => {
    mockedGetConfig.mockResolvedValue({ SpecialSourceApis: [] } as never);
    await expect(resolveSpecialSourceSearchEnabled('alice')).resolves.toBe(
      false
    );
    expect(mockedGetAvailableApiSites).not.toHaveBeenCalled();
  });

  it('用户组或个人源名单里没有特殊源时关闭', async () => {
    mockedGetConfig.mockResolvedValue({
      SpecialSourceApis: ['r18a'],
    } as never);
    mockedGetAvailableApiSites.mockResolvedValue([]);
    await expect(resolveSpecialSourceSearchEnabled('alice')).resolves.toBe(
      false
    );
    expect(mockedGetAvailableApiSites).toHaveBeenCalledWith('alice', true);
  });

  it('登录且至少有一个可用特殊源时打开', async () => {
    mockedGetConfig.mockResolvedValue({
      SpecialSourceApis: ['r18a', 'r18b'],
    } as never);
    mockedGetAvailableApiSites.mockResolvedValue([
      { key: 'r18a', name: '特殊源', api: 'https://example.test' },
    ]);
    await expect(resolveSpecialSourceSearchEnabled('alice')).resolves.toBe(
      true
    );
  });
});
