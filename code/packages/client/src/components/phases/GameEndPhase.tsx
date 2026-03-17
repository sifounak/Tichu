// REQ-F-GS01: Game-over modal overlay
// REQ-F-GS02: You won/lost headline
// REQ-F-GS03: 2-column Your Team / Their Team layout
// REQ-F-GS04–GS07: Per-team stats (Grand Tichu, Tichu, 1-2 victories, bombs)
// REQ-F-GS08: Final scores displayed
// REQ-F-GS09: Leave Room button
// REQ-F-GS10: Start New Game button
'use client';

import { memo, useMemo } from 'react';
import type { Seat, Team, RoundScore } from '@tichu/shared';
import { getTeam } from '@tichu/shared';
import styles from './GameEndPhase.module.css';

export interface GameEndPhaseProps {
  winner: Team;
  finalScores: Record<Team, number>;
  roundHistory: RoundScore[];
  mySeat: Seat;
  onNewGame: () => void;
  onLeaveRoom: () => void;
}

interface TeamStats {
  grandTichuWon: number;
  grandTichuBroken: number;
  tichuWon: number;
  tichuBroken: number;
  oneTwoVictories: number;
  bombs: number;
}

function computeStats(roundHistory: RoundScore[], team: Team): TeamStats {
  const stats: TeamStats = {
    grandTichuWon: 0,
    grandTichuBroken: 0,
    tichuWon: 0,
    tichuBroken: 0,
    oneTwoVictories: 0,
    bombs: 0,
  };

  for (const round of roundHistory) {
    // REQ-F-GS04, REQ-F-GS05: Count tichu results per team
    for (const [seat, result] of Object.entries(round.tichuResults) as [Seat, (typeof round.tichuResults)[Seat]][]) {
      if (result === null) continue;
      if (getTeam(seat) !== team) continue;
      if (result.call === 'grandTichu') {
        if (result.won) stats.grandTichuWon += 1;
        else stats.grandTichuBroken += 1;
      } else {
        if (result.won) stats.tichuWon += 1;
        else stats.tichuBroken += 1;
      }
    }

    // REQ-F-GS06: Count 1-2 victories
    if (round.oneTwoBonus === team) {
      stats.oneTwoVictories += 1;
    }

    // REQ-F-GS07: Count bombs
    stats.bombs += round.bombsPerTeam[team];
  }

  return stats;
}

export const GameEndPhase = memo(function GameEndPhase({
  winner,
  finalScores,
  roundHistory,
  mySeat,
  onNewGame,
  onLeaveRoom,
}: GameEndPhaseProps) {
  const myTeam = getTeam(mySeat);
  const theirTeam: Team = myTeam === 'northSouth' ? 'eastWest' : 'northSouth';
  const didWin = myTeam === winner;

  // REQ-F-GS03: Compute stats for both teams
  const myStats = useMemo(() => computeStats(roundHistory, myTeam), [roundHistory, myTeam]);
  const theirStats = useMemo(() => computeStats(roundHistory, theirTeam), [roundHistory, theirTeam]);

  const myScore = finalScores[myTeam];
  const theirScore = finalScores[theirTeam];

  return (
    <div className={styles.overlay}>
      <div className={styles.panel} role="dialog" aria-label="Game over">
        {/* REQ-F-GS02: You won/lost headline */}
        <h2 className={`${styles.headline} ${didWin ? styles.won : styles.lost}`}>
          {didWin ? 'You won!' : 'You lost!'}
        </h2>

        {/* REQ-F-GS03: 2-column stat layout */}
        <div className={styles.statsGrid}>
          <div className={styles.colHeader}>Your Team</div>
          <div className={styles.colHeader}>Their Team</div>

          {/* REQ-F-GS08: Final scores */}
          <div className={`${styles.score} ${didWin ? styles.scoreWon : styles.scoreLost}`}>
            {myScore}
          </div>
          <div className={`${styles.score} ${!didWin ? styles.scoreWon : styles.scoreLost}`}>
            {theirScore}
          </div>

          <div className={styles.divider} />
          <div className={styles.divider} />

          {/* REQ-F-GS04: Grand Tichu */}
          <div className={styles.statLabel}>Grand Tichu</div>
          <div className={styles.statLabel}>Grand Tichu</div>
          <div className={styles.statValue}>{myStats.grandTichuWon} / {myStats.grandTichuBroken}</div>
          <div className={styles.statValue}>{theirStats.grandTichuWon} / {theirStats.grandTichuBroken}</div>

          {/* REQ-F-GS05: Tichu */}
          <div className={styles.statLabel}>Tichu</div>
          <div className={styles.statLabel}>Tichu</div>
          <div className={styles.statValue}>{myStats.tichuWon} / {myStats.tichuBroken}</div>
          <div className={styles.statValue}>{theirStats.tichuWon} / {theirStats.tichuBroken}</div>

          {/* REQ-F-GS06: 1-2 Victories */}
          <div className={styles.statLabel}>1-2 Victories</div>
          <div className={styles.statLabel}>1-2 Victories</div>
          <div className={styles.statValue}>{myStats.oneTwoVictories}</div>
          <div className={styles.statValue}>{theirStats.oneTwoVictories}</div>

          {/* REQ-F-GS07: Bombs */}
          <div className={styles.statLabel}>Bombs</div>
          <div className={styles.statLabel}>Bombs</div>
          <div className={styles.statValue}>{myStats.bombs}</div>
          <div className={styles.statValue}>{theirStats.bombs}</div>
        </div>

        {/* REQ-F-GS09, REQ-F-GS10: Action buttons */}
        <div className={styles.buttons}>
          <button className={styles.leaveButton} onClick={onLeaveRoom}>
            Leave Room
          </button>
          <button className={styles.newGameButton} onClick={onNewGame}>
            Start New Game
          </button>
        </div>
      </div>
    </div>
  );
});
