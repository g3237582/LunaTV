const JS_TAG = /<(?!js\b|\/js)([^<>]+)>/gi;
const EXPR_ONLY = /^\{\{[\s\S]*\}\}$/;

export function applyLegadoPageRule(raw: string, page = 1): string {
  return String(raw || '').replace(JS_TAG, (full, inner: string) => {
    const text = String(inner);
    const comma = text.indexOf(',');
    if (comma < 0) return full;
    const first = text.slice(0, comma);
    const rest = text.slice(comma + 1).trim();
    if (EXPR_ONLY.test(rest)) return full;
    return page <= 1 ? first : rest;
  });
}
