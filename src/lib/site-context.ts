import siteRuntime from './site-runtime';

export const SITE_HEADER: string = siteRuntime.SITE_HEADER;

export type IsolatedSite = {
  id: string;
  port: number;
  kvrocksUrl: string;
  siteName: string;
  siteBase: string;
  authCookieName: string;
};

type HeaderMap =
  | Headers
  | { get(name: string): string | null }
  | Record<string, string | string[] | undefined>;

let injectedSiteId: string | null = null;

export function sanitizeSiteId(id: string): string {
  return siteRuntime.sanitizeSiteId(id);
}

export function getAuthCookieName(siteId: string): string {
  return siteRuntime.getAuthCookieName(siteId);
}

export function parseIsolatedSites(
  env: NodeJS.Dict<string> = process.env
): IsolatedSite[] {
  return siteRuntime.parseIsolatedSites(env);
}

export function getSiteByPort(
  port: number,
  sites: IsolatedSite[] = parseIsolatedSites()
): IsolatedSite {
  return siteRuntime.getSiteByPort(port, sites);
}

export function getSiteById(
  id: string,
  sites: IsolatedSite[] = parseIsolatedSites()
): IsolatedSite {
  return siteRuntime.getSiteById(id, sites);
}

export function getPeerSite(
  siteId: string,
  sites: IsolatedSite[] = parseIsolatedSites()
): IsolatedSite | null {
  return siteRuntime.getPeerSite(siteId, sites);
}

export function readSiteIdFromHeaders(
  headers?: HeaderMap | null
): string | undefined {
  return siteRuntime.readSiteIdFromHeaders(headers);
}

export function stampSiteHeader(
  headers: Record<string, string | string[] | undefined>,
  siteId: string
): void {
  siteRuntime.stampSiteHeader(headers, siteId);
}

export function setTestSiteId(siteId: string | null): void {
  injectedSiteId = siteId ? sanitizeSiteId(siteId) : null;
}

export function getCurrentSiteId(headers?: HeaderMap | null): string {
  const sites = parseIsolatedSites();
  const known = new Set(sites.map((site) => site.id));

  if (injectedSiteId && known.has(injectedSiteId)) {
    return injectedSiteId;
  }

  const fromArg = readSiteIdFromHeaders(headers);
  if (fromArg && known.has(fromArg)) {
    return fromArg;
  }

  const fromNext = readSiteIdFromNextHeaders();
  if (fromNext && known.has(fromNext)) {
    return fromNext;
  }

  return sites[0].id;
}

export function getCurrentSite(headers?: HeaderMap | null): IsolatedSite {
  const sites = parseIsolatedSites();
  const siteId = getCurrentSiteId(headers);
  return sites.find((site) => site.id === siteId) || sites[0];
}

function readSiteIdFromNextHeaders(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { headers } = require('next/headers') as {
      headers: () => Headers | Promise<Headers>;
    };
    const headerStore = headers();
    if (headerStore && typeof (headerStore as Promise<Headers>).then === 'function') {
      return undefined;
    }
    return readSiteIdFromHeaders(headerStore as Headers);
  } catch {
    return undefined;
  }
}
