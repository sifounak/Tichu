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
  // REQ-F-CS03–CS05: Phoenix play type tracking
  phoenixUsedAsSingle: number;
  phoenixUsedForPair: number;
  phoenixUsedInTriple: number;
  phoenixUsedInFullHouse: number;
  phoenixUsedInConsecutivePairs: number;
  phoenixUsedInStraight: number;
  longestStraightWithPhoenix: number;
  // REQ-F-CS06–CS09: Dog control tracking
  dogControlToPartner: number;
  dogControlToOpponent: number;
  dogControlToSelf: number;
  dogStuckAsLastCard: number;
  // REQ-F-CS10–CS12: Per-size bomb tracking
  bombSize4: number;
  bombSize5: number;
  bombSize6: number;
  bombSize7: number;
  bombSize8: number;
  bombSize9: number;
  bombSize10: number;
  bombSize11: number;
  bombSize12: number;
  bombSize13: number;
  bombSize14: number;
  // REQ-F-CS13–CS15: Conflicting bombs
  conflictingBombs: number;
  // REQ-F-CS16–CS18: Over-bomb direction split
  youOverBombed: number;
  youWereOverBombed: number;
  // REQ-F-CS19–CS22: Extended pass tracking
  dragonGivenInPass: number;
  phoenixGivenInPass: number;
  aceGivenInPass: number;
  mahjongGivenInPass: number;
  mahjongReceivedInPass: number;
  dogReceivedFromPartner: number;
  dogReceivedFromOpponent: number;
  bombGivenToPartner: number;
  bombGivenToOpponent: number;
  bombReceivedFromPartner: number;
  bombReceivedFromOpponent: number;
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
    { id: 'cards', label: 'Card / Hand Stats' },
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

// ─── REQ-F-CS01–CS26: Card / Hand Stats Tab ────────────────────────

