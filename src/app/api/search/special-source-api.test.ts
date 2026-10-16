/**
 * @jest-environment <rootDir>/src/test/next-server-environment.js
 *
 * 原生客户端只用 Bearer，不带 special_source cookie。
 * special=1 只搜特殊源；没权限统一 403，不把拒绝伪装成空结果。
 */
import { NextRequest } from 'next/server';

import { getAvailableApiSites, getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { searchFromApi } from '@/lib/downstream';
import { shouldOmitSpecialSearchFromSharedHistory } from '@/lib/special-source-api';
import { listEnabledSourceScripts } from '@/lib/source-script';

import { POST as postSearchHistory } from '@/app/api/searchhistory/route';
import { GET as getResources } from '@/app/api/search/resources/route';
import { GET as searchGet } from '@/app/api/search/route';
import { GET as getCapability } from '@/app/api/search/special-capability/route';
import { GET as getSuggestions } from '@/app/api/search/suggestions/route';
import { GET as searchWs } from '@/app/api/search/ws/route';

jest.mock('@/lib/config', () => ({
  getConfig: jest.fn(),
  getAvailableApiSites: jest.fn(),
  getCacheTime: jest.fn(async () => 0),
}));

jest.mock('@/lib/downstream', () => ({
  searchFromApi: jest.fn(async (site: { key: string }) => [
    {
      id: '1',
      title: `标题-${site.key}`,
      source: site.key,
      source_name: site.key,
      type_name: '电影',
      year: '2024',
      desc: '',
      poster: '',
      episodes: [],
    },
  ]),
}));

jest.mock('@/lib/permissions', () => ({
  hasFeaturePermission: jest.fn(async () => false),
}));

jest.mock('@/lib/source-script', () => ({
  listEnabledSourceScripts: jest.fn(async () => [
    { key: 'script-a', name: '脚本源' },
  ]),
  executeSavedSourceScript: jest.fn(async () => ({ result: [] })),
  normalizeScriptSearchResults: jest.fn(() => []),
  normalizeScriptSources: jest.fn(() => []),
}));

jest.mock('@/lib/emby-token', () => ({
  getProxyToken: jest.fn(async () => null),
}));

jest.mock('@/lib/emby-manager', () => ({
  embyManager: {
    getAllClients: jest.fn(async () => new Map()),
  },
}));

jest.mock('@/lib/db', () => ({
  db: {
    getSearchHistory: jest.fn(async () => ['普通历史']),
    addSearchHistory: jest.fn(async () => undefined),
    getUserInfoV2: jest.fn(async () => ({ banned: false })),
  },
}));

const mockedGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;
const mockedGetAvailableApiSites = getAvailableApiSites as jest.MockedFunction<
  typeof getAvailableApiSites
>;
const mockedSearchFromApi = searchFromApi as jest.MockedFunction<
  typeof searchFromApi
>;
const mockedListScripts = listEnabledSourceScripts as jest.MockedFunction<
  typeof listEnabledSourceScripts
>;
const mockedAddSearchHistory = db.addSearchHistory as jest.MockedFunction<
  typeof db.addSearchHistory
>;

const normalSite = { key: 'normal', name: '普通', api: 'https://normal.test' };
const specialSites = [
  { key: 'r18a', name: '特殊甲', api: 'https://a.test' },
  { key: 'r18b', name: '特殊乙', api: 'https://b.test' },
];

function bearer(username = 'alice') {
  return `Bearer ${encodeURIComponent(JSON.stringify({ username }))}`;
}

function request(
  path: string,
  init?: {
    username?: string | null;
    cookie?: string;
    method?: string;
    body?: string;
  }
) {
  const headers = new Headers();
  if (init?.username !== null) {
    headers.set('Authorization', bearer(init?.username || 'alice'));
  }
  if (init?.cookie) headers.set('cookie', init.cookie);
  if (init?.body) headers.set('Content-Type', 'application/json');
  return new NextRequest(`http://localhost${path}`, {
    method: init?.method || 'GET',
    headers,
    body: init?.body,
  });
}

function parseSse(text: string) {
  return text
    .split('\n\n')
    .map((block) => block.trim())
    .filter((block) => block.startsWith('data:'))
    .map((block) => JSON.parse(block.slice('data:'.length).trim()));
}

describe('特殊源原生搜索 API', () => {
  beforeEach(() => {
    mockedGetConfig.mockReset();
    mockedGetAvailableApiSites.mockReset();
    mockedSearchFromApi.mockClear();
    mockedListScripts.mockClear();
    mockedAddSearchHistory.mockClear();

    mockedGetConfig.mockResolvedValue({
      SpecialSourceApis: ['r18a', 'r18b'],
      SourceConfig: [
        { key: 'normal', name: '普通', weight: 1 },
        { key: 'r18a', name: '特殊甲', weight: 5 },
        { key: 'r18b', name: '特殊乙', weight: 4 },
      ],
      SiteConfig: { DisableYellowFilter: true, SiteInterfaceCacheTime: 30 },
      OpenListConfig: { Enabled: false },
      EmbyConfig: { Sources: [] },
    } as never);

    mockedGetAvailableApiSites.mockImplementation(
      async (_user, specialOnly) => {
        if (specialOnly) return specialSites;
        return [normalSite];
      }
    );
  });

  describe('GET /api/search/special-capability', () => {
    it('没有登录身份时 401，special_source cookie 不能代替 Bearer', async () => {
      const response = await getCapability(
        request('/api/search/special-capability', {
          username: null,
          cookie: 'special_source=1',
        })
      );
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    });

    it('Bearer 即可返回可用数量，不需要 special_source cookie', async () => {
      const response = await getCapability(
        request('/api/search/special-capability')
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        available: true,
        count: 2,
      });
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    });

    it('登录但一个特殊源都用不了时 available 为 false', async () => {
      mockedGetAvailableApiSites.mockResolvedValue([]);
      const response = await getCapability(
        request('/api/search/special-capability')
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        available: false,
        count: 0,
      });
    });
  });

  describe('搜索接口 special=1', () => {
    it('无权限时 /api/search 返回 403，不搜普通源', async () => {
      mockedGetAvailableApiSites.mockImplementation(
        async (_user, specialOnly) => (specialOnly ? [] : [normalSite])
      );

      const response = await searchGet(
        request('/api/search?q=%E6%A0%87%E9%A2%98&special=1')
      );
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        error: '无权使用特殊源',
        code: 'special_source_forbidden',
      });
      expect(mockedSearchFromApi).not.toHaveBeenCalled();
      expect(mockedAddSearchHistory).not.toHaveBeenCalled();
    });

    it('Bearer + special=1 只返回特殊源，不带 cookie 也能搜', async () => {
      const response = await searchGet(
        request('/api/search?q=%E6%A0%87%E9%A2%98&special=1')
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      expect(
        body.results.map((item: { source: string }) => item.source).sort()
      ).toEqual(['r18a', 'r18b']);
      expect(mockedListScripts).not.toHaveBeenCalled();
      expect(mockedAddSearchHistory).not.toHaveBeenCalled();
      const searchedKeys = mockedSearchFromApi.mock.calls.map(
        (call) => call[0].key
      );
      expect(searchedKeys).toEqual(['r18a', 'r18b']);
    });

    it('不带 special 时仍只搜普通源', async () => {
      const response = await searchGet(
        request('/api/search?q=%E6%A0%87%E9%A2%98')
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(
        body.results.map((item: { source: string }) => item.source)
      ).toEqual(['normal']);
      expect(mockedGetAvailableApiSites).toHaveBeenCalledWith('alice', false);
      expect(mockedListScripts).toHaveBeenCalled();
    });

    it('无权限时流式搜索返回 JSON 403，不打开事件流', async () => {
      mockedGetAvailableApiSites.mockImplementation(
        async (_user, specialOnly) => (specialOnly ? [] : [normalSite])
      );
      const response = await searchWs(
        request('/api/search/ws?q=%E6%A0%87%E9%A2%98&special=1')
      );
      expect(response.status).toBe(403);
      expect(response.headers.get('Content-Type')).toContain(
        'application/json'
      );
      await expect(response.json()).resolves.toMatchObject({
        code: 'special_source_forbidden',
      });
      expect(mockedSearchFromApi).not.toHaveBeenCalled();
    });

    it('获准的流式搜索只推特殊源', async () => {
      const response = await searchWs(
        request('/api/search/ws?q=%E6%A0%87%E9%A2%98&special=1')
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain(
        'text/event-stream'
      );
      const events = parseSse(await response.text());
      const sources = events
        .filter((event) => event.type === 'source_result')
        .map((event) => event.source)
        .sort();
      expect(sources).toEqual(['r18a', 'r18b']);
      expect(events.some((event) => event.type === 'complete')).toBe(true);
      expect(mockedListScripts).not.toHaveBeenCalled();
      expect(mockedAddSearchHistory).not.toHaveBeenCalled();
    });

    it('建议接口无权限 403，获准时只用特殊源标题', async () => {
      mockedGetAvailableApiSites.mockImplementation(
        async (_user, specialOnly) => (specialOnly ? [] : [normalSite])
      );
      const denied = await getSuggestions(
        request('/api/search/suggestions?q=%E6%A0%87%E9%A2%98&special=1')
      );
      expect(denied.status).toBe(403);

      mockedGetAvailableApiSites.mockImplementation(
        async (_user, specialOnly) => {
          if (specialOnly) return specialSites;
          return [normalSite];
        }
      );
      const allowed = await getSuggestions(
        request('/api/search/suggestions?q=%E6%A0%87%E9%A2%98&special=1')
      );
      const body = await allowed.json();
      expect(allowed.status).toBe(200);
      expect(allowed.headers.get('Cache-Control')).toBe('private, no-store');
      expect(
        body.suggestions.some((item: { text: string }) => item.text === '标题')
      ).toBe(true);
      expect(mockedSearchFromApi).toHaveBeenLastCalledWith(
        specialSites[0],
        '标题'
      );
    });

    it('资源列表：普通请求不含特殊源，special=1 只含特殊源且需要 Bearer', async () => {
      const normal = await getResources(
        request('/api/search/resources', { username: null })
      );
      expect(normal.status).toBe(200);
      const normalBody = await normal.json();
      expect(normalBody.map((item: { key: string }) => item.key)).toEqual([
        'normal',
        'script-a',
      ]);

      const missingAuth = await getResources(
        request('/api/search/resources?special=1', { username: null })
      );
      expect(missingAuth.status).toBe(401);

      const special = await getResources(
        request('/api/search/resources?special=1')
      );
      expect(special.status).toBe(200);
      const specialBody = await special.json();
      expect(specialBody.map((item: { key: string }) => item.key)).toEqual([
        'r18a',
        'r18b',
      ]);
    });
  });

  describe('搜索历史默认不收特殊源关键词', () => {
    it('识别 body 与查询参数上的特殊源标记', () => {
      expect(
        shouldOmitSpecialSearchFromSharedHistory({ bodySpecial: true })
      ).toBe(true);
      expect(
        shouldOmitSpecialSearchFromSharedHistory({ querySpecial: '1' })
      ).toBe(true);
      expect(
        shouldOmitSpecialSearchFromSharedHistory({ bodySpecial: false })
      ).toBe(false);
    });

    it('POST special=1 不写入普通历史', async () => {
      const response = await postSearchHistory(
        request('/api/searchhistory?special=1', {
          method: 'POST',
          body: JSON.stringify({ keyword: '特殊词', special: true }),
        })
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(['普通历史']);
      expect(mockedAddSearchHistory).not.toHaveBeenCalled();
    });

    it('普通关键词仍然写入', async () => {
      const response = await postSearchHistory(
        request('/api/searchhistory', {
          method: 'POST',
          body: JSON.stringify({ keyword: '普通词' }),
        })
      );
      expect(response.status).toBe(200);
      expect(mockedAddSearchHistory).toHaveBeenCalledWith('alice', '普通词');
    });
  });
});
