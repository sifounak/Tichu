// REQ-F-HV06: Play/Pass action buttons with validity enforcement
// REQ-F-DI04: Tichu call button during appropriate phases
// REQ-NF-U02: Invalid play shake animation
// REQ-F-BI09: Bomb button for out-of-turn play
'use client';

import { memo, useState, useCallback, useEffect, useRef } from 'react';
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
  /** REQ-F-BW01: Timestamp when bomb window expires (for progress bar) */
  bombWindowEndTime?: number | null;
  /** REQ-F-BW01: Cancel the queued play */
  onCancelQueue?: () => void;
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
  bombWindowEndTime,
  onCancelQueue,
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

  // REQ-F-BW01: Progress bar for queued play — drains from right to left
  const [queueProgress, setQueueProgress] = useState(100);
  const queueRafRef = useRef<number>(0);
  const queueDurationRef = useRef(0);

  useEffect(() => {
    if (!playQueued || !bombWindowEndTime) {
      setQueueProgress(100);
      if (queueRafRef.current) cancelAnimationFrame(queueRafRef.current);
      return;
    }
    // Compute total duration from now to end (capped to what's left)
    const now = Date.now();
    const totalMs = bombWindowEndTime - now;
    queueDurationRef.current = totalMs;
    if (totalMs <= 0) { setQueueProgress(0); return; }

    const tick = () => {
      const remaining = bombWindowEndTime - Date.now();
      const pct = Math.max(0, (remaining / totalMs) * 100);
      setQueueProgress(pct);
      if (remaining > 0) {
        queueRafRef.current = requestAnimationFrame(tick);
      }
    };
    queueRafRef.current = requestAnimationFrame(tick);
    return () => { if (queueRafRef.current) cancelAnimationFrame(queueRafRef.current); };
  }, [playQueued, bombWindowEndTime]);

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

  const [queueHovered, setQueueHovered] = useState(false);

  // Reset hover state when queued play ends
  useEffect(() => {
    if (!playQueued) setQueueHovered(false);
  }, [playQueued]);

  const playButton = showActions && (
    playQueued ? (
      <button
        className={`${styles.button} ${styles.playButton} ${styles.queued} ${queueHovered ? styles.queuedHover : ''}`}
        onClick={onCancelQueue}
        onMouseEnter={() => setQueueHovered(true)}
        onMouseLeave={() => setQueueHovered(false)}
        aria-label="Cancel queued play"
        style={queueHovered ? undefined : {
          background: `linear-gradient(to right, var(--color-gold-accent) ${queueProgress}%, var(--color-bg-panel) ${queueProgress}%)`,
        }}
      >
        {queueHovered ? (
          <span className={styles.queuedText}>Cancel Play</span>
        ) : (
          <>
            <span className={styles.queuedText}>Queued...</span>
            <span className={styles.queuedSubtext}>(bomb delay)</span>
          </>
        )}
      </button>
    ) : (
      <button
        className={`${styles.button} ${styles.playButton}`}
        onClick={handlePlay}
        disabled={!canPlay}
        aria-label="Play selected cards"
      >
        Play
      </button>
    )
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
      className={`${styles.button} ${styles.passButton} ${styles.autoPassLabel} ${autoPassEnabled ? styles.autoPassActive : ''}`}
    >
      <input
        type="checkbox"
        checked={autoPassEnabled}
        onChange={(e) => onAutoPassToggle(e.target.checked)}
        className={styles.autoPassCheckbox}
        aria-label="Auto-pass until next trick"
      />
      {autoPassEnabled
        ? <><span className={styles.autoPassLine}>Auto-Pass</span><span className={styles.autoPassLine}>On</span></>
        : <><span className={styles.autoPassLine}>Enable</span><span className={styles.autoPassLine}>Auto-Pass</span></>
      }
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
