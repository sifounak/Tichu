// REQ-F-SC01: Round scoring display
// REQ-F-DI05: Score with expandable history
'use client';

import { memo } from 'react';
import type { RoundScore, Team } from '@tichu/shared';
import styles from './RoundEndPhase.module.css';

export interface RoundEndPhaseProps {
  roundScore: RoundScore;
  cumulativeScores: Record<Team, number>;
  onContinue: () => void;
}

export const RoundEndPhase = memo(function RoundEndPhase({
  roundScore,
  cumulativeScores,
  onContinue,
}: RoundEndPhaseProps) {
  return (
    <div className={styles.overlay}>
      <div className={styles.panel} role="dialog" aria-label="Round results">
        <h2 className={styles.title}>Round {roundScore.roundNumber} Complete</h2>

        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.headerCell}></th>
              <th className={styles.headerCell}>NS</th>
              <th className={styles.headerCell}>EW</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={styles.labelCell}>Card Points</td>
              <td className={styles.valueCell}>{roundScore.cardPoints.northSouth}</td>
              <td className={styles.valueCell}>{roundScore.cardPoints.eastWest}</td>
            </tr>
            {(roundScore.tichuBonuses.northSouth !== 0 || roundScore.tichuBonuses.eastWest !== 0) && (
              <tr>
                <td className={styles.labelCell}>Tichu Bonuses</td>
                <td className={styles.valueCell}>{formatBonus(roundScore.tichuBonuses.northSouth)}</td>
                <td className={styles.valueCell}>{formatBonus(roundScore.tichuBonuses.eastWest)}</td>
              </tr>
            )}
            {roundScore.oneTwoBonus && (
              <tr>
                <td className={styles.labelCell}>1-2 Bonus</td>
                <td className={styles.valueCell}>
                  {roundScore.oneTwoBonus === 'northSouth' ? '+200' : ''}
                </td>
                <td className={styles.valueCell}>
                  {roundScore.oneTwoBonus === 'eastWest' ? '+200' : ''}
                </td>
              </tr>
            )}
            <tr className={styles.totalRow}>
              <td className={styles.labelCell}>Round Total</td>
              <td className={styles.valueCell}>{roundScore.total.northSouth}</td>
              <td className={styles.valueCell}>{roundScore.total.eastWest}</td>
            </tr>
            <tr className={styles.cumulativeRow}>
              <td className={styles.labelCell}>Game Total</td>
              <td className={styles.valueCell}>{cumulativeScores.northSouth}</td>
              <td className={styles.valueCell}>{cumulativeScores.eastWest}</td>
            </tr>
          </tbody>
        </table>

        <button className={styles.continueButton} onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  );
});

function formatBonus(value: number): string {
  if (value === 0) return '';
  return value > 0 ? `+${value}` : `${value}`;
}
