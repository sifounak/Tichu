// REQ-F-DI06: Current trick display with per-seat card rendering
// REQ-F-DI02: Current trick leader and current player indicators
// REQ-F-DI07: Mahjong wish indicator
// REQ-NF-U02: Framer Motion card play, trick sweep, bomb effect animations
'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { TrickState, Seat, Rank } from '@tichu/shared';
import { Card } from '../cards/Card';
import { sortCombinationForDisplay } from '../cards/card-utils';
import { useAnimationSettings } from '@/hooks/useAnimationSettings';
import styles from './TrickDisplay.module.css';

const RANK_LABELS: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

const RANK_FULL_NAMES: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace',
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
  /** REQ-F-DR01: Show Dragon gift notification */
  dragonGiftPending?: boolean;
  /** REQ-F-DRA02: Dragon gift animation — keeps trick visible during sweep */
  dragonGiftAnimation?: { recipient: Seat; trick: TrickState } | null;
  /** Show "must satisfy wish" banner */
  mustSatisfyWish?: boolean;
  /** End-of-trick bomb window: epoch ms when window expires, null when inactive */
  endOfTrickBombWindowEndTime?: number | null;
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
  dragonGiftPending,
  dragonGiftAnimation,
  mustSatisfyWish,
  endOfTrickBombWindowEndTime,
}: TrickDisplayProps) {
  const { durations, enabled } = useAnimationSettings();

  // REQ-F-DRA02: Use the animation trick when the store trick is gone (dragon gift sweep)
  const displayTrick = trick ?? dragonGiftAnimation?.trick ?? null;

  // REQ-F-DRA02: Override sweep direction toward the gift recipient
  const displaySweepTarget = dragonGiftAnimation
    ? seatPosition(dragonGiftAnimation.recipient, mySeat)
    : displayTrick?.currentWinner
      ? seatPosition(displayTrick.currentWinner, mySeat)
      : null;

  // Detect bomb plays for special effect
  const [showBomb, setShowBomb] = useState(false);
  const lastPlay = displayTrick?.plays[displayTrick.plays.length - 1];
  const isBombPlay = lastPlay?.combination.type === 'fourBomb' || lastPlay?.combination.type === 'straightFlushBomb';

  useEffect(() => {
    if (isBombPlay && enabled) {
      setShowBomb(true);
      const timer = setTimeout(() => setShowBomb(false), durations.bombEffect * 1000);
      return () => clearTimeout(timer);
    }
  }, [isBombPlay, enabled, durations.bombEffect, lastPlay]);

  // Compute exit animation based on sweep target (or dragon gift recipient)
  // Slide toward the winner at full size, fade out near the end
  const exitAnim = enabled && displaySweepTarget
    ? {
        x: EXIT_OFFSETS[displaySweepTarget].x,
        y: EXIT_OFFSETS[displaySweepTarget].y,
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

  // End-of-trick bomb window countdown
  const [bombWindowRemaining, setBombWindowRemaining] = useState<number | null>(null);
  const bombWindowRafRef = useRef(0);
  useEffect(() => {
    if (!endOfTrickBombWindowEndTime) {
      setBombWindowRemaining(null);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, endOfTrickBombWindowEndTime - Date.now());
      setBombWindowRemaining(remaining);
      if (remaining > 0) {
        bombWindowRafRef.current = requestAnimationFrame(tick);
      }
    };
    bombWindowRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(bombWindowRafRef.current);
  }, [endOfTrickBombWindowEndTime]);

  return (
    <div className={`${styles.trickDisplay} ${showBomb ? styles.bombFlash : ''}`} aria-label="Trick area">
      {/* REQ-F-DR01: Dragon gift notification */}
      {dragonGiftPending && (
        <div className={styles.dragonNotification}>
          You must give the Dragon trick to one of your opponents
        </div>
      )}

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
            {RANK_FULL_NAMES[mahjongWish]} wish in effect
          </motion.div>
        )}
      </AnimatePresence>

      {/* REQ-F-DA01: Dog play animation overlay */}
      {/* REQ-F-DA02: Entry uses durations.cardPlay; REQ-F-DA04: Exit uses durations.trickSweep with no internal delay */}
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
                // No delay — page.tsx setTimeout controls when exit begins (after entry + pause)
                duration: durations.trickSweep,
                ease: 'easeIn' as const,
                opacity: { duration: durations.trickSweep * 0.4, delay: durations.trickSweep * 0.6 },
              },
            }}
            transition={{
              // REQ-F-DA02: Respect animation speed setting
              duration: durations.cardPlay,
              type: 'spring',
              stiffness: 200,
              damping: 20,
            }}
          >
            <div style={{ '--card-width': 'var(--card-width-lg)', '--card-height': 'var(--card-height-lg)', '--card-font-size': 'var(--card-font-size-lg)', '--card-suit-size': 'var(--card-suit-size-lg)', '--card-border-radius': 'var(--card-border-radius-lg)' } as React.CSSProperties}>
              <Card gameCard={{ id: -1, card: { kind: 'dog' } }} state="normal" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {displayTrick && displayTrick.plays.length > 0 ? (
          <motion.div
            key="trick-active"
            className={styles.trickContent}
            exit={exitAnim}
          >
            {/* Previous play fades out while new play slides in */}
            <AnimatePresence>
              {(() => {
                const latestPlay = displayTrick.plays[displayTrick.plays.length - 1];
                if (!latestPlay) return null;
                const pos = seatPosition(latestPlay.seat, mySeat);
                const isWinner = latestPlay.seat === displayTrick.currentWinner;
                const offset = ENTRY_OFFSETS[pos];
                return (
                  <motion.div
                    key={`${latestPlay.seat}-${displayTrick.plays.length}`}
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
                    <div className={styles.cards} style={{ '--card-width': 'var(--card-width-lg)', '--card-height': 'var(--card-height-lg)', '--card-font-size': 'var(--card-font-size-lg)', '--card-suit-size': 'var(--card-suit-size-lg)', '--card-border-radius': 'var(--card-border-radius-lg)' } as React.CSSProperties}>
                      {sortCombinationForDisplay(latestPlay.combination).map((gc, cardIdx) => {
                        const isPhoenixSingle =
                          latestPlay.combination.type === 'single' &&
                          gc.card.kind === 'phoenix';
                        const cardCount = latestPlay.combination.cards.length;
                        const midIdx = (cardCount - 1) / 2;
                        // Fan: spread cards out with rotation + vertical lift after impact
                        const fanRotate = (cardIdx - midIdx) * 8;
                        const fanY = -Math.abs(cardIdx - midIdx) * 12 - 8; // lift ~25% card height, arc shape
                        const fanX = (cardIdx - midIdx) * 6;
                        return (
                          <motion.div
                            key={gc.id}
                            className={styles.trickCard}
                            initial={enabled && isBombPlay ? { scale: 1.5, rotate: 0, y: 0, x: 0, opacity: 1 } : false}
                            animate={enabled && isBombPlay
                              ? { scale: [1.5, 1, 1], rotate: [0, 0, fanRotate], y: [0, 0, fanY], x: [0, 0, fanX], opacity: 1 }
                              : { scale: 1, rotate: 0, opacity: 1 }}
                            transition={enabled && isBombPlay
                              ? { duration: 0.45, times: [0, 0.33, 1], ease: ['easeIn', 'easeOut'] }
                              : { duration: durations.bombEffect }}
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

      {/* Must satisfy wish banner */}
      {mustSatisfyWish && (
        <div className={styles.mustSatisfyWish}>
          You must satisfy the wish
        </div>
      )}

      {/* End-of-trick bomb window banner */}
      {bombWindowRemaining !== null && bombWindowRemaining > 0 && (
        <div className={styles.endOfTrickBombBanner}>
          Pausing for end-of-trick bombs: {Math.ceil(bombWindowRemaining / 1000)}...
        </div>
      )}
    </div>
  );
});
