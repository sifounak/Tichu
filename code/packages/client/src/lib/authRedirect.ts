const DEFAULT_AUTH_SUCCESS_REDIRECT = '/lobby';
const INTERNAL_URL_ORIGIN = 'http://tichu.local';

export function normalizeReturnTo(returnTo: string | null | undefined): string | null {
  if (!returnTo) return null;

  const candidate = returnTo.trim();
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
    return null;
  }

  try {
    const url = new URL(candidate, INTERNAL_URL_ORIGIN);
    if (url.origin !== INTERNAL_URL_ORIGIN || url.pathname === '/') {
      return null;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function buildLoginRedirectUrl(destination: string): string {
  const returnTo = normalizeReturnTo(destination);
  if (!returnTo) return '/';
  return `/?returnTo=${encodeURIComponent(returnTo)}`;
}

export function getAuthSuccessRedirect(search: string | URLSearchParams): string {
  const params = typeof search === 'string'
    ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    : search;

  return normalizeReturnTo(params.get('returnTo')) ?? DEFAULT_AUTH_SUCCESS_REDIRECT;
}
