// code/packages/client/src/app/stats/cards/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE, getUserId, type PlayerProfile } from '@/components/stats/stats-types';
import { StatCard } from '@/components/stats/StatCard';
import { StatSection } from '@/components/stats/StatSection';
import { CompactTable } from '@/components/stats/CompactTable';
import { TablePanel } from '@/components/stats/TablePanel';

export default function CardStatsPage() {
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

  if (loading) return <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '2rem' }}>Loading...</p>;
  if (!profile) return <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '2rem' }}>No stats yet.</p>;

  return (
    <div>
      {/* Dragon */}
      <StatSection title="Dragon">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Trick Wins" value={profile.dragonTrickWins} coloredLabel />
          <StatCard label="Rounds Held" value={profile.roundsWithDragon} coloredLabel />
          <StatCard label="Rounds Won w/ Dragon" value={profile.roundsWithDragonWon} coloredLabel />
          <StatCard label="Captured w/ Bomb" value={profile.capturedDragonWithBomb} coloredLabel />
        </div>
      </StatSection>

      {/* Phoenix */}
      <StatSection title="Phoenix">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="Rounds Held" value={profile.roundsWithPhoenix} coloredLabel />
          <StatCard label="Rounds Won" value={profile.roundsWithPhoenixWon} coloredLabel />
          <StatCard label="Longest Straight" value={profile.longestStraightWithPhoenix > 0 ? `${profile.longestStraightWithPhoenix} cards` : '-'} coloredLabel />
          <StatCard label="Total Uses" value={profile.phoenixUsedAsSingle + profile.phoenixUsedForPair + profile.phoenixUsedInTriple + profile.phoenixUsedInFullHouse + profile.phoenixUsedInConsecutivePairs + profile.phoenixUsedInStraight} coloredLabel />
        </div>
        <div className="flex flex-wrap gap-4">
          <TablePanel title="Phoenix Usage by Type">
            <CompactTable headers={['Type', 'Count']} rows={[
              { label: 'As Single', value: profile.phoenixUsedAsSingle },
              { label: 'In Pair', value: profile.phoenixUsedForPair },
              { label: 'In Triple', value: profile.phoenixUsedInTriple },
              { label: 'In Full House', value: profile.phoenixUsedInFullHouse },
              { label: 'In Consecutive Pairs', value: profile.phoenixUsedInConsecutivePairs },
              { label: 'In Straight', value: profile.phoenixUsedInStraight },
            ]} />
          </TablePanel>
        </div>
      </StatSection>

      {/* Dog */}
      <StatSection title="Dog">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="Hands Held" value={profile.handsWithDog} coloredLabel />
          <StatCard label="To Partner" value={profile.dogControlToPartner} subtitle={(() => { const t = profile.dogControlToPartner + profile.dogControlToOpponent + profile.dogControlToSelf; return t > 0 ? `${Math.round((profile.dogControlToPartner / t) * 100)}%` : undefined; })()} coloredLabel />
          <StatCard label="To Opponent" value={profile.dogControlToOpponent} coloredLabel />
          <StatCard label="Stuck as Last Card" value={profile.dogStuckAsLastCard} coloredLabel />
        </div>
        <div className="flex flex-wrap gap-4">
          <TablePanel title="Dog Details">
            <CompactTable headers={['Stat', 'Count']} rows={[
              { label: 'Control to self', value: profile.dogControlToSelf },
              { label: 'Played for Tichu partner', value: profile.dogPlayedForTichuPartner },
              { label: 'Opportunities for Tichu partner', value: profile.dogOpportunitiesForTichuPartner },
              { label: 'Kept during pass', value: profile.keptDogDuringPass },
            ]} />
          </TablePanel>
        </div>
      </StatSection>

      {/* Bombs */}
      <StatSection title="Bombs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="Total Bombs" value={profile.totalBombs} highlight />
          <StatCard label="Straight Flushes" value={profile.fiveCardBombs + profile.sixPlusCardBombs} />
          <StatCard label="Dealt in First 8" value={profile.bombsInFirst8} />
          <StatCard label="Multiple Bombs in Hand" value={profile.handsWithMultipleBombs} />
        </div>
        <div className="flex flex-wrap gap-4">
          <TablePanel title="Bomb Size Distribution">
            <CompactTable headers={['Size', 'Count']} rows={
              [4,5,6,7,8,9,10,11,12,13,14]
                .map(n => ({ label: n === 4 ? '4-card' : `${n}-card straight flush`, value: profile[`bombSize${n}` as keyof PlayerProfile] as number }))
                .filter(r => r.value > 0)
            } />
          </TablePanel>
          <TablePanel title="Bomb Events">
            <CompactTable headers={['Event', 'Count']} rows={[
              { label: 'You over-bombed', value: profile.youOverBombed },
              { label: 'You were over-bombed', value: profile.youWereOverBombed },
              { label: 'Conflicting bombs in hand', value: profile.conflictingBombs },
              { label: 'Bomb forced by wish', value: profile.bombForcedByWish },
            ]} />
          </TablePanel>
        </div>
      </StatSection>

      {/* Pass Tracking */}
      <StatSection title="Pass Tracking">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="Strong Pre-Pass Hand" value={profile.strongPrePassHand} />
          <StatCard label="Kept Dog During Pass" value={profile.keptDogDuringPass} />
        </div>
        <div className="flex flex-wrap gap-4">
          <TablePanel title="Cards Given in Pass">
            <CompactTable headers={['Card', 'Count']} rows={[
              { label: 'Dragon', value: profile.dragonGivenInPass },
              { label: 'Phoenix', value: profile.phoenixGivenInPass },
              { label: 'Ace', value: profile.aceGivenInPass },
              { label: 'Mahjong', value: profile.mahjongGivenInPass },
              { label: 'Dog to partner', value: profile.dogGivenToPartner },
              { label: 'Dog to opponent', value: profile.dogGivenToOpponent },
              { label: 'Bomb to partner', value: profile.bombGivenToPartner },
              { label: 'Bomb to opponent', value: profile.bombGivenToOpponent },
            ]} />
          </TablePanel>
          <TablePanel title="Cards Received in Pass">
            <CompactTable headers={['Card', 'Count']} rows={[
              { label: 'Dragon', value: profile.dragonReceivedInPass },
              { label: 'Phoenix', value: profile.phoenixReceivedInPass },
              { label: 'Ace', value: profile.aceReceivedInPass },
              { label: 'Mahjong', value: profile.mahjongReceivedInPass },
              { label: 'Dog from partner', value: profile.dogReceivedFromPartner },
              { label: 'Dog from opponent', value: profile.dogReceivedFromOpponent },
              { label: 'Bomb from partner', value: profile.bombReceivedFromPartner },
              { label: 'Bomb from opponent', value: profile.bombReceivedFromOpponent },
            ]} />
          </TablePanel>
        </div>
      </StatSection>
    </div>
  );
}
