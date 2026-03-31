// REQ-F-UI02: Dedicated stats page with 4 tabs
// REQ-F-SO21–SO29: Stats page overhaul
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
  // REQ-F-SO18: New stats
  lastFinishes: number;
  tichuBrokenByPartner: number;
  grandTichuBrokenByPartner: number;
  gamesRequiringTieBreak: number;
  mostTieBreakRoundsNeeded: number;
  gamesJoinedAfterSpectating: number;
  // REQ-F-SO17: Group C card event stats
  roundsWithDragon: number;
  roundsWithDragonWon: number;
  roundsWithPhoenix: number;
  roundsWithPhoenixWon: number;
  dragonReceivedInPass: number;
  phoenixReceivedInPass: number;
  aceReceivedInPass: number;
  dogReceivedInPass: number;
  dragonTrickWins: number;
  dragonGivenAfterOpponentWin: number;
  dogGivenToPartner: number;
  dogGivenToOpponent: number;
  dogPlayedForTichuPartner: number;
  dogOpportunitiesForTichuPartner: number;
  handsWithBombs: number;
  totalBombs: number;
  fourCardBombs: number;
  fiveCardBombs: number;
  sixPlusCardBombs: number;
  bombsInFirst8: number;
  handsWithMultipleBombs: number;
  overBombed: number;
  bombForcedByWish: number;
  theTichuClean: number;
  theTichuDirty: number;
}

interface RelationalStat {
  userId: string;
  displayName: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
}

