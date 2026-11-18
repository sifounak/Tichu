// Verifies: REQ-F-PS01/PS03/PS07 through visible pages and filtered requests.
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import CardStatsPage from '@/app/stats/cards/page';
import TichuCallsPage from '@/app/stats/tichu/page';
import StatsOverviewPage from '@/app/stats/page';
import LeaderboardPage from '@/app/leaderboard/page';
import ProfilePage from '@/app/profile/page';
import GameHistoryPage from '@/app/stats/history/page';
import PlayersPage from '@/app/stats/players/page';
import StatsLayout from '@/app/stats/layout';

const navigation = vi.hoisted(() => ({ search: '', router: { replace: vi.fn(), push: vi.fn() } }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => navigation.router, usePathname: () => '/stats' }));
vi.mock('@/components/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => children }));

const profile = new Proxy({ userId: 'a', displayName: 'Alice', gamesPlayed: 2, gamesWon: 1, winRate: 0.5,
  longestStraight: 9, longestStraightWithPhoenix: 7, phoenixUsedAsSingle: 3, phoenixUsedForPair: 2,
  totalBombsReceived: 4, opponentTichuBroken: 2, opponentGrandTichuBroken: 3, opponentBlindGrandTichuBroken: 4,
} as Record<string, unknown>, { get: (target, key: string) => target[key] ?? 0 });

describe('Statistics pages', () => {
  beforeEach(() => {
    navigation.search = ''; localStorage.setItem('tichu_user_id', 'a');
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => ({ ok: true, json: async () => ({
      profile, games: [], relationships: [], leaderboard: [{ userId: 'a', displayName: 'Alice', gamesPlayed: 2, winRate: 0.5 }],
      metadata: { participation: new URL(url).searchParams.get('participation'), totalGames: 2, inferredGames: 1 },
    }) })));
  });
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

  it('renders Phoenix usage, both longest straights, total received bombs and contribution explanation', async () => {
    render(<CardStatsPage />);
    await screen.findByText('Phoenix Usage by Type');
    expect(screen.getByText('As Single').parentElement).toHaveTextContent('3');
    expect(screen.getByText('In Pair').parentElement).toHaveTextContent('2');
    expect(screen.getByText('9 cards')).toBeInTheDocument();
    expect(screen.getByText('7 cards')).toBeInTheDocument();
    expect(screen.getByText('Total Bombs Received')).toBeInTheDocument();
    expect(screen.getByText(/Bomb directions credit each contributor/)).toBeInTheDocument();
    expect(screen.getByText(/1 older game is inferred/)).toBeInTheDocument();
  });

  it('includes Blind Grand broken calls in the all-call total and separate rows', async () => {
    render(<TichuCallsPage />);
    await screen.findByText('Opponent Calls Broken');
    expect(screen.getByText('Opponent Calls Broken').parentElement).toHaveTextContent('9');
    expect(screen.getByText('Opponent Blind Grands Broken')).toBeInTheDocument();
    expect(screen.getByText('Your Blind Grand Broken by Partner')).toBeInTheDocument();
  });

  it.each([
    [StatsOverviewPage, 'profile'], [CardStatsPage, 'profile'], [TichuCallsPage, 'profile'],
    [GameHistoryPage, 'games'], [PlayersPage, 'relationships'],
  ])('requests the URL view on each statistics tab', async (Page, resource) => {
    navigation.search = 'participation=mixed';
    render(<Page />);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/api/players/a/${resource}?participation=mixed`), expect.anything()));
  });

  it('defaults leaderboard to human-only and keeps that view on player profile links', async () => {
    render(<LeaderboardPage />);
    await screen.findByText('Alice');
    expect(screen.getByLabelText('Games included')).toHaveValue('human-only');
    expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/profile?userId=a&participation=human-only');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/leaderboard?participation=human-only'), expect.anything());
  });

  it('requests the same player and view for profile statistics and history', async () => {
    navigation.search = 'userId=other&participation=solo';
    render(<ProfilePage />);
    await screen.findByText('Alice Profile');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/players/other/profile?participation=solo'), expect.anything());
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/players/other/games?participation=solo'), expect.anything());
  });

  it('keeps the selector available when the selected view has no records', async () => {
    navigation.search = 'participation=solo';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ profile: null,
      metadata: { participation: 'solo', totalGames: 0, inferredGames: 0 } }) }));
    render(<StatsLayout><CardStatsPage /></StatsLayout>);
    await screen.findByText('No statistics in this view.');
    expect(screen.getByLabelText('Games included')).toHaveValue('solo');
  });

  it('shows a request failure instead of presenting it as missing statistics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<CardStatsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load statistics');
  });

  it('uses the recorded seat and forfeit semantics for a replaced history participant', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ games: [{
      id: 1, endedAt: '2026-11-18T00:00:00Z', roomCode: 'TEST', roundCount: 3,
      playerSeat: 'north', northUserId: 'replacement', southUserId: 'partner', eastUserId: 'opponent1', westUserId: 'opponent2',
      northName: 'Replacement', southName: 'Partner', eastName: 'Left', westName: 'Right',
      winnerTeam: 'NS', finalScoreNS: 1000, finalScoreEW: 500,
    }] }) }));
    render(<GameHistoryPage />);
    await screen.findByText('FORFEIT');
    expect(screen.getByText('You & Partner vs Left & Right')).toBeInTheDocument();
    expect(screen.queryByText('WIN')).not.toBeInTheDocument();
  });
});
