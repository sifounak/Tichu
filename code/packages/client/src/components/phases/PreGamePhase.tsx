// REQ-F-GF09: Grand Tichu decision UI
// REQ-F-GF02: Card passing UI
// REQ-F-GT03: Per-player status row when undecided
// REQ-F-GT04: Waiting screen when decided
// REQ-F-GT05: Visual distinction for Grand Tichu callers
'use client';

import { memo } from 'react';
import type { GameCard, Seat, GamePhase, CardId } from '@tichu/shared';
import { getPartner, getNextSeat } from '@tichu/shared';
import { Card } from '../cards/Card';
import styles from './PreGamePhase.module.css';

export interface PreGamePhaseProps {
  phase: GamePhase;
  mySeat: Seat;
  onGrandTichuDecision: (call: boolean) => void;
  // Card passing (state lifted to parent)
  passSelection: Map<Seat, GameCard>;
  activeCardId: CardId | null;
  onSlotClick: (seat: Seat) => void;
  onSlotRemove: (seat: Seat) => void;
  onConfirmPass: () => void;
  passConfirmed: boolean;
  onCancelPass: () => void;
  // Received cards display (after exchange)
  receivedCards?: Record<Seat, GameCard | null>;
  onDismissReceived?: () => void;
  seatNames?: Record<Seat, string>;
  /** Seats that have made their Grand Tichu decision */
  grandTichuDecided?: Seat[];
  /** Current player's tichu call — used to show decision in waiting screen (REQ-F-GT04) */
  myTichuCall?: string;
}

const SEAT_LABELS: Record<Seat, string> = {
  north: 'North', east: 'East', south: 'South', west: 'West',
};

export const PreGamePhase = memo(function PreGamePhase({
  phase,
  mySeat,
  onGrandTichuDecision,
  passSelection,
  activeCardId,
  onSlotClick,
  onSlotRemove,
  onConfirmPass,
  passConfirmed,
  onCancelPass,
  receivedCards,
  onDismissReceived,
  seatNames,
  grandTichuDecided,
  myTichuCall,
}: PreGamePhaseProps) {
  const partner = getPartner(mySeat);
  const leftOpponent = getNextSeat(getNextSeat(getNextSeat(mySeat)));
  const rightOpponent = getNextSeat(mySeat);

  if (phase === 'grandTichuDecision') {
    const decidedSet = new Set(grandTichuDecided ?? []);
    const hasDecided = decidedSet.has(mySeat);

    // REQ-F-GT04: waiting screen once this player has decided
    if (hasDecided) {
      const myCalledGT = myTichuCall === 'grandTichu';
      return (
        <div className={styles.phaseContainer}>
          <div className={styles.prompt}>
            <h2 className={`${styles.title} ${myCalledGT ? styles.titleGrandTichu : ''}`}>
              {myCalledGT ? 'Grand Tichu Called!' : 'You passed.'}
            </h2>
            <p className={styles.subtitle}>Waiting for other players…</p>
          </div>
        </div>
      );
    }

    // REQ-F-GT03: undecided — show buttons
    return (
      <div className={styles.phaseContainer}>
        <div className={styles.prompt}>
          <h2 className={styles.title}>Grand Tichu?</h2>
          <p className={styles.subtitle}>You have seen 8 cards. Declare Grand Tichu (+/- 200)?</p>
          <div className={styles.buttonRow}>
            <button
              className={`${styles.button} ${styles.skipButton}`}
              onClick={() => onGrandTichuDecision(false)}
            >
              Pass
            </button>
            <button
              className={`${styles.button} ${styles.callButton}`}
              onClick={() => onGrandTichuDecision(true)}
            >
              Grand Tichu!
            </button>
          </div>
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
          <span className={styles.slotLabel}>{seatNames?.[seat] ?? SEAT_LABELS[seat]}</span>
          <div
            className={`${styles.slot} ${placed ? styles.slotFilled : ''} ${!placed && activeCardId !== null ? styles.slotReady : ''}`}
            onClick={() => (placed && activeCardId === null) ? onSlotRemove(seat) : onSlotClick(seat)}
            role="button"
            aria-label={placed ? `Remove card from ${seatNames?.[seat] ?? SEAT_LABELS[seat]} slot` : `Pass card to ${seatNames?.[seat] ?? SEAT_LABELS[seat]}`}
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
            {passConfirmed
              ? 'Waiting for other players...'
              : activeCardId !== null
                ? 'Click a slot to place the selected card'
                : allFilled
                  ? 'Ready to pass!'
                  : 'Select a card, then click a slot to assign it'}
          </p>
        </div>

        {/* Placeholder layout: left card | (top card + button) | right card, bottom-aligned */}
        <div className={styles.passMiddle}>
          <div className={styles.passLeft}>
            {renderSlot(leftOpponent)}
          </div>
          <div className={styles.passCenter}>
            {renderSlot(partner)}
            {!passConfirmed ? (
              <button
                className={`${styles.button} ${styles.callButton}`}
                onClick={onConfirmPass}
                disabled={!allFilled}
                style={!allFilled ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
              >
                Confirm Pass
              </button>
            ) : (
              <button
                className={`${styles.button} ${styles.skipButton}`}
                onClick={onCancelPass}
              >
                Cancel Pass
              </button>
            )}
          </div>
          <div className={styles.passRight}>
            {renderSlot(rightOpponent)}
          </div>
        </div>
      </div>
    );
  }

  // Received cards display — shown after card exchange
  if (receivedCards && onDismissReceived) {
    const rc = receivedCards;
    function renderReceivedSlot(seat: Seat) {
      const card = rc[seat];
      if (!card) return null;
      return (
        <div className={styles.slotWrapper}>
          <span className={styles.slotLabel}>{seatNames?.[seat] ?? SEAT_LABELS[seat]}</span>
          <div className={`${styles.slot} ${styles.slotFilled}`}>
            <Card gameCard={card} state="normal" />
          </div>
        </div>
      );
    }

    return (
      <div className={styles.phaseContainer}>
        <div className={styles.passMiddle}>
          <div className={styles.passLeft}>
            {renderReceivedSlot(leftOpponent)}
          </div>
          <div className={styles.passCenter}>
            {renderReceivedSlot(partner)}
            <button
              className={`${styles.button} ${styles.skipButton}`}
              onClick={onDismissReceived}
            >
              Dismiss
            </button>
          </div>
          <div className={styles.passRight}>
            {renderReceivedSlot(rightOpponent)}
          </div>
        </div>
      </div>
    );
  }

  return null;
});
