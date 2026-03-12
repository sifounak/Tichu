// REQ-F-HV06: Play/Pass action buttons with validity enforcement
// REQ-F-DI04: Tichu call button during appropriate phases
// REQ-NF-U02: Invalid play shake animation
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
  /** Callbacks */
  onPlay: () => void;
  onPass: () => void;
  onTichu: () => void;
}

export const ActionBar = memo(function ActionBar({
  canPlay,
  canPass,
  isMyTurn,
  phase,
  myTichuCall,
  hasPlayedCards,
  onPlay,
  onPass,
  onTichu,
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
            className={`${styles.button} ${styles.playButton}`}
            onClick={handlePlay}
            disabled={!canPlay}
            aria-label="Play selected cards"
          >
            Play
          </button>
          <button
            className={`${styles.button} ${styles.passButton}`}
            onClick={onPass}
            disabled={!canPass}
            aria-label="Pass turn"
          >
            Pass
          </button>
        </>
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
