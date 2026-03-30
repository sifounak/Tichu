// REQ-F-UI02: Dedicated stats page with 4 tabs
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ─── Types ──────────────────────────────────────────────────────────

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
  largestWinDiff: number;
  largestLossDiff: number;
  gamesForfeited: number;
  gamesSpectated: number;
  oneTwoWins: number;
  oneTwoAgainst: number;
  roundsWon: number;
  opponentTichuBroken: number;
  opponentGrandTichuBroken: number;
  partnerTichuBroken: number;
  partnerGrandTichuBroken: number;
}

interface RelationalStat {
  userId: string;
  displayName: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
}

interface GameHistoryEntry {
  id: number;
  roomCode: string;
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

type Tab = 'overview' | 'cards' | 'relationships' | 'history';

// ─── Page ───────────────────────────────────────────────────────────

export default function StatsPage() {
  return (
    <Suspense fallback={
      <main className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--color-felt-green-dark)' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
      </main>
    }>
      <StatsContent />
    </Suspense>
  );
}

function StatsContent() {
  const router = useRouter();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [partners, setPartners] = useState<RelationalStat[]>([]);
  const [opponents, setOpponents] = useState<RelationalStat[]>([]);
  const [games, setGames] = useState<GameHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  useEffect(() => {
    const userId = typeof window !== 'undefined'
      ? (localStorage.getItem('tichu_user_id') ?? sessionStorage.getItem('tichu_user_id'))
      : null;

    if (!userId) {
      router.push('/lobby');
      return;
    }

    Promise.all([
      fetch(`${API_BASE}/api/players/${userId}/profile`).then(r => r.json()),
      fetch(`${API_BASE}/api/players/${userId}/partners`).then(r => r.json()),
      fetch(`${API_BASE}/api/players/${userId}/opponents`).then(r => r.json()),
      fetch(`${API_BASE}/api/players/${userId}/games`).then(r => r.json()),
    ]).then(([profileData, partnersData, opponentsData, gamesData]) => {
      setProfile(profileData.profile ?? null);
      setPartners(partnersData.partners ?? []);
      setOpponents(opponentsData.opponents ?? []);
      setGames(gamesData.games ?? []);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--color-felt-green-dark)' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading stats...</p>
      </main>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'cards', label: 'Card Stats' },
    { id: 'relationships', label: 'Relationships' },
    { id: 'history', label: 'History' },
  ];

  return (
    <main className="min-h-dvh p-6" style={{ background: 'var(--color-felt-green-dark)' }}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-gold-accent)' }}>
            {profile?.displayName ?? 'Player'} Stats
          </h1>
          <Link href="/lobby" className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'var(--color-gold-accent)', color: 'var(--color-felt-green-dark)' }}>
            Back to Lobby
          </Link>
        </div>

        {!profile ? (
          <div className="p-4 rounded-xl text-center" style={{ background: 'var(--color-bg-panel)', color: 'var(--color-text-muted)' }}>
            No stats yet. Play some games!
          </div>
        ) : (
          <>
            {/* Tab bar */}
            <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: 'var(--color-bg-panel)' }}>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors"
                  style={{
                    background: activeTab === tab.id ? 'var(--color-gold-accent)' : 'transparent',
                    color: activeTab === tab.id ? 'var(--color-felt-green-dark)' : 'var(--color-text-secondary)',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="p-4 rounded-xl" style={{ background: 'var(--color-bg-panel)' }}>
              {activeTab === 'overview' && <OverviewTab profile={profile} />}
              {activeTab === 'cards' && <CardStatsTab profile={profile} />}
              {activeTab === 'relationships' && <RelationshipsTab partners={partners} opponents={opponents} />}
              {activeTab === 'history' && <HistoryTab games={games} />}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

// ─── REQ-F-UI03: Overview Tab ────────────────────────────────────────

function OverviewTab({ profile }: { profile: PlayerProfile }) {
  const pct = (n: number, d: number) => d > 0 ? `${((n / d) * 100).toFixed(1)}%` : 'N/A';
  const ratio = (n: number, d: number) => d > 0 ? `${n}/${d}` : '-';

  return (
    <div className="space-y-6">
      <Section title="Game Record">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Games Played" value={profile.gamesPlayed} />
          <StatCard label="Games Won" value={profile.gamesWon} />
          <StatCard label="Win Rate" value={pct(profile.gamesWon, profile.gamesPlayed)} />
          <StatCard label="Largest Win" value={`+${profile.largestWinDiff}`} />
          <StatCard label="Largest Loss" value={`-${profile.largestLossDiff}`} />
          <StatCard label="Forfeits" value={profile.gamesForfeited} />
        </div>
      </Section>

      <Section title="Round Record">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Rounds Played" value={profile.totalRoundsPlayed} />
          <StatCard label="Rounds Won" value={profile.roundsWon} />
          <StatCard label="Round Win Rate" value={pct(profile.roundsWon, profile.totalRoundsPlayed)} />
          <StatCard label="First Finishes" value={profile.firstFinishes} />
        </div>
      </Section>

      <Section title="Tichu Record">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Tichu Calls" value={ratio(profile.tichuSuccesses, profile.tichuCalls)} />
          <StatCard label="Tichu Rate" value={pct(profile.tichuSuccesses, profile.tichuCalls)} />
          <StatCard label="Grand Tichu" value={ratio(profile.grandTichuSuccesses, profile.grandTichuCalls)} />
          <StatCard label="GT Rate" value={pct(profile.grandTichuSuccesses, profile.grandTichuCalls)} />
          <StatCard label="Opp. Tichu Broken" value={profile.opponentTichuBroken} />
          <StatCard label="Opp. GT Broken" value={profile.opponentGrandTichuBroken} />
        </div>
      </Section>

      <Section title="Special">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="1-2 Wins" value={profile.oneTwoWins} />
          <StatCard label="1-2 Against" value={profile.oneTwoAgainst} />
          <StatCard label="Games Spectated" value={profile.gamesSpectated} />
          <StatCard label="Partner Tichu Broken" value={profile.partnerTichuBroken} />
          <StatCard label="Partner GT Broken" value={profile.partnerGrandTichuBroken} />
        </div>
      </Section>
    </div>
  );
}

// ─── REQ-F-UI04: Card Stats Tab ─────────────────────────────────────

function CardStatsTab({ profile: _profile }: { profile: PlayerProfile }) {
  // Card stats come from Group C columns — fetched via profile endpoint
  // TODO: Display Group C stats from profile when card stat columns are added to API
  return (
    <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
      <p>Card statistics are tracked during gameplay.</p>
      <p className="mt-2 text-sm">Dragon, Phoenix, Dog, Ace, and Bomb stats will appear here as you play.</p>
    </div>
  );
}

// ─── REQ-F-UI05: Relationships Tab ──────────────────────────────────

function RelationshipsTab({ partners, opponents }: { partners: RelationalStat[]; opponents: RelationalStat[] }) {
  return (
    <div className="space-y-6">
      <Section title="Partners">
        {partners.length === 0 ? (
          <p className="text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No partner data yet.</p>
        ) : (
          <RelationTable entries={partners} />
        )}
      </Section>

      <Section title="Opponents">
        {opponents.length === 0 ? (
          <p className="text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No opponent data yet.</p>
        ) : (
          <RelationTable entries={opponents} />
        )}
      </Section>
    </div>
  );
}

function RelationTable({ entries }: { entries: RelationalStat[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ color: 'var(--color-text-muted)' }}>
          <th className="text-left py-2">Player</th>
          <th className="text-right py-2">Games</th>
          <th className="text-right py-2">Wins</th>
          <th className="text-right py-2">Win Rate</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.userId} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <td className="py-2" style={{ color: 'var(--color-text-primary)' }}>{entry.displayName}</td>
            <td className="text-right py-2" style={{ color: 'var(--color-text-secondary)' }}>{entry.gamesPlayed}</td>
            <td className="text-right py-2" style={{ color: 'var(--color-text-secondary)' }}>{entry.gamesWon}</td>
            <td className="text-right py-2" style={{ color: 'var(--color-gold-accent)' }}>
              {(entry.winRate * 100).toFixed(1)}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── REQ-F-UI06: History Tab ────────────────────────────────────────

function HistoryTab({ games }: { games: GameHistoryEntry[] }) {
  if (games.length === 0) {
    return <p className="text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No games played yet.</p>;
  }

  return (
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
              {game.roundCount} rds
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Shared Components ──────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-gold-accent)' }}>{title}</h3>
      {children}
    </div>
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
