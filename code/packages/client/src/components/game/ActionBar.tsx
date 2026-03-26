// REQ-F-HV06: Play/Pass action buttons with validity enforcement
// REQ-F-DI04: Tichu call button during appropriate phases
// REQ-NF-U02: Invalid play shake animation
// REQ-F-BI09: Bomb button for out-of-turn play
'use client';

import { memo, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { GamePhase, TichuCall } from '@tichu/shared';
import styles from './ActionBar.module.css';

export interface ActionBarProps {
  /** Whether the current selection forms a valid play */
  canPlay: boolean;
  /** Whether the player can pass this turn */
  canPass: boolean;
  /** Whether it's the player's turn */
  isMyTurn: boolean;
  /** Current game phase */
  phase: GamePhase;
  /** Player's current Tichu call */
  myTichuCall: TichuCall;
  /** Whether player has played any cards this round */
  hasPlayedCards: boolean;
  /** REQ-F-BI09: Whether the player has a valid bomb selected (for out-of-turn play) */
  hasBombReady: boolean;
  /** Callbacks */
  onPlay: () => void;
  onPass: () => void;
  onTichu: () => void;
  onBomb: () => void;
  /** REQ-F-BW01: Whether a play is queued during bomb window */
  playQueued?: boolean;
  /** REQ-F-AP01: Auto-pass toggle state */
  autoPassEnabled?: boolean;
  /** REQ-F-AP01: Auto-pass toggle callback */
  onAutoPassToggle?: (enabled: boolean) => void;
  /** REQ-F-AP01/AP02: Whether to show the auto-pass toggle */
  showAutoPass?: boolean;
  /** Layout mode: 'default' stacks vertically, 'split' puts Pass | playerSeat | Play in a row */
  layout?: 'default' | 'split';
  /** Player seat element to render between Pass and Play in split layout */
  playerSeat?: ReactNode;
}

export const ActionBar = memo(function ActionBar({
  canPlay,
  canPass,
  isMyTurn,
  phase,
  myTichuCall: _myTichuCall,
  hasPlayedCards: _hasPlayedCards,
  hasBombReady,
  onPlay,
  onPass,
  onTichu,
  onBomb,
  playQueued,
  autoPassEnabled = false,
  onAutoPassToggle,
  showAutoPass = false,
  layout = 'default',
  playerSeat,
}: ActionBarProps) {
  const isPlaying = phase === 'playing';
  const showActions = isPlaying && isMyTurn;
  const [shaking, setShaking] = useState(false);

  // Tichu button moved to card hand area (left of cards)
  const canCallTichu = false;

  const handlePlay = useCallback(() => {
    if (!canPlay) {
      setShaking(true);
      setTimeout(() => setShaking(false), 300);
      return;
    }
    onPlay();
  }, [canPlay, onPlay]);

  // REQ-F-AP01: Show standard Pass only when it's my turn AND auto-pass is off
  const passButton = showActions && !autoPassEnabled && (
    <button
      className={`${styles.button} ${styles.passButton}`}
      onClick={onPass}
      disabled={!canPass}
      aria-label="Pass turn"
    >
      Pass
    </button>
  );

  const playButton = showActions && (
    <button
      className={`${styles.button} ${styles.playButton} ${playQueued ? styles.queued : ''}`}
      onClick={handlePlay}
      disabled={!canPlay}
      aria-label={playQueued ? 'Play queued' : 'Play selected cards'}
    >
      {playQueued ? 'Queued' : 'Play'}
    </button>
  );

  const bombButton = !isMyTurn && isPlaying && hasBombReady && (
    <button
      className={`${styles.button} ${styles.bombButton}`}
      onClick={onBomb}
      aria-label="Play bomb"
    >
      Bomb!
    </button>
  );

  // REQ-F-AP01: Auto-pass toggle replaces Pass button.
  // Show when: not my turn (default position), OR my turn with auto-pass enabled (stays visible).
  // Hidden when: my turn with auto-pass off (standard Pass button shown instead).
  const showAutoPassToggle = showAutoPass && onAutoPassToggle && (!showActions || autoPassEnabled);
  const autoPassToggle = showAutoPassToggle && (
    <label
      className={`${styles.autoPassLabel} ${autoPassEnabled ? styles.autoPassActive : ''}`}
    >
      <input
        type="checkbox"
        checked={autoPassEnabled}
        onChange={(e) => onAutoPassToggle(e.target.checked)}
        className={styles.autoPassCheckbox}
        aria-label="Auto-pass until next trick"
      />
      Auto<br />Pass
    </label>
  );

  const tichuBtn = canCallTichu && (
    <button
      className={`${styles.button} ${styles.tichuButton}`}
      onClick={onTichu}
      aria-label="Declare Tichu"
    >
      Tichu!
    </button>
  );

  if (layout === 'split') {
    return (
      <div
        className={`${styles.actionBar} ${styles.splitLayout} ${shaking ? styles.shake : ''}`}
        role="toolbar"
        aria-label="Game actions"
      >
        <div className={styles.splitLeft}>
          {autoPassToggle}
          {passButton}
          {tichuBtn}
        </div>
        {playerSeat}
        <div className={styles.splitRight}>
          {playButton}
          {bombButton}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.actionBar} ${shaking ? styles.shake : ''}`}
      role="toolbar"
      aria-label="Game actions"
    >
      {autoPassToggle}
      {passButton}
      {playButton}
      {bombButton}
      {tichuBtn}
    </div>
  );
});
