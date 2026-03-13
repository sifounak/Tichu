// REQ-F-HV06: Play/Pass action buttons with validity enforcement
// REQ-F-DI04: Tichu call button during appropriate phases
// REQ-NF-U02: Invalid play shake animation
// REQ-F-BI09: Bomb button for out-of-turn play
'use client';

import { memo, useState, useCallback } from 'react';
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
}

export const ActionBar = memo(function ActionBar({
  canPlay,
  canPass,
  isMyTurn,
  phase,
  myTichuCall,
  hasPlayedCards,
  hasBombReady,
  onPlay,
  onPass,
  onTichu,
  onBomb,
}: ActionBarProps) {
  const isPlaying = phase === 'playing';
  const showActions = isPlaying && isMyTurn;
  const [shaking, setShaking] = useState(false);

  // REQ-F-GF08: Tichu can be called during playing phase before first play
  const canCallTichu =
    isPlaying && myTichuCall === 'none' && !hasPlayedCards;

  const handlePlay = useCallback(() => {
    if (!canPlay) {
      setShaking(true);
      setTimeout(() => setShaking(false), 300);
      return;
    }
    onPlay();
  }, [canPlay, onPlay]);

  return (
    <div
      className={`${styles.actionBar} ${shaking ? styles.shake : ''}`}
      role="toolbar"
      aria-label="Game actions"
    >
      {showActions && (
        <>
          <button
            className={`${styles.button} ${styles.passButton}`}
            onClick={onPass}
            disabled={!canPass}
            aria-label="Pass turn"
          >
            Pass
          </button>
          <button
            className={`${styles.button} ${styles.playButton}`}
            onClick={handlePlay}
            disabled={!canPlay}
            aria-label="Play selected cards"
          >
            Play
          </button>
        </>
      )}
      {/* REQ-F-BI09: Show Bomb! button when off-turn with valid bomb selected */}
      {!isMyTurn && isPlaying && hasBombReady && (
        <button
          className={`${styles.button} ${styles.bombButton}`}
          onClick={onBomb}
          aria-label="Play bomb"
        >
          Bomb!
        </button>
      )}
      {canCallTichu && (
        <button
          className={`${styles.button} ${styles.tichuButton}`}
          onClick={onTichu}
          aria-label="Declare Tichu"
        >
          Tichu!
        </button>
      )}
    </div>
  );
});
