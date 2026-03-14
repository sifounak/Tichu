// REQ-F-GF09: Grand Tichu decision UI
// REQ-F-GF08: Regular Tichu decision UI
// REQ-F-GF02: Card passing UI
'use client';

import { memo, useState, useCallback } from 'react';
import type { GameCard, Seat, GamePhase, CardId } from '@tichu/shared';
import { getPartner, getNextSeat } from '@tichu/shared';
import { CardHand } from '../cards/CardHand';
import { Card } from '../cards/Card';
import styles from './PreGamePhase.module.css';

export interface PreGamePhaseProps {
  phase: GamePhase;
  myHand: GameCard[];
  mySeat: Seat;
  onGrandTichuDecision: (call: boolean) => void;
  onTichuDecision: () => void;
  onTichuSkip: () => void;
  onPassCards: (cards: Record<Seat, GameCard>) => void;
}

const SEAT_LABELS: Record<Seat, string> = {
  north: 'North', east: 'East', south: 'South', west: 'West',
};

export const PreGamePhase = memo(function PreGamePhase({
  phase,
  myHand,
  mySeat,
  onGrandTichuDecision,
  onTichuDecision,
  onTichuSkip,
  onPassCards,
}: PreGamePhaseProps) {
  // Card passing state
  const [passSelection, setPassSelection] = useState<Map<Seat, GameCard>>(new Map());
  const [activeCardId, setActiveCardId] = useState<CardId | null>(null);

  const partner = getPartner(mySeat);
  const leftOpponent = getNextSeat(getNextSeat(getNextSeat(mySeat)));
  const rightOpponent = getNextSeat(mySeat);

  // IDs of cards already placed in slots
  const placedCardIds = new Set([...passSelection.values()].map((gc) => gc.id));

  // Click a card in hand: select it (or deselect if already selected)
  const handleCardClick = useCallback(
    (id: CardId) => {
      if (placedCardIds.has(id)) return; // can't select already-placed cards
      setActiveCardId((prev) => (prev === id ? null : id));
    },
    [placedCardIds],
  );

  // Click a placeholder slot: place the active card there
  const handleSlotClick = useCallback(
    (seat: Seat) => {
      if (activeCardId === null) {
        // If slot is filled and no card selected, remove the card from this slot
        if (passSelection.has(seat)) {
          const next = new Map(passSelection);
          next.delete(seat);
          setPassSelection(next);
        }
        return;
      }

      const card = myHand.find((gc) => gc.id === activeCardId);
      if (!card) return;

      const next = new Map(passSelection);
      next.set(seat, card);
      setPassSelection(next);
      setActiveCardId(null);
    },
    [activeCardId, myHand, passSelection],
  );

  // Click a filled slot: remove the card and return it to hand
  const handleSlotRemove = useCallback(
    (seat: Seat) => {
      if (!passSelection.has(seat)) return;
      const next = new Map(passSelection);
      next.delete(seat);
      setPassSelection(next);
    },
    [passSelection],
  );

  // Confirm pass when all 3 slots are filled
  const handleConfirmPass = useCallback(() => {
    if (passSelection.size !== 3) return;
    const cards: Record<string, GameCard> = {};
    for (const [seat, gc] of passSelection) {
      cards[seat] = gc;
    }
    onPassCards(cards as Record<Seat, GameCard>);
  }, [passSelection, onPassCards]);

  // Build selected/disabled sets for CardHand
  const selectedIds = new Set<CardId>(activeCardId !== null ? [activeCardId] : []);

  if (phase === 'grandTichuDecision') {
    return (
      <div className={styles.phaseContainer}>
        <div className={styles.prompt}>
          <h2 className={styles.title}>Grand Tichu?</h2>
          <p className={styles.subtitle}>You have seen 8 cards. Declare Grand Tichu (+/- 200)?</p>
          <div className={styles.buttonRow}>
            <button
              className={`${styles.button} ${styles.callButton}`}
              onClick={() => onGrandTichuDecision(true)}
            >
              Grand Tichu!
            </button>
            <button
              className={`${styles.button} ${styles.skipButton}`}
              onClick={() => onGrandTichuDecision(false)}
            >
              Pass
            </button>
          </div>
        </div>
        <div className={styles.handArea}>
          <CardHand cards={myHand} selectedIds={new Set()} />
        </div>
      </div>
    );
  }

  if (phase === 'tichuDecision') {
    return (
      <div className={styles.phaseContainer}>
        <div className={styles.prompt}>
          <h2 className={styles.title}>Tichu?</h2>
          <p className={styles.subtitle}>All 14 cards revealed. Declare Tichu (+/- 100)?</p>
          <div className={styles.buttonRow}>
            <button
              className={`${styles.button} ${styles.callButton}`}
              onClick={onTichuDecision}
            >
              Tichu!
            </button>
            <button
              className={`${styles.button} ${styles.skipButton}`}
              onClick={onTichuSkip}
            >
              Pass
            </button>
          </div>
        </div>
        <div className={styles.handArea}>
          <CardHand cards={myHand} selectedIds={new Set()} />
        </div>
      </div>
    );
  }

  if (phase === 'cardPassing') {
    const allFilled = passSelection.size === 3;

    function renderSlot(seat: Seat) {
      const placed = passSelection.get(seat);
      return (
        <div className={styles.slotWrapper}>
          <span className={styles.slotLabel}>{SEAT_LABELS[seat]}</span>
          <div
            className={`${styles.slot} ${placed ? styles.slotFilled : ''} ${!placed && activeCardId !== null ? styles.slotReady : ''}`}
            onClick={() => placed ? handleSlotRemove(seat) : handleSlotClick(seat)}
            role="button"
            aria-label={placed ? `Remove card from ${SEAT_LABELS[seat]} slot` : `Pass card to ${SEAT_LABELS[seat]}`}
          >
            {placed ? (
              <Card gameCard={placed} state="normal" />
            ) : (
              <span className={styles.slotPlaceholder}>+</span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className={styles.phaseContainer}>
        <div className={styles.prompt}>
          <h2 className={styles.title}>Pass Cards</h2>
          <p className={styles.subtitle}>
            {activeCardId !== null
              ? 'Click a slot to place the selected card'
              : allFilled
                ? 'Ready to pass!'
                : 'Select a card, then click a slot to assign it'}
          </p>
        </div>

        {/* Placeholder layout matching player positions */}
        <div className={styles.passLayout}>
          <div className={styles.passTop}>
            {renderSlot(partner)}
          </div>
          <div className={styles.passMiddle}>
            <div className={styles.passLeft}>
              {renderSlot(leftOpponent)}
            </div>
            <div className={styles.passRight}>
              {renderSlot(rightOpponent)}
            </div>
          </div>
        </div>

        {allFilled && (
          <button
            className={`${styles.button} ${styles.callButton}`}
            onClick={handleConfirmPass}
          >
            Confirm Pass
          </button>
        )}

        <div className={styles.handArea}>
          <CardHand
            cards={myHand}
            selectedIds={selectedIds}
            disabledIds={placedCardIds}
            onCardClick={handleCardClick}
          />
        </div>
      </div>
    );
  }

  return null;
});
