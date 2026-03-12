// REQ-F-DI05: Score with expandable history
// REQ-F-DI04: Tichu call indicators in score panel
'use client';

import { memo, useState } from 'react';
import type { Team, RoundScore, TichuCall, Seat } from '@tichu/shared';
import { AnimatedScore } from './AnimatedScore';
import styles from './ScorePanel.module.css';

export interface ScorePanelProps {
  scores: Record<Team, number>;
  roundHistory: RoundScore[];
  /** Tichu calls for display */
  tichuCalls: Array<{ seat: Seat; call: TichuCall }>;
  targetScore: number;
}

export const ScorePanel = memo(function ScorePanel({
  scores,
  roundHistory,
  tichuCalls,
  targetScore,
}: ScorePanelProps) {
  const [expanded, setExpanded] = useState(false);

  const activeCalls = tichuCalls.filter((tc) => tc.call !== 'none');

  return (
    <div className={styles.panel} aria-label="Score panel">
      {/* Current scores */}
      <div className={styles.scoreRow}>
        <span className={styles.teamLabel}>NS</span>
        <AnimatedScore value={scores.northSouth} className={styles.score} />
        <span className={styles.separator}>-</span>
        <AnimatedScore value={scores.eastWest} className={styles.score} />
        <span className={styles.teamLabel}>EW</span>
      </div>

      <div className={styles.target}>First to {targetScore}</div>

      {/* REQ-F-DI04: Active Tichu calls */}
      {activeCalls.length > 0 && (
        <div className={styles.tichuCalls}>
          {activeCalls.map(({ seat, call }) => (
            <span
              key={seat}
              className={`${styles.tichuBadge} ${call === 'grandTichu' ? styles.grandTichu : styles.tichu}`}
            >
              {seat[0].toUpperCase()}: {call === 'grandTichu' ? 'GT' : 'T'}
            </span>
          ))}
        </div>
      )}

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
              <span className={styles.historyScore}>{rs.total.northSouth}</span>
              <span className={styles.historySep}>-</span>
              <span className={styles.historyScore}>{rs.total.eastWest}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
