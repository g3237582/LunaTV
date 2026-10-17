/**
 * 服务端日志不能带出 TMDB 等请求 URL 里的密钥。
 */
/* eslint-disable no-console */
import {
  installSecretLogRedaction,
  redactForLog,
  redactSecretsInString,
  resetSecretLogRedactionForTests,
} from './redact-secrets';

const SECRET_URL =
  'https://api.themoviedb.org/3/search/multi?api_key=SECRETKEY123&language=zh-CN&query=test';

describe('redactSecretsInString', () => {
  it('打码 api_key、token、key 等查询参数，保留其余 URL', () => {
    expect(redactSecretsInString(SECRET_URL)).toBe(
      'https://api.themoviedb.org/3/search/multi?api_key=[REDACTED]&language=zh-CN&query=test'
    );
    expect(
      redactSecretsInString(
        'https://media.example/v?token=abc&access_token=def&key=ghi&page=1'
      )
    ).toBe(
      'https://media.example/v?token=[REDACTED]&access_token=[REDACTED]&key=[REDACTED]&page=1'
    );
  });

  it('不误伤 keyword 这类普通参数', () => {
    expect(
      redactSecretsInString('https://search.example?keyword=api_key')
    ).toBe('https://search.example?keyword=api_key');
  });
});

describe('redactForLog', () => {
  it('node-fetch 错误信息里的 api_key 会被打码', () => {
    const error = new Error(
      `request to ${SECRET_URL} failed, reason: connect ETIMEDOUT`
    );
    error.name = 'FetchError';
    const redacted = redactForLog(error) as Error;

    expect(redacted).toBeInstanceOf(Error);
    expect(redacted.message).toContain('api_key=[REDACTED]');
    expect(redacted.message).not.toContain('SECRETKEY123');
    expect(redacted.stack || '').not.toContain('SECRETKEY123');
    expect(redacted.message).toContain('connect ETIMEDOUT');
  });

  it('嵌套 cause 和普通对象里的 URL 也会打码', () => {
    const cause = new Error(`request to ${SECRET_URL} failed`);
    const error = new Error('搜索 TMDB 内容失败');
    (error as Error & { cause?: unknown }).cause = cause;

    const redacted = redactForLog(error) as Error & { cause?: Error };
    expect(redacted.cause?.message || '').not.toContain('SECRETKEY123');
    expect(redactForLog({ url: SECRET_URL, status: 500 })).toEqual({
      url: 'https://api.themoviedb.org/3/search/multi?api_key=[REDACTED]&language=zh-CN&query=test',
      status: 500,
    });
  });
});

describe('installSecretLogRedaction', () => {
  afterEach(() => {
    resetSecretLogRedactionForTests();
  });

  it('console.error 打印带密钥的错误时，输出里没有密钥', () => {
    const lines: unknown[][] = [];
    const original = console.error;
    console.error = ((...args: unknown[]) => {
      lines.push(args);
    }) as typeof console.error;

    try {
      installSecretLogRedaction();
      console.error(
        '搜索 TMDB 内容失败:',
        new Error(`request to ${SECRET_URL} failed, reason: getaddrinfo`)
      );

      const loggedError = lines[0]?.[1] as Error;
      expect(lines[0]?.[0]).toBe('搜索 TMDB 内容失败:');
      expect(loggedError.message).toContain('api_key=[REDACTED]');
      expect(loggedError.message).not.toContain('SECRETKEY123');
      expect(loggedError.stack || '').not.toContain('SECRETKEY123');
    } finally {
      resetSecretLogRedactionForTests();
      console.error = original;
    }
  });
});
