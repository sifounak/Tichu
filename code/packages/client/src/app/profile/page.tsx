// REQ-F-AU03: Game history — viewable in profile
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface PlayerProfile {
  userId: string;
  displayName: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  tichuCalls: number;
  tichuSuccesses: number;
  grandTichuCalls: number;
  grandTichuSuccesses: number;
  totalRoundsPlayed: number;
  firstFinishes: number;
}

interface GameHistoryEntry {
  id: number;
  roomCode: string;
  startedAt: string;
  endedAt: string;
  winnerTeam: string;
  finalScoreNS: number;
  finalScoreEW: number;
  roundCount: number;
  northName: string;
  eastName: string;
  southName: string;
  westName: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [games, setGames] = useState<GameHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check URL query param first, then fall back to storage
    const queryUserId = searchParams.get('userId');
    const storageUserId = typeof window !== 'undefined'
      ? (localStorage.getItem('tichu_user_id') ?? sessionStorage.getItem('tichu_user_id'))
      : null;
    const userId = queryUserId ?? storageUserId;

    if (!userId) {
      router.push('/auth');
      return;
    }

    Promise.all([
      fetch(`${API_BASE}/api/players/${userId}/profile`).then(r => r.json()),
      fetch(`${API_BASE}/api/players/${userId}/games`).then(r => r.json()),
    ]).then(([profileData, gamesData]) => {
      setProfile(profileData.profile);
      setGames(gamesData.games ?? []);
      setLoading(false);
    }).catch((err) => {
      setError('Failed to load profile. Please try again later.');
      setLoading(false);
    });
  }, [router, searchParams]);

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--color-felt-green-dark)' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh p-6" style={{ background: 'var(--color-felt-green-dark)' }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-gold-accent)' }}>
            {profile?.displayName ?? 'Player'} Profile
          </h1>
          <Link href="/lobby" className="text-sm underline" style={{ color: 'var(--color-text-secondary)' }}>
            Back to Lobby
          </Link>
        </div>

        {error && (
          <div className="mb-4 text-center py-2 px-4 rounded-lg"
            style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-error)' }}
            role="alert">
            {error}
          </div>
        )}

        {/* Stats */}
        {profile ? (
          <div className="mb-8 p-4 rounded-xl" style={{ background: 'var(--color-bg-panel)' }}>
            <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Statistics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatCard label="Games Played" value={profile.gamesPlayed} />
              <StatCard label="Games Won" value={profile.gamesWon} />
              <StatCard label="Win Rate" value={`${(profile.winRate * 100).toFixed(1)}%`} />
              <StatCard label="Tichu Success" value={profile.tichuCalls > 0 ? `${((profile.tichuSuccesses / profile.tichuCalls) * 100).toFixed(0)}% (${profile.tichuSuccesses}/${profile.tichuCalls})` : 'N/A'} />
              <StatCard label="Grand Tichu" value={profile.grandTichuCalls > 0 ? `${((profile.grandTichuSuccesses / profile.grandTichuCalls) * 100).toFixed(0)}% (${profile.grandTichuSuccesses}/${profile.grandTichuCalls})` : 'N/A'} />
              <StatCard label="First Finishes" value={profile.firstFinishes} />
            </div>
          </div>
        ) : (
          <div className="mb-8 p-4 rounded-xl text-center" style={{ background: 'var(--color-bg-panel)', color: 'var(--color-text-muted)' }}>
            No stats yet. Play some games!
          </div>
        )}

        {/* Game History */}
        <div className="p-4 rounded-xl" style={{ background: 'var(--color-bg-panel)' }}>
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Game History</h2>
          {games.length === 0 ? (
            <p className="text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No games played yet.</p>
          ) : (
            <div className="space-y-2" role="list" aria-label="Game history">
              {games.map((game) => (
                <div key={game.id} role="listitem" className="p-3 rounded-lg flex items-center justify-between"
                  style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
                  <div>
                    <span className="font-mono text-sm" style={{ color: 'var(--color-gold-accent)' }}>
                      {game.roomCode}
                    </span>
                    <span className="ml-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {new Date(game.endedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      NS {game.finalScoreNS} - EW {game.finalScoreEW}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded font-semibold"
                      style={{ background: 'var(--color-gold-accent)', color: 'var(--color-felt-green-dark)' }}>
                      {game.winnerTeam} won
                    </span>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {game.roundCount} rounds
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
      <div className="text-lg font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>{value}</div>
    </div>
  );
}
