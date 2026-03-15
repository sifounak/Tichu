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

/** Format the effective value of a Phoenix single for display */
function formatPhoenixValue(rank: number): string {
  const baseRank = Math.floor(rank);
  const label = RANK_LABELS[baseRank];
  if (!label) return `(${rank})`;
  // Numeric ranks (2-10): show as decimal, e.g. "(2.5)"
  if (baseRank <= 10) return `(${rank})`;
  // Face cards: show as "Jack + 0.5" etc.
  const FACE_NAMES: Record<number, string> = { 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
  return `(${FACE_NAMES[baseRank] ?? label} + 0.5)`;
}

export interface TrickDisplayProps {
  trick: TrickState | null;
  /** REQ-F-DI07: Active Mahjong wish */
  mahjongWish: Rank | null;
  wishFulfilled: boolean;
  /** Player's own seat (for relative positioning) */
  mySeat: Seat;
  /** Hide the empty "Play Area" placeholder but still show active trick cards */
  hideEmptyPlaceholder?: boolean;
  /** REQ-F-DA01: Dog play animation state */
  dogAnimation?: { fromSeat: Seat; toSeat: Seat } | null;
}

/** Map seat to position relative to player */
function seatPosition(seat: Seat, mySeat: Seat): 'bottom' | 'top' | 'left' | 'right' {
  const order: Seat[] = ['north', 'east', 'south', 'west'];
  const myIdx = order.indexOf(mySeat);
  const seatIdx = order.indexOf(seat);
  const rel = (seatIdx - myIdx + 4) % 4;
  return (['bottom', 'right', 'top', 'left'] as const)[rel];
}

/** Entry direction offsets per seat position — start at the nearest edge of the play area */
const ENTRY_OFFSETS: Record<string, { x: number | string; y: number | string }> = {
  bottom: { x: 0, y: '50%' },
  top: { x: 0, y: '-50%' },
  left: { x: '-50%', y: 0 },
  right: { x: '50%', y: 0 },
};

/** Exit offsets — slide toward the winner's seat */
const EXIT_OFFSETS: Record<string, { x: number | string; y: number | string }> = {
  bottom: { x: 0, y: '120%' },
  top: { x: 0, y: '-120%' },
  left: { x: '-120%', y: 0 },
  right: { x: '120%', y: 0 },
};

export const TrickDisplay = memo(function TrickDisplay({
  trick,
  mahjongWish,
  wishFulfilled,
  mySeat,
  hideEmptyPlaceholder,
  dogAnimation,
}: TrickDisplayProps) {
  const { durations, enabled } = useAnimationSettings();

  // Compute sweep direction from the current trick winner while trick is active,
  // so the exit prop is already set correctly before AnimatePresence unmounts it
  const sweepTarget = trick?.currentWinner
    ? seatPosition(trick.currentWinner, mySeat)
    : null;

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

  // Compute exit animation based on sweep target
  // Slide toward the winner at full size, fade out near the end
  const exitAnim = enabled && sweepTarget
    ? {
        x: EXIT_OFFSETS[sweepTarget].x,
        y: EXIT_OFFSETS[sweepTarget].y,
        opacity: 0,
        transition: {
          duration: durations.trickSweep,
          ease: 'easeIn' as const,
          opacity: { duration: durations.trickSweep * 0.4, delay: durations.trickSweep * 0.6 },
        },
      }
    : enabled
      ? { opacity: 0, transition: { duration: durations.trickSweep } }
      : undefined;

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

      {/* REQ-F-DA01: Dog play animation overlay */}
      <AnimatePresence>
        {dogAnimation && enabled && (
          <motion.div
            key="dog-play"
            className={styles.dogCard}
            initial={ENTRY_OFFSETS[seatPosition(dogAnimation.fromSeat, mySeat)]}
            animate={{ x: 0, y: 0, opacity: 1 }}
            exit={{
              ...EXIT_OFFSETS[seatPosition(dogAnimation.toSeat, mySeat)],
              opacity: 0,
              transition: {
                duration: durations.trickSweep,
                ease: 'easeIn' as const,
                delay: 1.0 * (enabled ? 1 : 0),
              },
            }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 20,
            }}
          >
            <div style={{ '--card-width': '131px', '--card-height': '188px', '--card-font-size': '30px', '--card-suit-size': '38px', '--card-border-radius': '11px' } as React.CSSProperties}>
              <Card gameCard={{ id: -1, card: { kind: 'dog' } }} state="normal" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {trick && trick.plays.length > 0 ? (
          <motion.div
            key="trick-active"
            className={styles.trickContent}
            exit={exitAnim}
          >
            {/* Previous play fades out while new play slides in */}
            <AnimatePresence>
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
                    style={{ zIndex: 2 }}
                    initial={enabled ? { x: offset.x, y: offset.y, opacity: 0, zIndex: 2 } : false}
                    animate={{ x: 0, y: 0, opacity: 1, zIndex: 2 }}
                    exit={enabled ? { zIndex: 1, opacity: 1, transition: { duration: durations.cardPlay } } : undefined}
                    transition={{
                      duration: durations.cardPlay,
                      type: 'spring',
                      stiffness: 200,
                      damping: 20,
                    }}
                  >
                    <div className={styles.cards} style={{ '--card-width': '131px', '--card-height': '188px', '--card-font-size': '30px', '--card-suit-size': '38px', '--card-border-radius': '11px' } as React.CSSProperties}>
                      {latestPlay.combination.cards.map((gc, cardIdx) => {
                        const isPhoenixSingle =
                          latestPlay.combination.type === 'single' &&
                          gc.card.kind === 'phoenix';
                        return (
                          <motion.div
                            key={gc.id}
                            className={styles.trickCard}
                            initial={enabled && isBombPlay ? { scale: 1.3, rotate: (cardIdx - 1) * 15 } : false}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ duration: durations.bombEffect, delay: cardIdx * 0.05 }}
                          >
                            <Card gameCard={gc} state="normal" />
                            {isPhoenixSingle && (
                              <div className={styles.phoenixValue}>
                                {formatPhoenixValue(latestPlay.combination.rank)}
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>

            {/* Pass indicators moved to PlayerSeat boxes */}
          </motion.div>
        ) : !hideEmptyPlaceholder ? (
          <div className={styles.playArea} key="trick-empty">
            <span className={styles.playAreaText}>Play Area</span>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
});
