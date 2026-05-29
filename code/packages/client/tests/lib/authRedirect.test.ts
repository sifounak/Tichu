import { describe, expect, it } from 'vitest';
import { buildLoginRedirectUrl, getAuthSuccessRedirect, normalizeReturnTo } from '@/lib/authRedirect';

describe('authRedirect', () => {
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

  it('uses returnTo after successful auth when it is safe', () => {
    expect(getAuthSuccessRedirect('?returnTo=%2Fstats%2Fhistory%3Fpage%3D2')).toBe('/stats/history?page=2');
  });

  it('falls back to lobby after successful auth without a safe returnTo', () => {
    expect(getAuthSuccessRedirect('')).toBe('/lobby');
    expect(getAuthSuccessRedirect('?returnTo=https%3A%2F%2Fexample.com')).toBe('/lobby');
    expect(getAuthSuccessRedirect('?returnTo=%2F')).toBe('/lobby');
  });
});
