export const SITE_HEADER: string;

export type IsolatedSite = {
  id: string;
  port: number;
  kvrocksUrl: string;
  siteName: string;
  siteBase: string;
  authCookieName: string;
};

export function sanitizeSiteId(id: string): string;
export function getAuthCookieName(siteId: string): string;
export function parseIsolatedSites(
  env?: NodeJS.Dict<string>
): IsolatedSite[];
export function getSiteByPort(
  port: number,
  sites?: IsolatedSite[]
): IsolatedSite;
export function getSiteById(id: string, sites?: IsolatedSite[]): IsolatedSite;
export function getPeerSite(
  siteId: string,
  sites?: IsolatedSite[]
): IsolatedSite | null;
export function readSiteIdFromHeaders(headers?: unknown): string | undefined;
export function stampSiteHeader(
  headers: Record<string, string | string[] | undefined>,
  siteId: string
): void;
export function getDefaultSiteId(env?: NodeJS.Dict<string>): string;
