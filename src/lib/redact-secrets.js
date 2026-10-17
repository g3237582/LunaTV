'use strict';

/**
 * 打码日志里的 URL 查询密钥。
 * node-fetch 失败时会把完整请求地址写进 Error.message，
 * TMDB 的 api_key 会因此出现在 docker 日志里。
 */

const REDACTED = '[REDACTED]';
const METHODS = ['log', 'info', 'warn', 'error', 'debug'];
const FLAG = Symbol.for('lunatv.secretLogRedaction');

const SENSITIVE_QUERY =
  /([?&#])((?:api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|app[_-]?key|token|secret|password|passwd|pwd|authorization|signature|sig|auth|key))(=)([^&#\s"'<>]*)/gi;

function redactSecretsInString(value) {
  if (typeof value !== 'string' || !value.includes('=')) return value;
  return value.replace(SENSITIVE_QUERY, `$1$2$3${REDACTED}`);
}

function redactForLog(value, seen = new WeakSet(), depth = 0) {
  if (typeof value === 'string') return redactSecretsInString(value);
  if (value == null || typeof value !== 'object') return value;
  if (seen.has(value) || depth > 6) return value;
  seen.add(value);

  if (typeof URL !== 'undefined' && value instanceof URL) {
    return redactSecretsInString(value.toString());
  }

  if (value instanceof Error) {
    const redacted = new Error(redactSecretsInString(value.message));
    redacted.name = value.name;
    if (typeof value.stack === 'string') {
      redacted.stack = redactSecretsInString(value.stack);
    }
    if ('cause' in value) {
      redacted.cause = redactForLog(value.cause, seen, depth + 1);
    }
    return redacted;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item, seen, depth + 1));
  }

  const output = {};
  Object.keys(value).forEach((key) => {
    output[key] = redactForLog(value[key], seen, depth + 1);
  });
  return output;
}

function installSecretLogRedaction() {
  if (globalThis[FLAG]) return;
  const originals = {};
  METHODS.forEach((method) => {
    const original = console[method].bind(console);
    originals[method] = original;
    console[method] = (...args) => {
      original(...args.map((arg) => redactForLog(arg)));
    };
  });
  globalThis[FLAG] = originals;
}

function resetSecretLogRedactionForTests() {
  const originals = globalThis[FLAG];
  if (!originals) return;
  METHODS.forEach((method) => {
    console[method] = originals[method];
  });
  delete globalThis[FLAG];
}

module.exports = {
  redactSecretsInString,
  redactForLog,
  installSecretLogRedaction,
  resetSecretLogRedactionForTests,
};
