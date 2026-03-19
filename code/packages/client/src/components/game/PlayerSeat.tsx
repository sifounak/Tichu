// REQ-F-DI01: Player seat showing avatar, card count, Tichu indicator, pass status
'use client';

import { memo } from 'react';
import type { Seat, TichuCall } from '@tichu/shared';
import { Card } from '../cards/Card';
import styles from './PlayerSeat.module.css';

export interface PlayerSeatProps {
  seat: Seat;
  displayName?: string;
  cardCount: number;
  tichuCall: TichuCall;
  hasPlayed: boolean;
  hasPassed: boolean;
  finishOrder: number | null;
  isCurrentTurn: boolean;
  isTrickLeader: boolean;
  isMe: boolean;
  /** REQ-F-DR01: Highlight as a Dragon gift target */
  dragonTarget?: boolean;
  /** Callback when seat is clicked (e.g., for Dragon gift selection) */
  onSeatClick?: () => void;
  /** Hide Pass/Leader labels during Dragon recipient selection to avoid overlap */
  hideTrickLabels?: boolean;
  /** Green glow when player has confirmed card pass */
  passConfirmed?: boolean;
}

const SEAT_LABELS: Record<Seat, string> = {
  north: 'North',
  east: 'East',
  south: 'South',
  west: 'West',
};

export const PlayerSeat = memo(function PlayerSeat({
  seat,
  displayName,
  cardCount,
  tichuCall,
  hasPassed,
  finishOrder,
  isCurrentTurn,
  isTrickLeader,
  isMe,
  dragonTarget,
  onSeatClick,
  hideTrickLabels,
  passConfirmed,
}: PlayerSeatProps) {
  const name = displayName ?? SEAT_LABELS[seat];

  const className = [
    styles.seat,
    isCurrentTurn && styles.active,
    isTrickLeader && styles.trickLeader,
    hasPassed && styles.passed,
    isMe && styles.me,
    dragonTarget && styles.dragonTarget,
    passConfirmed && styles.passConfirmed,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={className}
      data-seat={seat}
      aria-label={dragonTarget ? `Give Dragon trick to ${name}` : `${name}'s seat`}
      onClick={dragonTarget ? onSeatClick : undefined}
      role={dragonTarget ? 'button' : undefined}
      style={dragonTarget ? { cursor: 'pointer' } : undefined}
    >
      <span className={styles.name}>{name}</span>
      <div className={styles.seatRow}>
        {/* Avatar */}
        <div className={styles.avatar}>
          {finishOrder !== null ? (
            <span className={styles.finishBadge}>#{finishOrder}</span>
          ) : (
            <span className={styles.initial}>{name[0].toUpperCase()}</span>
          )}
        </div>

        <div className={styles.info}>
          {!isMe && finishOrder === null && cardCount > 0 ? (
            <div className={styles.cardStack}>
              {Array.from({ length: Math.min(cardCount, 4) }, (_, i) => (
                <div key={i} className={styles.stackCard}>
                  <Card state="faceDown" style={{ width: 'calc(60px * var(--scale))', height: 'calc(86px * var(--scale))' }} />
                </div>
              ))}
              <span className={styles.countBadge}>{cardCount}</span>
            </div>
          ) : (
            <span className={styles.cardCount}>
              {finishOrder !== null ? 'Out' : `${cardCount} cards`}
            </span>
          )}
        </div>
      </div>

      {/* REQ-F-DI04: Tichu/Grand Tichu call indicator — red banner above box */}
      {tichuCall !== 'none' && (
        <div
          className={`${styles.tichuBanner} ${tichuCall === 'grandTichu' ? styles.grandTichu : styles.tichu}`}
          aria-label={tichuCall === 'grandTichu' ? 'Grand Tichu called' : 'Tichu called'}
        >
          {tichuCall === 'grandTichu' ? 'Grand Tichu' : 'Tichu'}
        </div>
      )}

      {/* REQ-F-DI03: Pass indicator — label below box (hidden during Dragon gift selection) */}
      {hasPassed && !hideTrickLabels && (
        <span className={styles.passLabel} aria-label="Passed">
          Pass
        </span>
      )}

      {/* Turn indicator */}
      {isCurrentTurn && !dragonTarget && (
        <span className={styles.turnLabel}>{isMe ? 'Your Turn' : 'Their Turn'}</span>
      )}

      {/* Dragon gift target label */}
      {dragonTarget && (
        <span className={styles.dragonLabel}>Give Dragon</span>
      )}

      {/* Trick leader label (hidden during Dragon gift selection) */}
      {isTrickLeader && !isCurrentTurn && !hasPassed && !hideTrickLabels && (
        <span className={styles.leaderLabel}>Leading Trick</span>
      )}

      {/* Card pass confirmed label */}
      {passConfirmed && (
        <span className={styles.passConfirmedLabel}>Ready to Pass</span>
      )}
    </div>
  );
});
