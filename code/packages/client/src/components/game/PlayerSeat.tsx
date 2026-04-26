// REQ-F-DI01: Player seat showing avatar, card count, Tichu indicator, pass status
'use client';

import { memo, useRef, useState } from 'react';
import type { Seat, TichuCall } from '@tichu/shared';
import { Card } from '../cards/Card';
import { TurnTimer } from './TurnTimer';
import { useTurnTimer } from '@/hooks/useTurnTimer';
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
  /** REQ-F-PV03: Kick vote target selection mode — red glow + "Kick Player" label */
  kickVoteTarget?: boolean;
  /** REQ-F-PV10/PV11: Player vote status — true=approve (green), false=reject (red), null=pending */
  playerVoteStatus?: boolean | null;
  /** REQ-F-PV10/PV11: Label for the player vote status (e.g., "Voted: Kick") */
  playerVoteLabel?: string;
  /** REQ-F-PV09: Hide normal labels (turn/leader/pass) during active vote */
  hideNormalLabels?: boolean;
  /** REQ-F-VI05: Host can add a bot to a vacated seat mid-game */
  onAddBot?: () => void;
  /** REQ-F-TT05: Epoch ms when turn timer started, null when disabled/stopped */
  turnTimerStartedAt?: number | null;
  /** REQ-F-TT05: Total turn timer duration in ms, null when disabled/stopped */
  turnTimerDurationMs?: number | null;
  /** Clock offset for correcting server timestamps */
  serverClockOffsetMs?: number;
  /** True when another player went out first, breaking this player's Tichu call */
  tichuFailed?: boolean;
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
  kickVoteTarget,
  playerVoteStatus,
  playerVoteLabel,
  hideNormalLabels,
  onAddBot,
  turnTimerStartedAt,
  turnTimerDurationMs,
  serverClockOffsetMs,
  tichuFailed,
}: PlayerSeatProps) {
  // REQ-F-ES01: Empty seat shows "Empty Seat" label
  const name = emptySeat ? 'Empty Seat' : (displayName ?? SEAT_LABELS[seat]);
  const [hovered, setHovered] = useState(false);
  const seatRef = useRef<HTMLDivElement>(null);

  // REQ-F-TT06: Client-side turn timer countdown
  const timer = useTurnTimer(turnTimerStartedAt, turnTimerDurationMs, serverClockOffsetMs);

  // dragonTarget = always-on purple glow; dragonHoverTarget = purple glow only on hover
  const isDragonActive = dragonTarget || (dragonHoverTarget && hovered);
  const isClickableDragon = dragonTarget || dragonHoverTarget;

  // REQ-F-TT03: Timer stage determines seat glow class when active
  const timerActive = isCurrentTurn && timer.isActive;
  const timerGlowClass = timerActive
    ? timer.stage === 'red' ? `${styles.timerRed} ${styles.timerRedPulse}`
      : timer.stage === 'amber' ? styles.timerAmber
      : styles.timerNoGlow // blue stage = no glow, let the ring be the indicator
    : styles.active;

  const className = [
    styles.seat,
    // REQ-F-PV10/PV11: Player vote glows take priority during active vote
    kickVoteTarget && styles.kickVoteTarget,
    playerVoteStatus === true && styles.voteApprove,
    playerVoteStatus === false && styles.voteReject,
    // REQ-F-ES04: Vote glow overrides normal turn/leader glows during active vote
    !kickVoteTarget && playerVoteStatus == null && voteStatus === 'wait' && styles.voteWait,
    !kickVoteTarget && playerVoteStatus == null && voteStatus === 'kick' && styles.voteKick,
    !kickVoteTarget && playerVoteStatus == null && !voteStatus && isCurrentTurn && timerGlowClass,
    !kickVoteTarget && playerVoteStatus == null && !voteStatus && isTrickLeader && styles.trickLeader,
    hasPassed && styles.passed,
    isMe && styles.me,
    isDragonActive && styles.dragonTarget,
    passConfirmed && styles.passConfirmed,
    emptySeat && styles.emptySeat,
    vacated && styles.vacated,
  ].filter(Boolean).join(' ');

  // Custom content mode — same .seat container, custom inner content
  // Preserves kickVoteTarget click handling so pre-game kick vote works
  if (customContent) {
    return (
      <div
        ref={seatRef}
        className={className}
        data-seat={seat}
        aria-label={kickVoteTarget ? `Kick ${name}` : `${name}'s seat`}
        onClick={kickVoteTarget ? onSeatClick : undefined}
        role={kickVoteTarget ? 'button' : undefined}
        style={kickVoteTarget ? { cursor: 'pointer' } : undefined}
      >
        {timerActive && <TurnTimer remainingSeconds={timer.remainingSeconds} totalSeconds={timer.totalSeconds} stage={timer.stage} seatRef={seatRef} />}
        {customContent}
      </div>
    );
  }

  return (
    <div
      ref={seatRef}
      className={className}
      data-seat={seat}
      aria-label={kickVoteTarget ? `Kick ${name}` : isClickableDragon ? `Give Dragon trick to ${name}` : `${name}'s seat`}
      onClick={kickVoteTarget ? onSeatClick : isClickableDragon ? onSeatClick : undefined}
      role={kickVoteTarget || isClickableDragon ? 'button' : undefined}
      style={kickVoteTarget || isClickableDragon ? { cursor: 'pointer' } : undefined}
      onMouseEnter={dragonHoverTarget ? () => setHovered(true) : undefined}
      onMouseLeave={dragonHoverTarget ? () => setHovered(false) : undefined}
    >
      {/* REQ-F-TT02: Depleting SVG border ring overlay */}
      {timerActive && <TurnTimer remainingSeconds={timer.remainingSeconds} totalSeconds={timer.totalSeconds} stage={timer.stage} seatRef={seatRef} />}
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
      {tichuCall !== 'none' && (() => {
        const tichuSucceeded = finishOrder === 1;
        const label = tichuCall === 'grandTichu' ? 'Grand Tichu' : 'Tichu';
        return (
          <div
            className={`${styles.tichuBanner} ${tichuCall === 'grandTichu' ? styles.grandTichu : styles.tichu} ${tichuFailed ? styles.tichuFailed : tichuSucceeded ? styles.tichuSucceeded : ''}`}
            aria-label={tichuFailed ? `${label} failed` : tichuSucceeded ? `${label} succeeded` : `${label} called`}
          >
            {tichuFailed ? <>😩 <span className={styles.tichuStrike}>{label}</span> 😩</> : tichuSucceeded ? `🥳 ${label} 🥳` : label}
          </div>
        );
      })()}

      {/* REQ-F-PV03: Kick target selection label */}
      {kickVoteTarget && (
        <span className={styles.playerVoteLabel} style={{ color: '#e74c3c' }}>Kick Player</span>
      )}

      {/* REQ-F-PV10/PV11: Player vote status label */}
      {!kickVoteTarget && playerVoteLabel && playerVoteStatus != null && (
        <span className={styles.playerVoteLabel} style={{ color: playerVoteStatus ? '#2ecc71' : '#e74c3c' }}>{playerVoteLabel}</span>
      )}

      {/* REQ-F-PV09: Normal labels hidden during active vote */}
      {/* REQ-F-DI03: Pass indicator — label below box (hidden for active dragon targets) */}
      {!hideNormalLabels && hasPassed && !hideTrickLabels && !isDragonActive && (
        <span className={styles.passLabel} aria-label="Passed">
          Pass
        </span>
      )}

      {/* Turn indicator — REQ-F-TT01: Countdown badge left of label */}
      {!hideNormalLabels && isCurrentTurn && !isDragonActive && (
        <span className={`${styles.turnLabel} ${timerActive && timer.stage === 'red' ? styles.turnLabelRed : ''}`}>
          {timerActive && (
            <span className={`${styles.timerBadge} ${
              timer.stage === 'red' ? styles.timerBadgeRed
              : timer.stage === 'amber' ? styles.timerBadgeAmber
              : styles.timerBadgeBlue
            }`}>{timer.remainingSeconds}</span>
          )}{' '}
          {isMe ? 'Your Turn' : 'Their Turn'}
        </span>
      )}

      {/* Dragon gift target label — shown for always-on targets and hovered targets */}
      {isDragonActive && (
        <span className={styles.dragonLabel}>Give Dragon</span>
      )}

      {/* Trick leader label (hidden for active dragon targets) */}
      {!hideNormalLabels && isTrickLeader && !isCurrentTurn && !hasPassed && !hideTrickLabels && !isDragonActive && (
        <span className={styles.leaderLabel}>Leading Trick</span>
      )}

      {/* Card pass confirmed label */}
      {!hideNormalLabels && passConfirmed && (
        <span className={styles.passConfirmedLabel}>{passConfirmedLabel ?? 'Ready to Pass'}</span>
      )}

      {/* REQ-F-ES04: Vote status label — overrides other labels during active vote */}
      {!hideNormalLabels && voteStatus === 'wait' && (
        <span className={styles.voteLabel} style={{ color: '#2ecc71' }}>Vote: Wait</span>
      )}
      {!hideNormalLabels && voteStatus === 'kick' && (
        <span className={styles.voteLabel} style={{ color: '#e74c3c' }}>Vote: Kick</span>
      )}

      {/* Vacated seat overlay */}
      {vacated && !seatChooserLabel && (
        <div className={styles.vacatedOverlay}>
          Waiting for player to join
          {/* REQ-F-VI05: Host can add a bot to fill vacated seat */}
          {onAddBot && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddBot(); }}
              style={{
                marginTop: 'var(--space-2)',
                padding: 'calc(6px * var(--scale)) calc(20px * var(--scale))',
                borderRadius: 'var(--space-2)',
                fontSize: 'var(--font-base)',
                fontWeight: 600,
                background: 'var(--color-success, #2ecc71)',
                color: '#000',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Add Bot
            </button>
          )}
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
