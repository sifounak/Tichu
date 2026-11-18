'use client';

import { usePlayerStats, ParticipationNotice } from '@/components/stats/participation-filter';
import type { ParticipationMetadata } from '@tichu/shared';
import { AuthGuard } from '@/components/AuthGuard';
import { pct, type PlayerProfile } from '@/components/stats/stats-types';
import { StatCard } from '@/components/stats/StatCard';
import { CompactTable } from '@/components/stats/CompactTable';
import { TablePanel } from '@/components/stats/TablePanel';
import { getTichuCallStats, getTichuSuccessSubtitle } from '@/components/stats/tichu-call-stats';

export default function TichuCallsPage() {
  const { data, loading, error, metadata } = usePlayerStats<{ profile: PlayerProfile | null; metadata?: ParticipationMetadata }>('profile');
  const profile = data?.profile ?? null;

  if (error) return <p role="alert" style={{ color: 'var(--color-error)' }}>{error}</p>;
  if (loading) return <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '2rem' }}>Loading...</p>;
  if (!profile) return <><ParticipationNotice metadata={metadata} /><p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '2rem' }}>No statistics in this view.</p></>;
  const tichuCallStats = getTichuCallStats(profile);

  return (
    <AuthGuard>
      <div>
        <ParticipationNotice metadata={metadata} />
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
          <StatCard label="Opponent Calls Broken" value={profile.opponentTichuBroken + profile.opponentGrandTichuBroken + profile.opponentBlindGrandTichuBroken} />
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
              { label: 'Opponent Blind Grands Broken', value: profile.opponentBlindGrandTichuBroken },
              { label: 'Partner Tichus You Broke', value: profile.partnerTichuBroken },
              { label: 'Partner GTs You Broke', value: profile.partnerGrandTichuBroken },
              { label: 'Partner Blind Grands You Broke', value: profile.partnerBlindGrandTichuBroken },
              { label: 'Your Tichu Broken by Partner', value: profile.tichuBrokenByPartner },
              { label: 'Your GT Broken by Partner', value: profile.grandTichuBrokenByPartner },
              { label: 'Your Blind Grand Broken by Partner', value: profile.blindGrandTichuBrokenByPartner },
            ]} />
          </TablePanel>
        </div>
      </div>
    </AuthGuard>
  );
}
