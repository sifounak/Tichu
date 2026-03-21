// REQ-F-DI01: Player seat showing avatar, card count, Tichu indicator, pass status
'use client';

import { memo, useState } from 'react';
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
  /** REQ-F-DR01: Highlight as a Dragon gift target (always-on purple glow) */
  dragonTarget?: boolean;
  /** Dragon gift target that only activates on hover (for finished opponents) */
  dragonHoverTarget?: boolean;
  /** Callback when seat is clicked (e.g., for Dragon gift selection) */
  onSeatClick?: () => void;
  /** Hide Pass/Leader labels during Dragon recipient selection to avoid overlap */
  hideTrickLabels?: boolean;
  /** Green glow when player has confirmed card pass */
  passConfirmed?: boolean;
  /** Override the "Ready to Pass" label text (e.g. "Ready to Play" in pre-room) */
  passConfirmedLabel?: string;
  /** REQ-F-ES01: Seat is empty — player left, shows "Empty Seat" with preserved game state */
  emptySeat?: boolean;
  /** REQ-F-ES04: Vote status glow — 'wait' = green, 'kick' = red, null = normal */
  voteStatus?: 'wait' | 'kick' | null;
  /** Seat is vacated — player left mid-game, waiting for replacement */
  vacated?: boolean;
  /** Seat chooser button label (e.g. "Sit Here" or "Choose This Seat") */
  seatChooserLabel?: string;
  /** Callback when the seat chooser button is clicked */
  onChooseSeat?: () => void;
  /** Custom content replacing the default name/avatar/cards (for pre-room empty/bot seats) */
  customContent?: React.ReactNode;
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
  dragonHoverTarget,
  onSeatClick,
  hideTrickLabels,
  passConfirmed,
  emptySeat,
  voteStatus,
  vacated,
  seatChooserLabel,
  onChooseSeat,
  customContent,
  passConfirmedLabel,
}: PlayerSeatProps) {
  // REQ-F-ES01: Empty seat shows "Empty Seat" label
  const name = emptySeat ? 'Empty Seat' : (displayName ?? SEAT_LABELS[seat]);
  const [hovered, setHovered] = useState(false);

  // dragonTarget = always-on purple glow; dragonHoverTarget = purple glow only on hover
  const isDragonActive = dragonTarget || (dragonHoverTarget && hovered);
  const isClickableDragon = dragonTarget || dragonHoverTarget;

  const className = [
    styles.seat,
    // REQ-F-ES04: Vote glow overrides normal turn/leader glows during active vote
    voteStatus === 'wait' && styles.voteWait,
    voteStatus === 'kick' && styles.voteKick,
    !voteStatus && isCurrentTurn && styles.active,
    !voteStatus && isTrickLeader && styles.trickLeader,
    hasPassed && styles.passed,
    isMe && styles.me,
    isDragonActive && styles.dragonTarget,
    passConfirmed && styles.passConfirmed,
    emptySeat && styles.emptySeat,
    vacated && styles.vacated,
  ].filter(Boolean).join(' ');

  // Custom content mode — same .seat container, custom inner content
  if (customContent) {
    return (
      <div className={className} data-seat={seat} aria-label={`${name}'s seat`}>
        {customContent}
      </div>
    );
  }

  return (
    <div
      className={className}
      data-seat={seat}
      aria-label={isClickableDragon ? `Give Dragon trick to ${name}` : `${name}'s seat`}
      onClick={isClickableDragon ? onSeatClick : undefined}
      role={isClickableDragon ? 'button' : undefined}
      style={isClickableDragon ? { cursor: 'pointer' } : undefined}
      onMouseEnter={dragonHoverTarget ? () => setHovered(true) : undefined}
      onMouseLeave={dragonHoverTarget ? () => setHovered(false) : undefined}
    >
      <span className={styles.name}>{name}</span>
      <div className={styles.seatRow}>
        {/* Avatar — REQ-F-ES01: Empty circle for empty seats */}
        <div className={`${styles.avatar} ${emptySeat ? styles.emptyAvatar : ''}`}>
          {emptySeat ? null : finishOrder !== null ? (
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

      {/* REQ-F-DI03: Pass indicator — label below box (hidden for active dragon targets) */}
      {hasPassed && !hideTrickLabels && !isDragonActive && (
        <span className={styles.passLabel} aria-label="Passed">
          Pass
        </span>
      )}

      {/* Turn indicator */}
      {isCurrentTurn && !isDragonActive && (
        <span className={styles.turnLabel}>{isMe ? 'Your Turn' : 'Their Turn'}</span>
      )}

      {/* Dragon gift target label — shown for always-on targets and hovered targets */}
      {isDragonActive && (
        <span className={styles.dragonLabel}>Give Dragon</span>
      )}

      {/* Trick leader label (hidden for active dragon targets) */}
      {isTrickLeader && !isCurrentTurn && !hasPassed && !hideTrickLabels && !isDragonActive && (
        <span className={styles.leaderLabel}>Leading Trick</span>
      )}

      {/* Card pass confirmed label */}
      {passConfirmed && (
        <span className={styles.passConfirmedLabel}>{passConfirmedLabel ?? 'Ready to Pass'}</span>
      )}

      {/* REQ-F-ES04: Vote status label — overrides other labels during active vote */}
      {voteStatus === 'wait' && (
        <span className={styles.voteLabel} style={{ color: '#2ecc71' }}>Vote: Wait</span>
      )}
      {voteStatus === 'kick' && (
        <span className={styles.voteLabel} style={{ color: '#e74c3c' }}>Vote: Kick</span>
      )}

      {/* Vacated seat overlay */}
      {vacated && !emptySeat && !seatChooserLabel && (
        <div className={styles.vacatedOverlay}>
          Waiting for player to join
        </div>
      )}

      {/* Seat chooser button (mid-game join with multiple vacant seats) */}
      {seatChooserLabel && onChooseSeat && (
        <div className={styles.seatChooserOverlay}>
          <button className={styles.seatChooserButton} onClick={onChooseSeat}>
            {seatChooserLabel}
          </button>
        </div>
      )}
    </div>
  );
});
