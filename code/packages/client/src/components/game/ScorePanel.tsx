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
  /** Seats that are currently vacated (empty) */
  vacatedSeats?: Seat[];
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
  vacatedSeats,
}: ScorePanelProps) {
  const [expanded, setExpanded] = useState(false);

  const callMap = new Map(tichuCalls.filter((tc) => tc.call !== 'none').map((tc) => [tc.seat, tc.call]));
  const pos = getSeatPositions(mySeat);
  const myTeam = getTeam(mySeat);
  const oppTeam: Team = myTeam === 'northSouth' ? 'eastWest' : 'northSouth';

  function renderName(seat: Seat) {
    const call = callMap.get(seat);
    const failed = call && tichuFailedSeats?.has(seat);
    const isEmpty = vacatedSeats?.includes(seat);
    return (
      <span className={styles.playerName}>
        {isEmpty ? '(Empty)' : seatNames[seat]}
        {call && (
          <span className={`${styles.tichuBadge} ${call === 'grandTichu' ? styles.grandTichu : styles.tichu} ${failed ? styles.tichuBadgeFailed : ''}`}>
            {call === 'grandTichu' ? 'GT' : 'T'}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className={styles.panel} aria-label="Score panel">
      {/* Team columns: my team (left) vs opponent team (right) */}
      <div className={styles.teamGrid}>
        {renderName(pos.bottom)}
        {renderName(pos.left)}
        {renderName(pos.top)}
        {renderName(pos.right)}
        <AnimatedScore value={scores[myTeam]} className={styles.score} />
        <AnimatedScore value={scores[oppTeam]} className={styles.score} />
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
          {roundHistory.map((rs) => (
            <div key={rs.roundNumber} className={styles.historyRow}>
              <span className={styles.roundNum}>R{rs.roundNumber}</span>
              <span className={styles.historyScore}>{rs.total[myTeam]}</span>
              <span className={styles.historySep}>-</span>
              <span className={styles.historyScore}>{rs.total[oppTeam]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
