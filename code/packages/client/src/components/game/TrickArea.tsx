// REQ-F-DI06: Current trick displayed in center area
'use client';

import { memo } from 'react';
import type { TrickState, Rank } from '@tichu/shared';
import styles from './TrickArea.module.css';

export interface TrickAreaProps {
  trick: TrickState | null;
  /** REQ-F-DI07: Active Mahjong wish */
  mahjongWish: Rank | null;
  wishFulfilled: boolean;
  /** Click the trick area to play selected cards */
  onPlay?: () => void;
  canPlay?: boolean;
}

const RANK_LABELS: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

export const TrickArea = memo(function TrickArea({ trick, mahjongWish, wishFulfilled, onPlay, canPlay }: TrickAreaProps) {
  return (
    <div
      className={`${styles.trickArea}${canPlay ? ` ${styles.clickable}` : ''}`}
      aria-label="Trick area"
      aria-live="polite"
      onClick={canPlay ? onPlay : undefined}
      role={canPlay ? 'button' : undefined}
    >
      {/* Wish indicator */}
      {mahjongWish !== null && !wishFulfilled && (
        <div className={styles.wishIndicator} aria-label={`Wish for ${RANK_LABELS[mahjongWish]}`}>
          Wish: {RANK_LABELS[mahjongWish]}
        </div>
      )}

      {/* Trick plays */}
      {trick && trick.plays.length > 0 ? (
        <div className={styles.plays}>
          {trick.plays.map((play, i) => (
            <div key={`${play.seat}-${i}`} className={styles.play} data-seat={play.seat}>
              <span className={styles.playSeat}>{play.seat}</span>
              <span className={styles.playType}>{play.combination.type}</span>
              <span className={styles.playCards}>{play.combination.cards.length} cards</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <span className={styles.emptyText}>Trick Area</span>
        </div>
      )}
    </div>
  );
});
