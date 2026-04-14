'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE, getUserId, pct, type PlayerProfile } from '@/components/stats/stats-types';
import { StatCard } from '@/components/stats/StatCard';
import { CompactTable } from '@/components/stats/CompactTable';
import { TablePanel } from '@/components/stats/TablePanel';

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

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Tichu Success" value={`${profile.tichuSuccesses} / ${profile.tichuCalls}`} subtitle={pct(profile.tichuSuccesses, profile.tichuCalls) !== '-' ? pct(profile.tichuSuccesses, profile.tichuCalls) : undefined} highlight />
        <StatCard label="Grand Tichu Success" value={`${profile.grandTichuSuccesses} / ${profile.grandTichuCalls}`} subtitle={pct(profile.grandTichuSuccesses, profile.grandTichuCalls) !== '-' ? pct(profile.grandTichuSuccesses, profile.grandTichuCalls) : undefined} />
        <StatCard label="Opponent Calls Broken" value={profile.opponentTichuBroken + profile.opponentGrandTichuBroken} />
        <StatCard label="Total Calls Made" value={profile.tichuCalls + profile.grandTichuCalls} highlight />
      </div>

      <div className="flex flex-wrap gap-4">
        <TablePanel title="Your Calls">
          <CompactTable headers={['Stat', 'Value']} rows={[
            { label: 'Tichu Calls', value: profile.tichuCalls },
            { label: 'Tichu Successes', value: profile.tichuSuccesses },
            { label: 'Tichu Success Rate', value: pct(profile.tichuSuccesses, profile.tichuCalls) },
            { label: 'Grand Tichu Calls', value: profile.grandTichuCalls },
            { label: 'Grand Tichu Successes', value: profile.grandTichuSuccesses },
            { label: 'Grand Tichu Success Rate', value: pct(profile.grandTichuSuccesses, profile.grandTichuCalls) },
          ]} />
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
  );
}
