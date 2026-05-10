// REQ-F-UI01: "Waiting for player to reconnect..." overlay on untimed turn
'use client';

import { memo, useEffect, useState } from 'react';
import type { Seat } from '@tichu/shared';

interface WaitingForReconnectOverlayProps {
  /** Seat that the game is waiting for (disconnected player's untimed turn) */
  waitingForSeat: Seat;
  /** Display name of the disconnected player */
  playerName: string;
}

// REQ-NF-UI01: 500ms debounce before showing overlay (avoids flash on quick reconnects)
const DEBOUNCE_MS = 500;

export const WaitingForReconnectOverlay = memo(function WaitingForReconnectOverlay({
  waitingForSeat,
  playerName,
}: WaitingForReconnectOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const timer = setTimeout(() => setVisible(true), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [waitingForSeat]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 'var(--space-2)',
        zIndex: 10,
        pointerEvents: 'none',
      }}
      aria-live="polite"
      aria-label={`Waiting for ${playerName} to reconnect`}
    >
      <span style={{
        color: 'var(--color-text-primary)',
        fontSize: 'var(--font-sm)',
        fontWeight: 600,
        textAlign: 'center',
        padding: 'var(--space-2)',
        lineHeight: 1.3,
      }}>
        Waiting for<br />{playerName}<br />to reconnect...
      </span>
    </div>
  );
});