function CardStatsTab({ profile }: { profile: PlayerProfile }) {
  const pct = (n: number, d: number) => {
    if (d <= 0) return '-';
    const val = (n / d) * 100;
    const fixed1 = val.toFixed(1);
    return fixed1.endsWith('.0') ? `${Math.round(val)}%` : `${fixed1}%`;
  };

  return (
    <div className="space-y-6">
      {/* REQ-F-CS02: Achievements at top */}
      <Section title="Achievements">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="The Tichu (Clean)" value={profile.theTichuClean} />
          <StatCard label="The Tichu (Dirty)" value={profile.theTichuDirty} />
        </div>
      </Section>

      {/* REQ-F-CS26: Dragon section — 3 stats */}
      <Section title="Dragon">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Hands with Dragon" value={profile.roundsWithDragon} />
          <StatCard label="Tricks Won with Dragon" value={profile.dragonTrickWins} />
          <StatCard label="Dragon Win Rate" value={pct(profile.roundsWithDragonWon, profile.roundsWithDragon)} />
        </div>
      </Section>

      {/* REQ-F-CS05: Phoenix section — 10 stats */}
      <Section title="Phoenix">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Hands with Phoenix" value={profile.roundsWithPhoenix} />
          <StatCard label="Tricks Won with Phoenix" value={profile.roundsWithPhoenixWon} />
          <StatCard label="Phoenix Win Rate" value={pct(profile.roundsWithPhoenixWon, profile.roundsWithPhoenix)} />
          <StatCard label="Used as Single Card" value={profile.phoenixUsedAsSingle} />
          <StatCard label="Used for Pair" value={profile.phoenixUsedForPair} />
          <StatCard label="Used in Three-of-a-Kind" value={profile.phoenixUsedInTriple} />
          <StatCard label="Used in Full House" value={profile.phoenixUsedInFullHouse} />
          <StatCard label="Used in Consecutive Pairs" value={profile.phoenixUsedInConsecutivePairs} />
          <StatCard label="Used in Straight" value={profile.phoenixUsedInStraight} />
          <StatCard label="Longest Straight with Phoenix" value={profile.longestStraightWithPhoenix || '-'} />
        </div>
      </Section>

      {/* REQ-F-CS09: Dog section — 5 stats */}
      <Section title="Dog">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Hands with Dog" value={profile.dogReceivedInPass + profile.dogGivenToPartner + profile.dogGivenToOpponent > 0 ? profile.dogControlToPartner + profile.dogControlToOpponent + profile.dogControlToSelf : 0} />
          <StatCard label="Control to Partner" value={profile.dogControlToPartner} />
          <StatCard label="Control to Opponent" value={profile.dogControlToOpponent} />
          <StatCard label="Control to Self" value={profile.dogControlToSelf} />
          <StatCard label="Stuck with Dog as Last Card" value={profile.dogStuckAsLastCard} />
        </div>
      </Section>

      {/* REQ-F-CS25: Bombs section — 8 stats + size table */}
      <Section title="Bombs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Bombs" value={profile.totalBombs} />
          <StatCard label="Hands with Bombs" value={profile.handsWithBombs} />
          <StatCard label="Hands with Multiple Bombs" value={profile.handsWithMultipleBombs} />
          <StatCard label="Conflicting Bombs in Hand" value={profile.conflictingBombs} />
          <StatCard label="Bombs in First 8" value={profile.bombsInFirst8} />
          <StatCard label="You Over-Bombed" value={profile.youOverBombed} />
          <StatCard label="You Were Over-Bombed" value={profile.youWereOverBombed} />
          <StatCard label="Bomb Forced by Wish" value={profile.bombForcedByWish} />
        </div>
        {/* REQ-F-CS12: Bomb Sizes table */}
        <div className="mt-3 overflow-x-auto rounded-lg" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th className="px-2 py-1.5 text-left text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Size</th>
                {[4,5,6,7,8,9,10,11,12,13,14].map(n => (
                  <th key={n} className="px-2 py-1.5 text-center text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{n === 4 ? '4-card' : String(n)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-2 py-1.5 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Count</td>
                {[4,5,6,7,8,9,10,11,12,13,14].map(n => {
                  const key = `bombSize${n}` as keyof PlayerProfile;
                  return <td key={n} className="px-2 py-1.5 text-center font-mono text-sm">{profile[key] as number}</td>;
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* REQ-F-CS22: Pass Tracking table */}
      <Section title="Pass Tracking">
        <div className="overflow-x-auto rounded-lg" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th className="px-2 py-1.5 text-left text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}></th>
                {['Dragon', 'Phoenix', 'Ace', 'Mahjong', 'Dog (Partner)', 'Dog (Opp)', 'Bomb (Partner)', 'Bomb (Opp)'].map(h => (
                  <th key={h} className="px-2 py-1.5 text-center text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td className="px-2 py-1.5 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Gave</td>
                <td className="px-2 py-1.5 text-center font-mono">{profile.dragonGivenInPass}</td>
                <td className="px-2 py-1.5 text-center font-mono">{profile.phoenixGivenInPass}</td>
                <td className="px-2 py-1.5 text-center font-mono">{profile.aceGivenInPass}</td>
                <td className="px-2 py-1.5 text-center font-mono">{profile.mahjongGivenInPass}</td>
                <td className="px-2 py-1.5 text-center font-mono">{profile.dogGivenToPartner}</td>
                <td className="px-2 py-1.5 text-center font-mono">{profile.dogGivenToOpponent}</td>
                <td className="px-2 py-1.5 text-center font-mono">{profile.bombGivenToPartner}</td>
                <td className="px-2 py-1.5 text-center font-mono">{profile.bombGivenToOpponent}</td>
              </tr>
              <tr>
                <td className="px-2 py-1.5 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Received</td>
                <td className="px-2 py-1.5 text-center font-mono">{profile.dragonReceivedInPass}</td>
                <td className="px-2 py-1.5 text-center font-mono">{profile.phoenixReceivedInPass}</td>
                <td className="px-2 py-1.5 text-center font-mono">{profile.aceReceivedInPass}</td>
                <td className="px-2 py-1.5 text-center font-mono">{profile.mahjongReceivedInPass}</td>
                <td className="px-2 py-1.5 text-center font-mono">{profile.dogReceivedFromPartner}</td>
                <td className="px-2 py-1.5 text-center font-mono">{profile.dogReceivedFromOpponent}</td>
                <td className="px-2 py-1.5 text-center font-mono">{profile.bombReceivedFromPartner}</td>
                <td className="px-2 py-1.5 text-center font-mono">{profile.bombReceivedFromOpponent}</td>
              </tr>
            </tbody>
          </table>
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
