'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE, getUserId, pct, type PlayerProfile } from '@/components/stats/stats-types';
import { StatCard } from '@/components/stats/StatCard';
import { StatSection } from '@/components/stats/StatSection';
import { RecordBanner } from '@/components/stats/RecordBanner';

export default function StatsOverviewPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = getUserId();
    if (!userId) { router.push('/lobby'); return; }

    fetch(`${API_BASE}/api/players/${userId}/profile`)
      .then(r => r.json())
      .then(data => { setProfile(data.profile ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '2rem' }}>Loading stats...</p>;
  }
  if (!profile) {
    return <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '2rem' }}>No stats yet. Play some games!</p>;
  }

  const dogTotal = profile.dogControlToPartner + profile.dogControlToOpponent + profile.dogControlToSelf;
  const dogPartnerPct = dogTotal > 0 ? `${Math.round((profile.dogControlToPartner / dogTotal) * 100)}%` : '-';

  return (
    <div>
      <RecordBanner profile={profile} />

      <StatSection title="Tichu Calls" href="/stats/tichu">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Tichu" value={`${profile.tichuSuccesses} / ${profile.tichuCalls}`} subtitle={pct(profile.tichuSuccesses, profile.tichuCalls) !== '-' ? `${pct(profile.tichuSuccesses, profile.tichuCalls)} success` : undefined} highlight />
          <StatCard label="Grand Tichu" value={`${profile.grandTichuSuccesses} / ${profile.grandTichuCalls}`} subtitle={pct(profile.grandTichuSuccesses, profile.grandTichuCalls) !== '-' ? `${pct(profile.grandTichuSuccesses, profile.grandTichuCalls)} success` : undefined} />
          <StatCard label="Opponent Tichus Broken" value={profile.opponentTichuBroken} />
          <StatCard label="Opponent GTs Broken" value={profile.opponentGrandTichuBroken} />
        </div>
      </StatSection>

      <StatSection title="Round Performance" href="/stats/cards">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="1-2 Finishes" value={profile.oneTwoWins} subtitle={profile.totalRoundsPlayed > 0 ? `${pct(profile.oneTwoWins, profile.totalRoundsPlayed)} of rounds` : undefined} highlight />
          <StatCard label="Finished 1st" value={profile.firstFinishes} subtitle={profile.totalRoundsPlayed > 0 ? `${pct(profile.firstFinishes, profile.totalRoundsPlayed)} of rounds` : undefined} />
          <StatCard label="Best Win Margin" value={profile.largestWinDiff > 0 ? `+${profile.largestWinDiff}` : '-'} valueColor="#4ade80" />
          <StatCard label="Worst Loss" value={profile.largestLossDiff > 0 ? `-${profile.largestLossDiff}` : '-'} valueColor="#f87171" />
        </div>
      </StatSection>

      <StatSection title="Special Cards" href="/stats/cards">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Dragon" value={`${profile.dragonTrickWins} trick wins`} subtitle={`held ${profile.roundsWithDragon} rounds`} coloredLabel />
          <StatCard label="Phoenix" value={profile.longestStraightWithPhoenix > 0 ? `${profile.longestStraightWithPhoenix}-card straight` : '-'} subtitle="longest w/ Phoenix" coloredLabel />
          <StatCard label="Dog" value={dogTotal > 0 ? `${dogPartnerPct} to partner` : '-'} subtitle={dogTotal > 0 ? `${profile.dogControlToPartner} of ${dogTotal} plays` : undefined} coloredLabel />
          <StatCard label="Dog" value={`${profile.dogStuckAsLastCard}x stuck`} subtitle="as last card" coloredLabel />
        </div>
      </StatSection>

      <StatSection title="Bombs" href="/stats/cards">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Bombs Played" value={profile.totalBombs} highlight />
          <StatCard label="4-of-a-Kind" value={profile.fourCardBombs} />
          <StatCard label="Straight Flushes" value={profile.fiveCardBombs + profile.sixPlusCardBombs} />
          <StatCard label="Dealt a Bomb" value={profile.bombsInFirst8} subtitle="in first 8 cards" />
        </div>
      </StatSection>

      <StatSection title="Achievements" href="/stats/cards">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="The Tichu (Clean)" value={profile.theTichuClean} subtitle="13-card straight" coloredLabel highlight />
          <StatCard label="The Tichu (Dirty)" value={profile.theTichuDirty} subtitle="w/ Phoenix" coloredLabel />
          <StatCard label="Double Bomb" value={profile.doubleBombInTrick} subtitle="2+ bombs in one trick" />
          <StatCard label="Stacked Deck" value={profile.allPowerCardsBeforePass} subtitle="6+ power cards pre-pass" coloredLabel />
        </div>
      </StatSection>
    </div>
  );
}
