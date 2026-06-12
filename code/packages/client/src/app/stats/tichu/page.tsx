'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { API_BASE, getUserId, pct, type PlayerProfile } from '@/components/stats/stats-types';
import { StatCard } from '@/components/stats/StatCard';
import { CompactTable } from '@/components/stats/CompactTable';
import { TablePanel } from '@/components/stats/TablePanel';
import { getTichuCallStats, getTichuSuccessSubtitle } from '@/components/stats/tichu-call-stats';

export default function TichuCallsPage() {
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
  const tichuCallStats = getTichuCallStats(profile);

  return (
    <AuthGuard>
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {tichuCallStats.map(({ label, successes, calls }, index) => (
            <StatCard
              key={label}
              label={`${label} Success`}
              value={`${successes} / ${calls}`}
              subtitle={getTichuSuccessSubtitle(successes, calls)}
              highlight={index === 0}
            />
          ))}
          <StatCard label="Opponent Calls Broken" value={profile.opponentTichuBroken + profile.opponentGrandTichuBroken} />
          <StatCard label="Total Calls Made" value={profile.tichuCalls + profile.blindGrandTichuCalls + profile.grandTichuCalls} highlight />
        </div>

        <div className="flex flex-wrap gap-4">
          <TablePanel title="Your Calls">
            <CompactTable
              headers={['Stat', 'Value']}
              rows={tichuCallStats.flatMap(({ label, successes, calls }) => [
                { label: `${label} Calls`, value: calls },
                { label: `${label} Successes`, value: successes },
                { label: `${label} Success Rate`, value: pct(successes, calls) },
              ])}
            />
          </TablePanel>
          <TablePanel title="Broken Calls">
            <CompactTable headers={['Stat', 'Value']} rows={[
              { label: 'Opponent Tichus Broken', value: profile.opponentTichuBroken },
              { label: 'Opponent GTs Broken', value: profile.opponentGrandTichuBroken },
              { label: 'Partner Tichus You Broke', value: profile.partnerTichuBroken },
              { label: 'Partner GTs You Broke', value: profile.partnerGrandTichuBroken },
              { label: 'Your Tichu Broken by Partner', value: profile.tichuBrokenByPartner },
              { label: 'Your GT Broken by Partner', value: profile.grandTichuBrokenByPartner },
            ]} />
          </TablePanel>
        </div>
      </div>
    </AuthGuard>
  );
}
