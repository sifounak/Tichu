// REQ-F-AU04: Leaderboard — top players by win rate
'use client';

import { Suspense } from 'react';
import type { ParticipationMetadata } from '@tichu/shared';
import { useStatsData, ParticipationSelector, ParticipationNotice, withParticipation } from '@/components/stats/participation-filter';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';


interface LeaderboardEntry {
  userId: string;
  displayName: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  tichuSuccessRate: number;
  blindGrandTichuSuccessRate: number;
  grandTichuSuccessRate: number;
}

function formatRate(rate: number | null | undefined): string {
  if (rate == null || isNaN(rate)) return 'N/A';
  return `${(rate * 100).toFixed(0)}%`;
}

export default function LeaderboardPage() {
  return <AuthGuard><Suspense fallback={<p>Loading leaderboard...</p>}><LeaderboardContent /></Suspense></AuthGuard>;
}

function LeaderboardContent() {
  const { data, loading, error, metadata, participation } = useStatsData<{ leaderboard: LeaderboardEntry[]; metadata?: ParticipationMetadata }>('/api/leaderboard', 'human-only');
  const entries = data?.leaderboard ?? [];

  return (
    <AuthGuard>
      <main className="min-h-dvh p-6" style={{ background: 'var(--color-felt-green-dark)' }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-gold-accent)' }}>Leaderboard</h1>
          <Link href="/lobby" className="text-sm underline" style={{ color: 'var(--color-text-secondary)' }}>
            Back to Lobby
          </Link>
        </div>

        <ParticipationSelector defaultView="human-only" />
        <ParticipationNotice metadata={metadata} />

        {error && (
          <div className="mb-4 text-center py-2 px-4 rounded-lg"
            style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-error)' }}
            role="alert">
            {error}
          </div>
        )}

        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-bg-panel)' }}>
          {loading ? (
            <p className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
          ) : entries.length === 0 && !error ? (
            <p className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
              No players yet. Minimum 5 games in this view required to appear on the leaderboard.
            </p>
          ) : (
            <table className="w-full" aria-label="Player leaderboard">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>#</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Player</th>
                  <th className="text-center px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Games</th>
                  <th className="text-center px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Win Rate</th>
                  <th className="text-center px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tichu %</th>
                  <th className="text-center px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>BG %</th>
                  <th className="text-center px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Grand %</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <tr key={entry.userId}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td className="px-4 py-3 font-bold" style={{ color: i < 3 ? 'var(--color-gold-accent)' : 'var(--color-text-muted)' }}>
                      {i + 1}
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      <Link href={withParticipation(`/profile?userId=${encodeURIComponent(entry.userId)}`, participation)} className="hover:underline">
                        {entry.displayName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center" style={{ color: 'var(--color-text-secondary)' }}>
                      {entry.gamesPlayed}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      {(entry.winRate * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-center" style={{ color: 'var(--color-text-secondary)' }}>
                      {formatRate(entry.tichuSuccessRate)}
                    </td>
                    <td className="px-4 py-3 text-center" style={{ color: 'var(--color-text-secondary)' }}>
                      {formatRate(entry.blindGrandTichuSuccessRate)}
                    </td>
                    <td className="px-4 py-3 text-center" style={{ color: 'var(--color-text-secondary)' }}>
                      {formatRate(entry.grandTichuSuccessRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
    </AuthGuard>
  );
}
