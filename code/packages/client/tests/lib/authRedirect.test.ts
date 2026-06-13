import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildLoginRedirectUrl, getAuthSuccessRedirect, normalizeReturnTo } from '@/lib/authRedirect';

describe('authRedirect', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('preserves internal destinations with query strings and hashes', () => {
    expect(normalizeReturnTo('/game/ABC123?seat=north#table')).toBe('/game/ABC123?seat=north#table');
    expect(buildLoginRedirectUrl('/game/ABC123?seat=north')).toBe('/?returnTo=%2Fgame%2FABC123%3Fseat%3Dnorth');
  });

  it('rejects unsafe or looping destinations', () => {
    expect(normalizeReturnTo('https://example.com/game/ABC123')).toBeNull();
    expect(normalizeReturnTo('//example.com/game/ABC123')).toBeNull();
    expect(normalizeReturnTo('/\\example.com')).toBeNull();
    expect(normalizeReturnTo('/')).toBeNull();
  });

  it('rejects paths that are not app routes', () => {
    expect(normalizeReturnTo('/does-not-exist')).toBeNull();
    expect(normalizeReturnTo('/lobby/lobby')).toBeNull();
    expect(normalizeReturnTo('/lobby/game/QPJTDH')).toBeNull();
  });

  it('stores base-path browser URLs as app-relative destinations', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/tichu');

    expect(normalizeReturnTo('/tichu/lobby')).toBe('/lobby');
    expect(normalizeReturnTo('/tichu/game/QPJTDH')).toBe('/game/QPJTDH');
    expect(buildLoginRedirectUrl('/tichu/game/QPJTDH')).toBe('/?returnTo=%2Fgame%2FQPJTDH');
  });

  it('round-trips production game URLs through auth without duplicating the base path', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/tichu');

    const loginUrl = buildLoginRedirectUrl('/tichu/game/QPJTDH');
    expect(loginUrl).toBe('/?returnTo=%2Fgame%2FQPJTDH');
    expect(getAuthSuccessRedirect(loginUrl.split('?')[1])).toBe('/game/QPJTDH');
  });

  it('uses returnTo after successful auth when it is safe', () => {
    expect(getAuthSuccessRedirect('?returnTo=%2Fstats%2Fhistory%3Fpage%3D2')).toBe('/stats/history?page=2');
  });

  it('falls back to lobby after successful auth without a safe returnTo', () => {
    expect(getAuthSuccessRedirect('')).toBe('/lobby');
    expect(getAuthSuccessRedirect('?returnTo=https%3A%2F%2Fexample.com')).toBe('/lobby');
    expect(getAuthSuccessRedirect('?returnTo=%2F')).toBe('/lobby');
  });
});