// REQ-F-SO19: Game history with userId columns
interface GameHistoryEntry {
  id: number;
  roomCode: string;
  endedAt: string;
  winnerTeam: string;
  finalScoreNS: number;
  finalScoreEW: number;
  roundCount: number;
  northUserId: string | null;
  eastUserId: string | null;
  southUserId: string | null;
  westUserId: string | null;
  northName: string;
  eastName: string;
  southName: string;
  westName: string;
  // REQ-F-SO20: Tichu summaries (computed server-side or client-side from rounds)
  tichuSummary?: {
    teamTichuSuccess: number;
    teamTichuTotal: number;
    teamGTSuccess: number;
    teamGTTotal: number;
  };
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
      <div className="max-w-4xl mx-auto">
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

// ─── REQ-F-SO21–SO26: Overview Tab ─────────────────────────────────

function OverviewTab({ profile }: { profile: PlayerProfile }) {
  // REQ-F-SO22: Display "-" for missing values
  const pct = (n: number, d: number) => {
    if (d <= 0) return '-';
    const val = (n / d) * 100;
    const fixed1 = val.toFixed(1);
    // Drop trailing .0 but keep meaningful decimals (e.g. 0.05%, 33.3%)
    return fixed1.endsWith('.0') ? `${Math.round(val)}%` : `${fixed1}%`;
  };

  return (
    <div className="space-y-6">
      {/* REQ-F-SO23: Game Record (11 stats) */}
      <Section title="Game Record">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Games Played" value={profile.gamesPlayed} />
          <StatCard label="Games Won" value={profile.gamesWon} />
          <StatCard label="Games Lost" value={profile.gamesPlayed - profile.gamesWon} />
          <StatCard label="Win Rate" value={pct(profile.gamesWon, profile.gamesPlayed)} />
          <StatCard label="Largest Win" value={profile.largestWinDiff > 0 ? `+${profile.largestWinDiff}` : '-'} />
          <StatCard label="Largest Loss" value={profile.largestLossDiff > 0 ? `-${profile.largestLossDiff}` : '-'} />
          <StatCard label="Games Requiring Tie Break" value={profile.gamesRequiringTieBreak} />
          <StatCard label="Most Tie Break Rounds" value={profile.mostTieBreakRoundsNeeded || '-'} />
          <StatCard label="Games Forfeited" value={profile.gamesForfeited} />
          <StatCard label="Games Spectated" value={profile.gamesSpectated} />
          <StatCard label="Games Joined After Spectating" value={profile.gamesJoinedAfterSpectating} />
        </div>
      </Section>

      {/* REQ-F-SO24: Round Record (12 stats) */}
      <Section title="Round Record">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Rounds Played" value={profile.totalRoundsPlayed} />
          <StatCard label="Rounds Won" value={profile.roundsWon} />
          <StatCard label="Rounds Lost" value={profile.totalRoundsPlayed - profile.roundsWon} />
          <StatCard label="Win Rate" value={pct(profile.roundsWon, profile.totalRoundsPlayed)} />
          <StatCard label="Finished 1st" value={profile.firstFinishes} />
          <StatCard label="Finished Last" value={profile.lastFinishes} />
          <StatCard label="Finished 1st Rate" value={pct(profile.firstFinishes, profile.totalRoundsPlayed)} />
          <StatCard label="Finished Last Rate" value={pct(profile.lastFinishes, profile.totalRoundsPlayed)} />
          <StatCard label="Finished 1-2" value={profile.oneTwoWins} />
          <StatCard label="Beaten by 1-2" value={profile.oneTwoAgainst} />
          <StatCard label="1-2 Rate" value={pct(profile.oneTwoWins, profile.totalRoundsPlayed)} />
          <StatCard label="Beaten by 1-2 Rate" value={pct(profile.oneTwoAgainst, profile.totalRoundsPlayed)} />
        </div>
      </Section>

      {/* REQ-F-SO25: Tichu Record (14 stats) */}
      <Section title="Tichu Record">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Tichu Calls" value={profile.tichuCalls} />
          <StatCard label="Tichu Wins" value={profile.tichuSuccesses} />
          <StatCard label="Tichu Breaks" value={profile.tichuCalls - profile.tichuSuccesses} />
          <StatCard label="Tichu Success Rate" value={pct(profile.tichuSuccesses, profile.tichuCalls)} />
          <StatCard label="Grand Tichu Calls" value={profile.grandTichuCalls} />
          <StatCard label="Grand Tichu Wins" value={profile.grandTichuSuccesses} />
          <StatCard label="Grand Tichu Breaks" value={profile.grandTichuCalls - profile.grandTichuSuccesses} />
          <StatCard label="Grand Tichu Success Rate" value={pct(profile.grandTichuSuccesses, profile.grandTichuCalls)} />
          <StatCard label="Tichu Calls Broken by Partner" value={profile.tichuBrokenByPartner} />
          <StatCard label="GT Calls Broken by Partner" value={profile.grandTichuBrokenByPartner} />
          <StatCard label="Partner Tichu Calls You Broke" value={profile.partnerTichuBroken} />
          <StatCard label="Partner GT Calls You Broke" value={profile.partnerGrandTichuBroken} />
          <StatCard label="Opp. Tichu Calls Broken" value={profile.opponentTichuBroken} />
          <StatCard label="Opp. GT Calls Broken" value={profile.opponentGrandTichuBroken} />
        </div>
      </Section>
    </div>
  );
}

// ─── REQ-F-SO27: Card Stats Tab ────────────────────────────────────

function CardStatsTab({ profile }: { profile: PlayerProfile }) {
  const pct = (n: number, d: number) => {
    if (d <= 0) return '-';
    const val = (n / d) * 100;
    const fixed1 = val.toFixed(1);
    return fixed1.endsWith('.0') ? `${Math.round(val)}%` : `${fixed1}%`;
  };

  return (
    <div className="space-y-6">
      <Section title="Dragon">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Rounds with Dragon" value={profile.roundsWithDragon} />
          <StatCard label="Rounds Won with Dragon" value={profile.roundsWithDragonWon} />
          <StatCard label="Dragon Win Rate" value={pct(profile.roundsWithDragonWon, profile.roundsWithDragon)} />
          <StatCard label="Dragon Trick Wins" value={profile.dragonTrickWins} />
          <StatCard label="Dragon Received in Pass" value={profile.dragonReceivedInPass} />
          <StatCard label="Dragon Given After Opp. Win" value={profile.dragonGivenAfterOpponentWin} />
        </div>
      </Section>

      <Section title="Phoenix">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Rounds with Phoenix" value={profile.roundsWithPhoenix} />
          <StatCard label="Rounds Won with Phoenix" value={profile.roundsWithPhoenixWon} />
          <StatCard label="Phoenix Win Rate" value={pct(profile.roundsWithPhoenixWon, profile.roundsWithPhoenix)} />
          <StatCard label="Phoenix Received in Pass" value={profile.phoenixReceivedInPass} />
        </div>
      </Section>

      <Section title="Dog">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Dog Received in Pass" value={profile.dogReceivedInPass} />
          <StatCard label="Dog Given to Partner" value={profile.dogGivenToPartner} />
          <StatCard label="Dog Given to Opponent" value={profile.dogGivenToOpponent} />
          <StatCard label="Dog Played for Tichu Partner" value={profile.dogPlayedForTichuPartner} />
          <StatCard label="Dog Opportunities for Tichu Partner" value={profile.dogOpportunitiesForTichuPartner} />
        </div>
      </Section>

      <Section title="Bombs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Hands with Bombs" value={profile.handsWithBombs} />
          <StatCard label="Total Bombs" value={profile.totalBombs} />
          <StatCard label="4-Card Bombs" value={profile.fourCardBombs} />
          <StatCard label="5-Card Bombs" value={profile.fiveCardBombs} />
          <StatCard label="6+ Card Bombs" value={profile.sixPlusCardBombs} />
          <StatCard label="Bombs in First 8" value={profile.bombsInFirst8} />
          <StatCard label="Hands with Multiple Bombs" value={profile.handsWithMultipleBombs} />
          <StatCard label="Over-Bombed" value={profile.overBombed} />
          <StatCard label="Bomb Forced by Wish" value={profile.bombForcedByWish} />
        </div>
      </Section>

      <Section title="Pass Tracking">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Ace Received in Pass" value={profile.aceReceivedInPass} />
          <StatCard label="Dragon Received in Pass" value={profile.dragonReceivedInPass} />
          <StatCard label="Phoenix Received in Pass" value={profile.phoenixReceivedInPass} />
          <StatCard label="Dog Received in Pass" value={profile.dogReceivedInPass} />
        </div>
      </Section>

      <Section title="Achievements">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="The Tichu (Clean)" value={profile.theTichuClean} />
          <StatCard label="The Tichu (Dirty)" value={profile.theTichuDirty} />
        </div>
      </Section>
    </div>
  );
}

// ─── REQ-F-UI05: Relationships Tab ─────────────────────────────────

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

// ─── REQ-F-SO28–SO29: History Tab ──────────────────────────────────

function HistoryTab({ games }: { games: GameHistoryEntry[] }) {
  if (games.length === 0) {
    return <p className="text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No games played yet.</p>;
  }

  const userId = typeof window !== 'undefined'
    ? (localStorage.getItem('tichu_user_id') ?? sessionStorage.getItem('tichu_user_id'))
    : null;

  return (
    <div className="overflow-x-auto" role="list" aria-label="Game history">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ color: 'var(--color-text-muted)' }}>
            <th className="text-left py-2 px-1">Date</th>
            <th className="text-center py-2 px-1">Result</th>
            <th className="text-right py-2 px-1">Your Score</th>
            <th className="text-right py-2 px-1">Opp Score</th>
            <th className="text-right py-2 px-1">Rounds</th>
            <th className="text-left py-2 px-1">Partner</th>
            <th className="text-left py-2 px-1">Opponents</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game) => {
            // REQ-F-SO29: Determine player's team
            const isNS = game.northUserId === userId || game.southUserId === userId;
            const won = (isNS && game.winnerTeam === 'NS') || (!isNS && game.winnerTeam === 'EW');
            const myScore = isNS ? game.finalScoreNS : game.finalScoreEW;
            const oppScore = isNS ? game.finalScoreEW : game.finalScoreNS;

            // Derive partner and opponent names
            let partnerName: string;
            let opponentNames: string;
            if (isNS) {
              partnerName = game.northUserId === userId ? game.southName : game.northName;
              opponentNames = `${game.eastName}, ${game.westName}`;
            } else {
              partnerName = game.eastUserId === userId ? game.westName : game.eastName;
              opponentNames = `${game.northName}, ${game.southName}`;
            }

            return (
              <tr key={game.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <td className="py-2 px-1" style={{ color: 'var(--color-text-secondary)' }}>
                  {new Date(game.endedAt).toLocaleDateString()}
                </td>
                <td className="py-2 px-1 text-center">
                  <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{
                    background: won ? '#22c55e' : '#ef4444',
                    color: 'white',
                  }}>
                    {won ? 'Win' : 'Loss'}
                  </span>
                </td>
                <td className="text-right py-2 px-1" style={{ color: 'var(--color-text-primary)' }}>{myScore}</td>
                <td className="text-right py-2 px-1" style={{ color: 'var(--color-text-secondary)' }}>{oppScore}</td>
                <td className="text-right py-2 px-1" style={{ color: 'var(--color-text-muted)' }}>{game.roundCount}</td>
                <td className="py-2 px-1" style={{ color: 'var(--color-text-secondary)' }}>{partnerName}</td>
                <td className="py-2 px-1" style={{ color: 'var(--color-text-secondary)' }}>{opponentNames}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
