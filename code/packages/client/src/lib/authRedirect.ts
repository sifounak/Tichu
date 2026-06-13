const DEFAULT_AUTH_SUCCESS_REDIRECT = '/lobby';
const INTERNAL_URL_ORIGIN = 'http://tichu.local';

function getBasePath(): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? '';
  if (!basePath || basePath === '/') return '';
  return basePath.startsWith('/') ? basePath.replace(/\/+$/, '') : `/${basePath.replace(/\/+$/, '')}`;
}

function stripBasePath(pathname: string): string {
  const basePath = getBasePath();
  if (!basePath) return pathname;
  if (pathname === basePath) return '/';
  if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length);
  return pathname;
}

function isKnownAppRoute(pathname: string): boolean {
  if (pathname === '/lobby' || pathname === '/leaderboard' || pathname === '/profile' || pathname === '/stats') {
    return true;
  }

  if (/^\/game\/[^/]+$/.test(pathname) || /^\/spectate\/[^/]+$/.test(pathname)) {
    return true;
  }

  return /^\/stats\/(cards|history|players|tichu)$/.test(pathname);
}

export function normalizeReturnTo(returnTo: string | null | undefined): string | null {
  if (!returnTo) return null;

  const candidate = returnTo.trim();
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
    return null;
  }

  try {
    const url = new URL(candidate, INTERNAL_URL_ORIGIN);
    const pathname = stripBasePath(url.pathname);
    if (url.origin !== INTERNAL_URL_ORIGIN || !isKnownAppRoute(pathname)) {
      return null;
    }
    return `${pathname}${url.search}${url.hash}`;
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
