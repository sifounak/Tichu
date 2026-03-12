// REQ-F-DI01: Card component with face rendering and visual states
'use client';

import { memo } from 'react';
import type { Card as CardType, GameCard } from '@tichu/shared';
import {
  SUIT_SYMBOLS,
  RANK_LABELS,
  SPECIAL_LABELS,
  SPECIAL_NAMES,
  suitColor,
  specialColor,
  cardAriaLabel,
} from './card-utils';
import styles from './Card.module.css';

export type CardState = 'normal' | 'selected' | 'disabled' | 'faceDown';

export interface CardProps {
  gameCard?: GameCard;
  state?: CardState;
  onClick?: () => void;
  /** Override width for responsive sizing */
  style?: React.CSSProperties;
  /** REQ-NF-U03: Tab index for roving tabindex keyboard navigation */
  tabIndex?: number;
}

function CardFace({ card }: { card: CardType }) {
  if (card.kind === 'standard') {
    const symbol = SUIT_SYMBOLS[card.suit];
    const label = RANK_LABELS[card.rank];
    const color = suitColor(card.suit);
    return (
      <div className={styles.face} style={{ color }}>
        <span className={styles.rank}>{label}</span>
        <span className={styles.suitCorner}>{symbol}</span>
        <span className={styles.suitCenter}>{symbol}</span>
      </div>
    );
  }

  // Special cards
  const color = specialColor(card.kind);
  const label = SPECIAL_LABELS[card.kind];
  const name = SPECIAL_NAMES[card.kind];
  return (
    <div className={styles.face} style={{ color }}>
      <span className={styles.rank}>{label}</span>
      <span className={styles.specialName}>{name}</span>
    </div>
  );
}

function CardBack() {
  return (
    <div className={styles.back}>
      <div className={styles.backPattern} />
    </div>
  );
}

export const Card = memo(function Card({ gameCard, state = 'normal', onClick, style, tabIndex }: CardProps) {
  const isFaceDown = state === 'faceDown' || !gameCard;
  const isDisabled = state === 'disabled';
  const isSelected = state === 'selected';

  const className = [
    styles.card,
    isSelected && styles.selected,
    isDisabled && styles.disabled,
    isFaceDown && styles.faceDown,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      aria-label={gameCard ? cardAriaLabel(gameCard.card) : 'Face-down card'}
      aria-pressed={isSelected}
      style={style}
      tabIndex={tabIndex}
      data-card-id={gameCard?.id}
    >
      {isFaceDown ? <CardBack /> : <CardFace card={gameCard!.card} />}
    </button>
  );
});
