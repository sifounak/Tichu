// REQ-F-GF10: Game over display with final scores
'use client';

import { memo } from 'react';
import type { Team, RoundScore } from '@tichu/shared';
import styles from './GameEndPhase.module.css';

export interface GameEndPhaseProps {
  winner: Team;
  finalScores: Record<Team, number>;
  roundHistory: RoundScore[];
  onNewGame: () => void;
}

export const GameEndPhase = memo(function GameEndPhase({
  winner,
  finalScores,
  roundHistory,
  onNewGame,
}: GameEndPhaseProps) {
  const winnerLabel = winner === 'northSouth' ? 'North-South' : 'East-West';

  return (
    <div className={styles.overlay}>
      <div className={styles.panel} role="dialog" aria-label="Game over">
        <h2 className={styles.title}>Game Over</h2>
        <p className={styles.winnerText}>{winnerLabel} Wins!</p>

        <div className={styles.finalScores}>
          <div className={styles.teamScore}>
            <span className={styles.teamLabel}>NS</span>
            <span className={styles.score}>{finalScores.northSouth}</span>
          </div>
          <span className={styles.vs}>vs</span>
          <div className={styles.teamScore}>
            <span className={styles.teamLabel}>EW</span>
            <span className={styles.score}>{finalScores.eastWest}</span>
          </div>
        </div>

        {roundHistory.length > 0 && (
          <details className={styles.history}>
            <summary className={styles.historySummary}>
              Round History ({roundHistory.length} rounds)
            </summary>
            <table className={styles.historyTable}>
              <thead>
                <tr>
                  <th>Round</th>
                  <th>NS</th>
                  <th>EW</th>
                </tr>
              </thead>
              <tbody>
                {roundHistory.map((rs) => (
                  <tr key={rs.roundNumber}>
                    <td>{rs.roundNumber}</td>
                    <td>{rs.total.northSouth}</td>
                    <td>{rs.total.eastWest}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}

        <button className={styles.newGameButton} onClick={onNewGame}>
          New Game
        </button>
      </div>
    </div>
  );
});
