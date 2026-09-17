import { NextRequest, NextResponse } from 'next/server';

import { isAccessTokenInvalidated } from './access-token-invalidation';
import {
  getAuthCookieName,
  getCurrentSite,
  getCurrentSiteId,
  parseIsolatedSites,
} from './site-context';

export type AuthInfo = {
  password?: string;
  username?: string;
  signature?: string;
  timestamp?: number;
  role?: 'owner' | 'admin' | 'user';
  tokenId?: string;
  refreshToken?: string;
  refreshExpires?: number;
};

function getAuthTokenFromHeader(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const bearerMatch = trimmed.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) {
    return bearerMatch[1].trim();
  }

  const tokenMatch = trimmed.match(/^Token\s+(.+)$/i);
  if (tokenMatch) {
    return tokenMatch[1].trim();
  }

  return trimmed;
}

export function parseAuthInfo(value?: string | null): AuthInfo | null {
  if (!value) {
    return null;
  }

  let decoded = value;

  try {
    decoded = decodeURIComponent(decoded);
  } catch (error) {
    decoded = value;
  }

  if (decoded.includes('%')) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch (error) {
      decoded = value;
    }
  }

  try {
    return JSON.parse(decoded) as AuthInfo;
  } catch (error) {
    return null;
  }
}

export function getAuthCookieNameFromRequest(
  request?: NextRequest | { cookies: { get(name: string): { value: string } | undefined }; headers: Headers }
): string {
  if (request) {
    return getCurrentSite(request.headers).authCookieName;
  }
  return getCurrentSite().authCookieName;
}

export function getBrowserAuthCookieName(): string {
  if (typeof window !== 'undefined') {
    const runtime = (
      window as Window & {
        RUNTIME_CONFIG?: { AUTH_COOKIE_NAME?: string; SITE_ID?: string };
      }
    ).RUNTIME_CONFIG;
    if (runtime?.AUTH_COOKIE_NAME) {
      return runtime.AUTH_COOKIE_NAME;
    }
    if (runtime?.SITE_ID) {
      return getAuthCookieName(runtime.SITE_ID);
    }
  }
  return getAuthCookieName(getCurrentSiteId());
}

const AUTH_COOKIE_OPTIONS = {
  path: '/',
  sameSite: 'lax' as const,
  httpOnly: false,
  secure: false,
};

export function writeAuthCookie(
  response: NextResponse,
  value: string,
  expires: Date,
  request?: NextRequest
): void {
  response.cookies.set(getAuthCookieNameFromRequest(request), value, {
    ...AUTH_COOKIE_OPTIONS,
    expires,
  });
}

export function expireAuthCookie(
  response: NextResponse,
  request?: NextRequest
): void {
  response.cookies.set(getAuthCookieNameFromRequest(request), '', {
    ...AUTH_COOKIE_OPTIONS,
    expires: new Date(0),
  });
}

export function readAuthCookieValue(
  request: NextRequest | { cookies: { get(name: string): { value: string } | undefined }; headers: Headers }
): string | undefined {
  const cookieName = getAuthCookieNameFromRequest(request);
  const named = request.cookies.get(cookieName)?.value;
  if (named) {
    return named;
  }
  // 单站点升级时仍可读旧的 auth，双站点绝不能共用
  if (parseIsolatedSites().length === 1) {
    return request.cookies.get('auth')?.value;
  }
  return undefined;
}

// 从cookie获取认证信息 (服务端使用)
export function getAuthInfoFromCookie(request: NextRequest): AuthInfo | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const headerValue = getAuthTokenFromHeader(authHeader);
    const headerAuthInfo = parseAuthInfo(headerValue);
    if (headerAuthInfo) {
      return isAccessTokenInvalidated(headerAuthInfo) ? null : headerAuthInfo;
    }
  }

  const authCookie = readAuthCookieValue(request);

  if (!authCookie) {
    return null;
  }

  const authInfo = parseAuthInfo(authCookie);
  return isAccessTokenInvalidated(authInfo) ? null : authInfo;
}

// 从cookie获取认证信息 (客户端使用)
export function getAuthInfoFromBrowserCookie(): AuthInfo | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const trimmed = cookie.trim();
      const firstEqualIndex = trimmed.indexOf('=');

      if (firstEqualIndex > 0) {
        const key = trimmed.substring(0, firstEqualIndex);
        const value = trimmed.substring(firstEqualIndex + 1);
        if (key && value) {
          acc[key] = value;
        }
      }

      return acc;
    }, {} as Record<string, string>);

    const cookieName = getBrowserAuthCookieName();
    const authCookie = cookies[cookieName];
    if (!authCookie) {
      return null;
    }

    return parseAuthInfo(authCookie);
  } catch (error) {
    return null;
  }
}

// 清除浏览器中的认证cookie (客户端使用)
export function clearAuthCookie(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const cookieName = getBrowserAuthCookieName();
    const expired = 'path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    document.cookie = `${cookieName}=; ${expired}`;
    document.cookie =
      `${cookieName}=; path=/; domain=${window.location.hostname}; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    document.cookie = `auth=; ${expired}`;
  } catch (error) {
    console.error('[Auth] Failed to clear cookie:', error);
  }
}
