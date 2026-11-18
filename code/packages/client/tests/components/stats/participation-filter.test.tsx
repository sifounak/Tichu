// Verifies: REQ-F-PS07. Defaults, navigation, request cancellation and provenance.
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ParticipationSelector, ParticipationNotice, useStatsData, usePlayerStats, withParticipation } from '@/components/stats/participation-filter';
import { StatsTabNav } from '@/components/stats/StatsTabNav';
import { StatSection } from '@/components/stats/StatSection';

const navigation = vi.hoisted(() => ({ search: '', pathname: '/stats', router: { replace: vi.fn(), push: vi.fn() } }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(navigation.search),
  usePathname: () => navigation.pathname, useRouter: () => navigation.router,
}));

describe('Participation filter', () => {
  beforeEach(() => { navigation.search = ''; navigation.pathname = '/stats'; vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); });
  afterEach(() => vi.unstubAllGlobals());

  it('defaults personal stats to all and permits a human-only leaderboard default', () => {
    const { rerender } = render(<ParticipationSelector />);
    expect(screen.getByLabelText('Games included')).toHaveValue('all');
    rerender(<ParticipationSelector defaultView="human-only" />);
    expect(screen.getByLabelText('Games included')).toHaveValue('human-only');
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });

  it('updates the URL while preserving the viewed player and scroll position', () => {
    navigation.pathname = '/profile'; navigation.search = 'userId=abc&participation=human-only';
    render(<ParticipationSelector />);
    fireEvent.change(screen.getByLabelText('Games included'), { target: { value: 'solo' } });
    expect(navigation.router.replace).toHaveBeenCalledWith('/profile?userId=abc&participation=solo', { scroll: false });
  });

  it('preserves filters in every stats tab and section shortcut', () => {
    navigation.search = 'participation=mixed';
    render(<><StatsTabNav /><StatSection title="Cards" href="/stats/cards">Content</StatSection></>);
    for (const link of screen.getAllByRole('link')) expect(link.getAttribute('href')).toContain('participation=mixed');
    expect(withParticipation('/profile?userId=abc&participation=all', 'solo')).toBe('/profile?userId=abc&participation=solo');
  });

  it('shows historical inference and distinguishes an empty selected dataset', () => {
    const { rerender } = render(<ParticipationNotice metadata={{ participation: 'all', totalGames: 3, inferredGames: 2 }} />);
    expect(screen.getByText(/2 older games is inferred/)).toBeInTheDocument();
    rerender(<ParticipationNotice metadata={{ participation: 'solo', totalGames: 0, inferredGames: 0 }} />);
    expect(screen.getByText('No games match this view.')).toBeInTheDocument();
    rerender(<ParticipationNotice />);
    expect(screen.queryByText('No games match this view.')).not.toBeInTheDocument();
  });

  it('ignores a slower old response after the user changes the filter', async () => {
    const pending: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn((_url: string, _options: RequestInit) => new Promise<Response>(resolve => pending.push(resolve)));
    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = renderHook(() => useStatsData<{ count: number }>('/api/players/a/profile'));
    await waitFor(() => expect(pending).toHaveLength(1));
    const oldSignal = fetchMock.mock.calls[0][1].signal;
    navigation.search = 'participation=solo'; rerender();
    expect(result.current.loading).toBe(true);
    expect(oldSignal?.aborted).toBe(true);
    await waitFor(() => expect(pending).toHaveLength(2));
    await act(async () => pending[1]({ ok: true, json: async () => ({ count: 2 }) } as Response));
    expect(result.current.data).toEqual({ count: 2 });
    await act(async () => pending[0]({ ok: true, json: async () => ({ count: 99 }) } as Response));
    expect(result.current.data).toEqual({ count: 2 });
    expect(fetchMock.mock.calls[1][0]).toContain('participation=solo');
  });

  it('reports HTTP failures and network errors without showing stale data', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false }).mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = renderHook(() => useStatsData<{ count: number }>('/api/leaderboard', 'human-only'));
    await waitFor(() => expect(result.current.error).toContain('Unable to load'));
    expect(result.current.data).toBeNull();
    navigation.search = 'participation=all'; rerender();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toContain('Unable to load');
  });

  it('uses storage identity, supports an explicit viewed player, and redirects only when neither exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ profile: null }) }));
    const empty = renderHook(() => usePlayerStats<{ profile: null }>('profile'));
    await waitFor(() => expect(navigation.router.push).toHaveBeenCalledWith('/lobby'));
    empty.unmount();
    navigation.router.push.mockClear();
    localStorage.setItem('tichu_user_id', 'stored');
    const stored = renderHook(() => usePlayerStats<{ profile: null }>('profile'));
    await waitFor(() => expect(stored.result.current.userId).toBe('stored'));
    stored.unmount();
    localStorage.clear();
    const viewed = renderHook(() => usePlayerStats<{ profile: null }>('profile', 'viewed'));
    await waitFor(() => expect(viewed.result.current.loading).toBe(false));
    expect(viewed.result.current.userId).toBe('viewed');
    expect(navigation.router.push).not.toHaveBeenCalled();
  });
});
