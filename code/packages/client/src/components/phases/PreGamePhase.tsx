// REQ-F-GF09: Grand Tichu decision UI
// REQ-F-GF08: Regular Tichu decision UI
// REQ-F-GF02: Card passing UI
'use client';

import { memo, useState, useCallback } from 'react';
import type { GameCard, Seat, GamePhase, CardId } from '@tichu/shared';
import { getPartner, getNextSeat } from '@tichu/shared';
import { CardHand } from '../cards/CardHand';
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

export const PreGamePhase = memo(function PreGamePhase({
  phase,
  myHand,
  mySeat,
  onGrandTichuDecision,
  onTichuDecision,
  onTichuSkip,
  onPassCards,
}: PreGamePhaseProps) {
  const [passSelection, setPassSelection] = useState<Map<Seat, GameCard>>(new Map());
  const [selectedCardIds, setSelectedCardIds] = useState<Set<CardId>>(new Set());

  // Card passing: need to assign 1 card to each of the 3 other players
  const partner = getPartner(mySeat);
  const leftOpponent = getNextSeat(getNextSeat(getNextSeat(mySeat)));
  const rightOpponent = getNextSeat(mySeat);
  const passTargets: Seat[] = [leftOpponent, partner, rightOpponent];
  const currentTarget = passTargets[passSelection.size] ?? null;

  const handlePassCardClick = useCallback(
    (id: CardId) => {
      if (!currentTarget) return;
      const card = myHand.find((gc) => gc.id === id);
      if (!card) return;
      // Don't allow selecting the same card twice
      const alreadySelected = [...passSelection.values()].some((gc) => gc.id === id);
      if (alreadySelected) return;

      const next = new Map(passSelection);
      next.set(currentTarget, card);
      setPassSelection(next);
      setSelectedCardIds((prev) => {
        const s = new Set(prev);
        s.add(id);
        return s;
      });

      // If all 3 selected, auto-submit
      if (next.size === 3) {
        const cards: Record<string, GameCard> = {};
        for (const [seat, gc] of next) {
          cards[seat] = gc;
        }
        onPassCards(cards as Record<Seat, GameCard>);
      }
    },
    [currentTarget, myHand, passSelection, onPassCards],
  );

  const handleUndoPass = useCallback(() => {
    if (passSelection.size === 0) return;
    const entries = [...passSelection.entries()];
    const removed = entries.pop()!;
    setPassSelection(new Map(entries));
    setSelectedCardIds((prev) => {
      const s = new Set(prev);
      s.delete(removed[1].id);
      return s;
    });
  }, [passSelection]);

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
    const SEAT_LABELS: Record<Seat, string> = {
      north: 'North', east: 'East', south: 'South', west: 'West',
    };

    return (
      <div className={styles.phaseContainer}>
        <div className={styles.prompt}>
          <h2 className={styles.title}>Pass Cards</h2>
          {currentTarget ? (
            <p className={styles.subtitle}>
              Select a card to pass to <strong>{SEAT_LABELS[currentTarget]}</strong>
              {' '}({passSelection.size}/3)
            </p>
          ) : (
            <p className={styles.subtitle}>Waiting for other players...</p>
          )}
          {passSelection.size > 0 && currentTarget && (
            <button className={styles.undoButton} onClick={handleUndoPass}>
              Undo last
            </button>
          )}
        </div>
        <div className={styles.handArea}>
          <CardHand
            cards={myHand}
            selectedIds={selectedCardIds}
            onCardClick={currentTarget ? handlePassCardClick : undefined}
          />
        </div>
      </div>
    );
  }

  return null;
});
