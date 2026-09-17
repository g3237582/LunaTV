'use strict';

const SITE_HEADER = 'x-lunatv-site';

function sanitizeSiteId(id) {
  const cleaned = String(id || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return cleaned || 'luna';
}

function getAuthCookieName(siteId) {
  return `auth_${sanitizeSiteId(siteId)}`;
}

function readSlot(env, slot, defaults) {
  const prefix = `SITE_${slot}_`;
  const rawPort = Number(env[`${prefix}PORT`] || defaults.port);
  const id = sanitizeSiteId(env[`${prefix}ID`] || defaults.id);
  return {
    id,
    port: Number.isFinite(rawPort) && rawPort > 0 ? rawPort : defaults.port,
    kvrocksUrl: String(env[`${prefix}KVROCKS_URL`] || defaults.kvrocksUrl || ''),
    siteName: String(env[`${prefix}SITE_NAME`] || defaults.siteName),
    siteBase: String(env[`${prefix}SITE_BASE`] || defaults.siteBase || ''),
    authCookieName: getAuthCookieName(id),
  };
}

function hasSiteB(env) {
  return Boolean(
    env.SITE_B_ID ||
      env.SITE_B_PORT ||
      env.SITE_B_KVROCKS_URL ||
      env.SITE_B_SITE_NAME ||
      env.SITE_B_SITE_BASE
  );
}

function parseIsolatedSites(env = process.env) {
  const defaultPort = Number(env.PORT || 3000);
  const siteA = readSlot(env, 'A', {
    id: 'luna',
    port: Number.isFinite(defaultPort) && defaultPort > 0 ? defaultPort : 3000,
    kvrocksUrl: env.KVROCKS_URL || '',
    siteName: env.NEXT_PUBLIC_SITE_NAME || 'MoonTVPlus',
    siteBase: env.SITE_BASE || '',
  });
  const sites = [siteA];
  if (hasSiteB(env)) {
    sites.push(
      readSlot(env, 'B', {
        id: 'luna2',
        port: 3001,
        kvrocksUrl: '',
        siteName: 'LunaTV 2',
        siteBase: '',
      })
    );
  }
  return sites;
}

function getSiteByPort(port, sites = parseIsolatedSites()) {
  const match = sites.find((site) => site.port === Number(port));
  if (!match) {
    throw new Error(`No isolated site configured for port ${port}`);
  }
  return match;
}

function getSiteById(id, sites = parseIsolatedSites()) {
  const siteId = sanitizeSiteId(id);
  const match = sites.find((site) => site.id === siteId);
  if (!match) {
    throw new Error(`Unknown isolated site: ${id}`);
  }
  return match;
}

function getPeerSite(siteId, sites = parseIsolatedSites()) {
  if (sites.length < 2) {
    return null;
  }
  const current = sanitizeSiteId(siteId);
  return sites.find((site) => site.id !== current) || null;
}

function headerValue(value) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function readSiteIdFromHeaders(headers) {
  if (!headers) {
    return undefined;
  }
  if (typeof headers.get === 'function') {
    const value = headers.get(SITE_HEADER);
    return value ? sanitizeSiteId(value) : undefined;
  }
  const raw =
    headerValue(headers[SITE_HEADER]) || headerValue(headers['X-Lunatv-Site']);
  return raw ? sanitizeSiteId(raw) : undefined;
}

function stampSiteHeader(headers, siteId) {
  const id = sanitizeSiteId(siteId);
  Object.keys(headers).forEach((key) => {
    if (key.toLowerCase() === SITE_HEADER) {
      delete headers[key];
    }
  });
  headers[SITE_HEADER] = id;
}

function getDefaultSiteId(env = process.env) {
  return parseIsolatedSites(env)[0].id;
}

module.exports = {
  SITE_HEADER,
  sanitizeSiteId,
  getAuthCookieName,
  parseIsolatedSites,
  getSiteByPort,
  getSiteById,
  getPeerSite,
  readSiteIdFromHeaders,
  stampSiteHeader,
  getDefaultSiteId,
};
