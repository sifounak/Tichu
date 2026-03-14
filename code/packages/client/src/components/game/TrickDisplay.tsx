// REQ-F-DI06: Current trick display with per-seat card rendering
// REQ-F-DI02: Current trick leader and current player indicators
// REQ-F-DI07: Mahjong wish indicator
// REQ-NF-U02: Framer Motion card play, trick sweep, bomb effect animations
'use client';

import { memo, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { TrickState, Seat, Rank } from '@tichu/shared';
import { Card } from '../cards/Card';
import { useAnimationSettings } from '@/hooks/useAnimationSettings';
import styles from './TrickDisplay.module.css';

const RANK_LABELS: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

export interface TrickDisplayProps {
  trick: TrickState | null;
  /** REQ-F-DI07: Active Mahjong wish */
  mahjongWish: Rank | null;
  wishFulfilled: boolean;
  /** Player's own seat (for relative positioning) */
  mySeat: Seat;
}

/** Map seat to position relative to player */
function seatPosition(seat: Seat, mySeat: Seat): 'bottom' | 'top' | 'left' | 'right' {
  const order: Seat[] = ['north', 'east', 'south', 'west'];
  const myIdx = order.indexOf(mySeat);
  const seatIdx = order.indexOf(seat);
  const rel = (seatIdx - myIdx + 4) % 4;
  return (['bottom', 'right', 'top', 'left'] as const)[rel];
}

/** Entry direction offsets per seat position — start near the player boxes */
const ENTRY_OFFSETS: Record<string, { x: number; y: number }> = {
  bottom: { x: 0, y: 250 },
  top: { x: 0, y: -250 },
  left: { x: -300, y: 0 },
  right: { x: 300, y: 0 },
};

export const TrickDisplay = memo(function TrickDisplay({
  trick,
  mahjongWish,
  wishFulfilled,
  mySeat,
}: TrickDisplayProps) {
  const { durations, enabled } = useAnimationSettings();

  // Detect bomb plays for special effect
  const [showBomb, setShowBomb] = useState(false);
  const lastPlay = trick?.plays[trick.plays.length - 1];
  const isBombPlay = lastPlay?.combination.type === 'fourBomb' || lastPlay?.combination.type === 'straightFlushBomb';

  useEffect(() => {
    if (isBombPlay && enabled) {
      setShowBomb(true);
      const timer = setTimeout(() => setShowBomb(false), durations.bombEffect * 1000);
      return () => clearTimeout(timer);
    }
  }, [isBombPlay, enabled, durations.bombEffect, lastPlay]);

  return (
    <div className={`${styles.trickDisplay} ${showBomb ? styles.bombFlash : ''}`} aria-label="Trick area">
      {/* REQ-F-DI07: Wish indicator */}
      <AnimatePresence>
        {mahjongWish !== null && !wishFulfilled && (
          <motion.div
            className={styles.wishIndicator}
            aria-label={`Wish for ${RANK_LABELS[mahjongWish]}`}
            initial={enabled ? { opacity: 0, scale: 0.7 } : false}
            animate={{ opacity: 1, scale: 1 }}
            exit={enabled ? { opacity: 0, scale: 0.7 } : undefined}
            transition={{ duration: durations.cardLift }}
          >
            Wish: {RANK_LABELS[mahjongWish]}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {trick && trick.plays.length > 0 ? (
          <motion.div
            key="trick-active"
            className={styles.trickContent}
            exit={enabled ? {
              opacity: 0,
              scale: 0.8,
              transition: { duration: durations.trickSweep },
            } : undefined}
          >
            {/* Show only the latest play, centered */}
            {(() => {
              const latestPlay = trick.plays[trick.plays.length - 1];
              if (!latestPlay) return null;
              const pos = seatPosition(latestPlay.seat, mySeat);
              const isWinner = latestPlay.seat === trick.currentWinner;
              const offset = ENTRY_OFFSETS[pos];
              return (
                <motion.div
                  key={`${latestPlay.seat}-${trick.plays.length}`}
                  className={`${styles.playGroup} ${styles.center} ${isWinner ? styles.winner : ''}`}
                  data-seat={latestPlay.seat}
                  aria-label={`${latestPlay.seat} played ${latestPlay.combination.type}`}
                  initial={enabled ? { x: offset.x, y: offset.y, opacity: 0 } : false}
                  animate={{ x: 0, y: 0, opacity: 1 }}
                  transition={{
                    duration: durations.cardPlay,
                    type: 'spring',
                    stiffness: 200,
                    damping: 20,
                  }}
                >
                  <div className={styles.cards} style={{ '--card-width': '131px', '--card-height': '188px', '--card-font-size': '30px', '--card-suit-size': '38px', '--card-border-radius': '11px' } as React.CSSProperties}>
                    {latestPlay.combination.cards.map((gc, cardIdx) => (
                      <motion.div
                        key={gc.id}
                        className={styles.trickCard}
                        initial={enabled && isBombPlay ? { scale: 1.3, rotate: (cardIdx - 1) * 15 } : false}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ duration: durations.bombEffect, delay: cardIdx * 0.05 }}
                      >
                        <Card gameCard={gc} state="normal" />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              );
            })()}

            {/* Pass indicators moved to PlayerSeat boxes */}
          </motion.div>
        ) : (
          <div className={styles.playArea} key="trick-empty">
            <span className={styles.playAreaText}>Play Area</span>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});
