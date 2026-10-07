const PLACEHOLDER_ORIGIN = 'https://innowiut.invalid';

function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Returns a safe in-app path from a `returnTo` query value, or null.
 * Only same-origin paths inside `areaPrefix` (e.g. "/founder") are accepted, so a
 * crafted link cannot send users to another site or across role areas.
 */
export function sanitizeReturnTo(
  value: string | null | undefined,
  areaPrefix: string,
): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\\') || hasControlCharacters(value)) return null;

  let url: URL;
  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return null;

  const inArea = url.pathname === areaPrefix || url.pathname.startsWith(`${areaPrefix}/`);
  if (!inArea) return null;

  return `${url.pathname}${url.search}${url.hash}`;
}

export function withReturnTo(loginPath: string, returnTo: string): string {
  return `${loginPath}?returnTo=${encodeURIComponent(returnTo)}`;
}
