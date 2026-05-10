// REQ-F-KM01: Kick dialog for disconnected players (2+ min threshold)
// REQ-F-KM07: Non-blocking — player can still interact with the game while this is showing
'use client';

import { memo } from 'react';

interface KickDialogProps {
  /** Display name of the disconnected player */
  playerName: string;
  /** Callback when "Kick" is clicked */
  onKick: () => void;
  /** Callback when "Keep Waiting" is clicked */
  onKeepWaiting: () => void;
}

export const KickDialog = memo(function KickDialog({
  playerName,
  onKick,
  onKeepWaiting,
}: KickDialogProps) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(140px * var(--scale))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 85,
        background: 'var(--color-bg-panel, #1a1a2e)',
        border: '1px solid var(--color-border, #333)',
        borderRadius: 'var(--space-3)',
        padding: 'var(--space-4) var(--space-6)',
        textAlign: 'center',
        maxWidth: 'calc(400px * var(--scale))',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
      role="dialog"
      aria-label={`Kick ${playerName}?`}
      data-testid="kick-dialog"
    >
      <p style={{
        fontSize: 'var(--font-md)',
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-2)',
      }}>
        {playerName} has been disconnected for 2+ minutes.
      </p>
      <p style={{
        fontSize: 'var(--font-sm)',
        color: 'var(--color-text-secondary)',
        marginBottom: 'var(--space-4)',
      }}>
        Remove them from the game?
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
        <button
          onClick={onKick}
          style={{
            padding: 'var(--space-2) var(--space-5)',
            borderRadius: 'var(--space-2)',
            border: 'none',
            background: '#e74c3c',
            color: 'white',
            fontSize: 'var(--font-base)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Kick
        </button>
        <button
          onClick={onKeepWaiting}
          style={{
            padding: 'var(--space-2) var(--space-5)',
            borderRadius: 'var(--space-2)',
            border: '1px solid var(--color-border)',
            background: 'rgba(255,255,255,0.05)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-base)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Keep Waiting
        </button>
      </div>
    </div>
  );
});
