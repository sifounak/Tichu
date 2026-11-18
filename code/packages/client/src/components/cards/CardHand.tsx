// REQ-F-HV07: Player hand with fan layout, overlap, and click-to-select
// REQ-NF-U02: Framer Motion card deal + selection animations
'use client';

import { memo, useMemo, useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameCard, CardId } from '@tichu/shared';
import { Card, type CardState } from './Card';
import { cardIdentifierSide, cardStackIndex, sortCardsForDisplay } from './card-utils';
import { usePreferencesStore } from '@/stores/preferencesStore';
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
  const { cardOrder, cardOverlap } = usePreferencesStore((s) => s.preferences);
  const sortedCards = useMemo(
    () => sortCardsForDisplay(cards, cardOrder),
    [cards, cardOrder],
  );

  const { durations, enabled } = useAnimationSettings();
  const { containerRef: rovingRef, handleKeyDown } = useRovingTabIndex(sortedCards.length);

  // Auto-scale: shrink the hand when cards would overflow the container
  const wrapperRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [handScale, setHandScale] = useState(1);

  // REQ-F-UP06: Moving a focused DOM node can blur it; restore the same card after sorting.
  const focusedCardId = typeof document !== 'undefined' && innerRef.current?.contains(document.activeElement)
    ? document.activeElement?.getAttribute('data-card-id') : null;
  useLayoutEffect(() => {
    if (focusedCardId) innerRef.current?.querySelector<HTMLButtonElement>(`button[data-card-id="${focusedCardId}"]`)?.focus();
  }, [sortedCards, focusedCardId]);

  const updateHandScale = useCallback(() => {
    const wrapper = wrapperRef.current;
    const inner = innerRef.current;
    if (!wrapper || !inner) return;
    const available = wrapper.clientWidth;
    if (available <= 0) return;
    // Temporarily disable transition and reset scale to measure natural width
    const prevTransition = inner.style.transition;
    const prevTransform = inner.style.transform;
    inner.style.transition = 'none';
    inner.style.transform = 'none';
    const natural = inner.scrollWidth;
    inner.style.transform = prevTransform;
    // Force layout to apply the reset before re-enabling transition
    inner.offsetHeight; // eslint-disable-line @typescript-eslint/no-unused-expressions
    inner.style.transition = prevTransition;
    if (natural > available) {
      setHandScale(available / natural);
    } else {
      setHandScale(1);
    }
  }, []);

  const prevCountRef = useRef(sortedCards.length);
  useEffect(() => {
    const cardsRemoved = sortedCards.length < prevCountRef.current;
    prevCountRef.current = sortedCards.length;
    if (cardsRemoved) {
      // Delay recalculation until exit animations settle
      const timer = setTimeout(updateHandScale, durations.cardPlay * 1000 + 50);
      return () => clearTimeout(timer);
    }
    updateHandScale();
    const ro = new ResizeObserver(() => updateHandScale());
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [updateHandScale, sortedCards.length, durations.cardPlay]);

  // Combine refs for roving tab index and inner measurement
  const setInnerRef = useCallback((el: HTMLDivElement | null) => {
    (innerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    // rovingRef is a RefObject, assign manually
    (rovingRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  }, [rovingRef]);

  function getState(id: CardId): CardState {
    if (faceDown) return 'faceDown';
    if (selectedIds.has(id)) return 'selected';
    if (disabledIds?.has(id)) return 'disabled';
    return 'normal';
  }

  return (
    <div ref={wrapperRef} className={styles.handWrapper}>
    <div
      ref={setInnerRef}
      className={styles.hand}
      role="group"
      aria-label="Your hand"
      onKeyDown={handleKeyDown}
      style={handScale < 1 ? { transform: `scale(${handScale})`, transformOrigin: 'bottom center' } : undefined}
    >
      <AnimatePresence mode="popLayout">
        {sortedCards.map((gc, i) => (
          <motion.div
            key={gc.id}
            className={styles.cardSlot}
            style={{ '--card-index': i, zIndex: cardStackIndex(i, sortedCards.length, cardOverlap) } as React.CSSProperties}
            layout={enabled}
            initial={enabled ? { opacity: 0, y: 40, scale: 0.8 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={enabled ? { opacity: 0, y: -30, scale: 0.9, transition: { duration: durations.cardPlay } } : undefined}
            transition={{
              duration: durations.cardDeal,
              type: 'spring',
              stiffness: 300,
              damping: 25,
            }}
          >
            <Card
              gameCard={faceDown ? undefined : gc}
              identifierSide={cardIdentifierSide(cardOverlap)}
              state={getState(gc.id)}
              onClick={onCardClick ? () => onCardClick(gc.id) : undefined}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
    </div>
  );
});
