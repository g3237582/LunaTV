const LITERAL_URL_RE = /^(?:https?:)?\/\/[^\s]+$/i;
const DATA_URI_RE = /^data:(?:image|application)\//i;

export function asLiteralLegadoValue(rule?: string): string | undefined {
  const trimmed = (rule || '').trim();
  if (!trimmed || trimmed.includes('{{')) return undefined;
  if (DATA_URI_RE.test(trimmed)) return trimmed;
  if (!LITERAL_URL_RE.test(trimmed)) return undefined;
  return trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
}
