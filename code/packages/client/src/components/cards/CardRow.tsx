'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Combination, GameCard, UserPreferences } from '@tichu/shared';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { Card } from './Card';
import { cardIdentifierSide, cardStackIndex, sortCardsForDisplay, sortCombinationForDisplay } from './card-utils';
import styles from './CardRow.module.css';

interface CardRowProps {
  cards: GameCard[];
  combination?: Combination;
  preferences?: UserPreferences;
  label?: string;
  style?: CSSProperties;
}

// REQ-F-UP04–UP06: Shared non-interactive row for preferences and bomb previews.
export function CardRow({ cards, combination, preferences: override, label = 'Cards', style }: CardRowProps) {
  const saved = usePreferencesStore((s) => s.preferences);
  const preferences = override ?? saved;
  const sorted = combination
    ? sortCombinationForDisplay(combination, preferences.cardOrder, preferences.cardOverlap)
    : sortCardsForDisplay(cards, preferences.cardOrder);
  const wrapper = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const resize = () => {
      if (!wrapper.current || !row.current) return;
      const available = wrapper.current.clientWidth;
      const natural = row.current.scrollWidth;
      if (available && natural) setScale(Math.min(1, available / natural));
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (wrapper.current) observer.observe(wrapper.current);
    return () => observer.disconnect();
  }, [cards.length]);
  return (
    <div ref={wrapper} className={styles.wrapper} role="img" aria-label={label} style={style}>
      <div ref={row} className={styles.row} style={{ transform: `scale(${scale})` }}>
        {sorted.map((gc, index) => (
          <div key={gc.id} className={styles.slot} style={{ zIndex: cardStackIndex(index, sorted.length, preferences.cardOverlap) }}>
            <Card gameCard={gc} identifierSide={cardIdentifierSide(preferences.cardOverlap)} preview />
          </div>
        ))}
      </div>
    </div>
  );
}
