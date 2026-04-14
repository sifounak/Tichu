import { type PlayerProfile, pct } from './stats-types';

interface RecordBannerProps {
  profile: PlayerProfile;
}

export function RecordBanner({ profile }: RecordBannerProps) {
  const gamesLost = profile.gamesPlayed - profile.gamesWon;

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '12px',
        padding: '1.2rem 1.4rem',
        boxShadow: '0 2px 20px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.06)',
        marginBottom: '1.5rem',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
        }}
      >
        {/* Win Rate */}
        <div>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '0.35rem',
            }}
          >
            Win Rate
          </div>
          <div
            style={{
              fontSize: '2.6rem',
              fontWeight: 800,
              color: '#dbb856',
              lineHeight: 1,
            }}
          >
            {pct(profile.gamesWon, profile.gamesPlayed)}
          </div>
        </div>

        {/* Record */}
        <div>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '0.35rem',
            }}
          >
            Record
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.1 }}>
            <span style={{ color: '#4caf8a' }}>{profile.gamesWon}W</span>
            <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 0.2rem' }}>/</span>
            <span style={{ color: '#e05c5c' }}>{gamesLost}L</span>
          </div>
        </div>

        {/* Games */}
        <div>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '0.35rem',
            }}
          >
            Games
          </div>
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.9)',
              lineHeight: 1.1,
            }}
          >
            {profile.gamesPlayed}
          </div>
        </div>

        {/* Rounds */}
        <div>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '0.35rem',
            }}
          >
            Rounds
          </div>
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.9)',
              lineHeight: 1.1,
            }}
          >
            {profile.totalRoundsPlayed}
          </div>
        </div>
      </div>
    </div>
  );
}
