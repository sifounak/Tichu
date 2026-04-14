'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE, getUserId, type GameHistoryEntry } from '@/components/stats/stats-types';

export default function GameHistoryPage() {
  const router = useRouter();
  const [games, setGames] = useState<GameHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    const userId = getUserId();
    if (!userId) { router.push('/lobby'); return; }
    fetch(`${API_BASE}/api/players/${userId}/games`)
      .then(r => r.json())
      .then(data => { setGames(data.games ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) return <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '2rem' }}>Loading...</p>;
  if (games.length === 0) return <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '2rem' }}>No games played yet.</p>;

  const userId = getUserId();

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'grid', gridTemplateColumns: '80px 50px 110px 1fr 50px', gap: '0.5rem', padding: '0.4rem 0.6rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {['Date', 'Result', 'Score', 'Players', 'Rounds'].map(h => (
          <span key={h} style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: h === 'Rounds' ? 'right' : 'left' }}>{h}</span>
        ))}
      </div>

      {games.map(game => {
        const isNS = game.northUserId === userId || game.southUserId === userId;
        const won = (isNS && game.winnerTeam === 'NS') || (!isNS && game.winnerTeam === 'EW');
        const myScore = isNS ? game.finalScoreNS : game.finalScoreEW;
        const oppScore = isNS ? game.finalScoreEW : game.finalScoreNS;

        let partner: string;
        let opponents: string;
        if (isNS) {
          partner = game.northUserId === userId ? game.southName : game.northName;
          opponents = `${game.eastName} & ${game.westName}`;
        } else {
          partner = game.eastUserId === userId ? game.westName : game.eastName;
          opponents = `${game.northName} & ${game.southName}`;
        }

        return (
          <div key={game.id}>
            <div
              onClick={() => setExpandedId(prev => prev === game.id ? null : game.id)}
              style={{ display: 'grid', gridTemplateColumns: '80px 50px 110px 1fr 50px', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 0.6rem', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>{new Date(game.endedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
              <div>
                <span style={{
                  padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700,
                  background: won ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  color: won ? '#4ade80' : '#f87171',
                }}>{won ? 'WIN' : 'LOSS'}</span>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{myScore} – {oppScore}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>You & {partner} vs {opponents}</div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', textAlign: 'right' }}>{game.roundCount} rds</div>
            </div>

            {expandedId === game.id && (
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '0.6rem', margin: '0.2rem 0.6rem 0.4rem', fontSize: '0.75rem' }}>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.6rem', marginBottom: '0.3rem' }}>Room: {game.roomCode} &bull; {game.roundCount} rounds</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem' }}>
                  N: {game.northName} &bull; E: {game.eastName} &bull; S: {game.southName} &bull; W: {game.westName}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
