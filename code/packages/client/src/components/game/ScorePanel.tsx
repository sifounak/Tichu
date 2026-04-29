// REQ-F-DI05: Score with expandable history
// REQ-F-DI04: Tichu call indicators in score panel
'use client';

import { memo, useState } from 'react';
import type { Team, RoundScore, TichuCall, Seat } from '@tichu/shared';
import { getTeam } from '@tichu/shared';
import { AnimatedScore } from './AnimatedScore';
import styles from './ScorePanel.module.css';

export interface ScorePanelProps {
  scores: Record<Team, number>;
  roundHistory: RoundScore[];
  /** Tichu calls for display */
  tichuCalls: Array<{ seat: Seat; call: TichuCall }>;
  targetScore: number;
  /** Player names by seat */
  seatNames: Record<Seat, string>;
  /** The current player's seat (displayed at bottom of table) */
  mySeat: Seat;
  /** Seats whose Tichu call has failed (another player went out first) */
  tichuFailedSeats?: Set<Seat>;
  /** Seats whose Tichu call succeeded (they went out first) */
  tichuSucceededSeats?: Set<Seat>;
  /** Seats that are currently vacated (empty) */
  vacatedSeats?: Seat[];
  /** Compact mode: "You: # / Them: #" for compact/mobile layout tiers */
  compact?: boolean;
}

/** Map actual seats to table positions relative to the player's seat */
function getSeatPositions(mySeat: Seat): Record<'bottom' | 'top' | 'left' | 'right', Seat> {
  const order: Seat[] = ['north', 'east', 'south', 'west'];
  const myIdx = order.indexOf(mySeat);
  return {
    bottom: order[myIdx],
    right: order[(myIdx + 1) % 4],
    top: order[(myIdx + 2) % 4],
    left: order[(myIdx + 3) % 4],
  };
}

export const ScorePanel = memo(function ScorePanel({
  scores,
  roundHistory,
  tichuCalls,
  targetScore,
  seatNames,
  mySeat,
  tichuFailedSeats,
  tichuSucceededSeats,
  vacatedSeats,
  compact,
}: ScorePanelProps) {
  const [expanded, setExpanded] = useState(false);

  const callMap = new Map(tichuCalls.filter((tc) => tc.call !== 'none').map((tc) => [tc.seat, tc.call]));
  const pos = getSeatPositions(mySeat);
  const myTeam = getTeam(mySeat);
  const oppTeam: Team = myTeam === 'northSouth' ? 'eastWest' : 'northSouth';
  const myTeamSeats = [pos.bottom, pos.top];
  const oppTeamSeats = [pos.left, pos.right];

  function renderTichuBadges(rs: RoundScore, seats: Seat[]) {
    const badges = seats
      .map((seat) => rs.tichuResults[seat])
      .filter((tr): tr is NonNullable<typeof tr> => tr != null)
      .sort((a, b) => (a.won === b.won ? 0 : a.won ? -1 : 1));
    if (badges.length === 0) return null;
    return badges.map((tr, i) => {
      const label = tr.call === 'grandTichu' ? 'GT' : 'T';
      const badgeClass = tr.won ? styles.historyBadgeWon : styles.historyBadgeFailed;
      return (
        <span key={i} className={`${styles.historyBadge} ${badgeClass}`}>{label}</span>
      );
    });
  }

  function renderHistoryRow(rs: RoundScore) {
    return (
      <div key={rs.roundNumber} className={styles.historyRow}>
        <span className={styles.historyTeamLeft}>
          <span className={styles.historyBadges}>{renderTichuBadges(rs, myTeamSeats)}</span>
          <span className={styles.historyScore}>{rs.total[myTeam]}</span>
        </span>
        <span className={styles.historyTeamRight}>
          <span className={styles.historyScore}>{rs.total[oppTeam]}</span>
          <span className={`${styles.historyBadges} ${styles.historyBadgesRight}`}>{renderTichuBadges(rs, oppTeamSeats)}</span>
        </span>
      </div>
    );
  }

  function renderName(seat: Seat) {
    const call = callMap.get(seat);
    const failed = call && tichuFailedSeats?.has(seat);
    const succeeded = call && tichuSucceededSeats?.has(seat);
    const isEmpty = vacatedSeats?.includes(seat);
    const bannerClass = failed ? styles.nameBannerFailed
      : succeeded ? styles.nameBannerSucceeded
      : call === 'grandTichu' ? styles.nameBannerGrandTichu
      : call === 'tichu' ? styles.nameBannerTichu
      : '';
    const name = isEmpty ? '(Empty)' : seatNames[seat];
    return (
      <div className={`${styles.playerName} ${bannerClass}`} title={name}>
        {name}
      </div>
    );
  }

  // Compact rendering: "You: # / Them: #" — click to show full score modal
  if (compact) {
    return (
      <>
        <div
          className={styles.compactPanel}
          aria-label="Score — tap to expand"
          role="button"
          onClick={() => setExpanded(!expanded)}
          style={{ cursor: 'pointer' }}
        >
          <div className={styles.compactLine}>
            <span className={styles.compactLabel}>You:</span>
            <AnimatedScore value={scores[myTeam]} className={styles.compactScore} />
          </div>
          <div className={styles.compactLine}>
            <span className={styles.compactLabel}>Them:</span>
            <AnimatedScore value={scores[oppTeam]} className={styles.compactScore} />
          </div>
        </div>

        {expanded && (
          <div className={styles.compactOverlay} onClick={() => setExpanded(false)}>
            <div className={styles.compactModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.teamGrid}>
                <div className={styles.teamColumn}>
                  {renderName(pos.bottom)}
                  {renderName(pos.top)}
                  <AnimatedScore value={scores[myTeam]} className={styles.score} />
                </div>
                <div className={styles.teamColumn}>
                  {renderName(pos.left)}
                  {renderName(pos.right)}
                  <AnimatedScore value={scores[oppTeam]} className={styles.score} />
                </div>
              </div>

              <div className={styles.target}>First to {targetScore}</div>

              {roundHistory.length > 0 && (
                <div className={styles.history}>
                  {roundHistory.map((rs) => renderHistoryRow(rs))}
                </div>
              )}

              <button className={styles.compactModalClose} onClick={() => setExpanded(false)}>
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className={`${styles.panel} ${expanded ? styles.panelExpanded : ''}`} aria-label="Score panel">
      {/* Team columns: my team (left) vs opponent team (right) */}
      <div className={styles.teamGrid}>
        <div className={styles.teamColumn}>
          {renderName(pos.bottom)}
          {renderName(pos.top)}
          <AnimatedScore value={scores[myTeam]} className={styles.score} />
        </div>
        <div className={styles.teamColumn}>
          {renderName(pos.left)}
          {renderName(pos.right)}
          <AnimatedScore value={scores[oppTeam]} className={styles.score} />
        </div>
      </div>

      <div className={styles.target}>First to {targetScore}</div>

      {/* Expandable history */}
      {roundHistory.length > 0 && (
        <button
          className={styles.historyToggle}
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          {expanded ? 'Hide' : 'History'} ({roundHistory.length})
        </button>
      )}

      {expanded && roundHistory.length > 0 && (
        <div className={styles.history}>
          {roundHistory.map((rs) => renderHistoryRow(rs))}
        </div>
      )}
    </div>
  );
});
