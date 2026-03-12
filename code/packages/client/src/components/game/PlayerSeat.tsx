// REQ-F-DI01: Player seat showing avatar, card count, Tichu indicator, pass status
'use client';

import { memo } from 'react';
import type { Seat, TichuCall } from '@tichu/shared';
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
  isMe: boolean;
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
  isMe,
}: PlayerSeatProps) {
  const name = displayName ?? SEAT_LABELS[seat];

  return (
    <div
      className={`${styles.seat} ${isCurrentTurn ? styles.active : ''} ${isMe ? styles.me : ''}`}
      data-seat={seat}
      aria-label={`${name}'s seat`}
    >
      {/* Avatar placeholder */}
      <div className={styles.avatar}>
        {finishOrder !== null ? (
          <span className={styles.finishBadge}>#{finishOrder}</span>
        ) : (
          <span className={styles.initial}>{name[0].toUpperCase()}</span>
        )}
      </div>

      <div className={styles.info}>
        <span className={styles.name}>{name}</span>
        <span className={styles.cardCount}>
          {finishOrder !== null ? 'Out' : `${cardCount} cards`}
        </span>
      </div>

      {/* REQ-F-DI04: Tichu/Grand Tichu call indicator */}
      {tichuCall !== 'none' && (
        <span
          className={`${styles.tichuBadge} ${tichuCall === 'grandTichu' ? styles.grandTichu : styles.tichu}`}
          aria-label={tichuCall === 'grandTichu' ? 'Grand Tichu called' : 'Tichu called'}
        >
          {tichuCall === 'grandTichu' ? 'GT' : 'T'}
        </span>
      )}

      {/* REQ-F-DI03: Pass indicator */}
      {hasPassed && (
        <span className={styles.passIndicator} aria-label="Passed">
          Pass
        </span>
      )}

      {/* Active turn indicator */}
      {isCurrentTurn && <div className={styles.turnIndicator} />}
    </div>
  );
});
