// REQ-F-HV07: Player hand with fan layout, overlap, and click-to-select
// REQ-NF-U02: Framer Motion card deal + selection animations
'use client';

import { memo, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameCard, CardId } from '@tichu/shared';
import { Card, type CardState } from './Card';
import { cardSortKey } from './card-utils';
import { useAnimationSettings } from '@/hooks/useAnimationSettings';
import { useRovingTabIndex } from '@/hooks/useRovingTabIndex';
import styles from './CardHand.module.css';

export interface CardHandProps {
  cards: GameCard[];
  selectedIds: Set<CardId>;
  disabledIds?: Set<CardId>;
  onCardClick?: (id: CardId) => void;
  /** Show cards face-down (opponent hand) */
  faceDown?: boolean;
}

export const CardHand = memo(function CardHand({
  cards,
  selectedIds,
  disabledIds,
  onCardClick,
  faceDown = false,
}: CardHandProps) {
  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => cardSortKey(a.card) - cardSortKey(b.card)),
    [cards],
  );

  const { durations, enabled } = useAnimationSettings();
  const { containerRef, handleKeyDown } = useRovingTabIndex(sortedCards.length);

  function getState(id: CardId): CardState {
    if (faceDown) return 'faceDown';
    if (selectedIds.has(id)) return 'selected';
    if (disabledIds?.has(id)) return 'disabled';
    return 'normal';
  }

  return (
    <div
      ref={containerRef}
      className={styles.hand}
      role="group"
      aria-label="Your hand"
      onKeyDown={handleKeyDown}
    >
      <AnimatePresence mode="popLayout">
        {sortedCards.map((gc, i) => (
          <motion.div
            key={gc.id}
            className={styles.cardSlot}
            style={{ '--card-index': i } as React.CSSProperties}
            layout={enabled}
            initial={enabled ? { opacity: 0, y: 40, scale: 0.8 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={enabled ? { opacity: 0, y: -30, scale: 0.9, transition: { duration: durations.cardPlay } } : undefined}
            transition={{
              duration: durations.cardDeal,
              delay: i * durations.cardDealStagger,
              type: 'spring',
              stiffness: 300,
              damping: 25,
            }}
          >
            <Card
              gameCard={faceDown ? undefined : gc}
              state={getState(gc.id)}
              onClick={onCardClick ? () => onCardClick(gc.id) : undefined}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});
