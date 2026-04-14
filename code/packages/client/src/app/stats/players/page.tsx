'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE, getUserId, perGame, type MergedRelationalStat } from '@/components/stats/stats-types';

export default function PlayersPage() {
  const router = useRouter();
  const [relationships, setRelationships] = useState<MergedRelationalStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = getUserId();
    if (!userId) { router.push('/lobby'); return; }
    fetch(`${API_BASE}/api/players/${userId}/relationships`)
      .then(r => r.json())
      .then(data => { setRelationships(data.relationships ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) return <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '2rem' }}>Loading...</p>;
  if (relationships.length === 0) return <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '2rem' }}>No relationship data yet.</p>;

  const thStyle = { textAlign: 'left' as const, color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', textTransform: 'uppercase' as const, letterSpacing: '1px', padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 600 };
  const thR = { ...thStyle, textAlign: 'right' as const };
  const thC = { ...thStyle, textAlign: 'center' as const };
  const tdStyle = { padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' };
  const tdVal = { ...tdStyle, color: '#fff', fontWeight: 600, textAlign: 'right' as const };
  const tdAccent = { ...tdVal, color: '#dbb856' };
  const sep = { borderLeft: '1px solid rgba(255,255,255,0.06)' };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ maxWidth: '640px', borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={thStyle}>Player</th>
            <th style={{ ...thC, ...sep }} colSpan={4}>As Partner</th>
            <th style={{ ...thC, ...sep }} colSpan={4}>As Opponent</th>
          </tr>
          <tr>
            <th style={thStyle}></th>
            <th style={{ ...thR, ...sep, fontSize: '0.55rem' }}>Games</th>
            <th style={{ ...thR, fontSize: '0.55rem' }}>Win%</th>
            <th style={{ ...thR, fontSize: '0.55rem' }}>1-2s</th>
            <th style={{ ...thR, fontSize: '0.55rem' }}>Bombs</th>
            <th style={{ ...thR, ...sep, fontSize: '0.55rem' }}>Games</th>
            <th style={{ ...thR, fontSize: '0.55rem' }}>Win%</th>
            <th style={{ ...thR, fontSize: '0.55rem' }}>1-2s</th>
            <th style={{ ...thR, fontSize: '0.55rem' }}>Bombs</th>
          </tr>
        </thead>
        <tbody>
          {relationships.map(r => (
            <tr key={r.userId}>
              <td style={{ ...tdStyle, color: '#fff' }}>{r.displayName}</td>
              <td style={{ ...tdVal, ...sep }}>{r.partnerGamesPlayed || '—'}</td>
              <td style={r.partnerWinRate >= 0.65 ? tdAccent : tdVal}>{r.partnerGamesPlayed > 0 ? `${Math.round(r.partnerWinRate * 100)}%` : '—'}</td>
              <td style={tdVal}>{perGame(r.partnerOneTwoWins, r.partnerGamesPlayed)}</td>
              <td style={tdVal}>{perGame(r.partnerTotalTeamBombs, r.partnerGamesPlayed)}</td>
              <td style={{ ...tdVal, ...sep }}>{r.opponentGamesPlayed || '—'}</td>
              <td style={r.opponentWinRate >= 0.65 ? tdAccent : tdVal}>{r.opponentGamesPlayed > 0 ? `${Math.round(r.opponentWinRate * 100)}%` : '—'}</td>
              <td style={tdVal}>{perGame(r.opponentOneTwoWins, r.opponentGamesPlayed)}</td>
              <td style={tdVal}>{perGame(r.opponentTotalTeamBombs, r.opponentGamesPlayed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
