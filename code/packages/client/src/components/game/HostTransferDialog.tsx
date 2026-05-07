'use client';

import { memo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface HostTransferDialogProps {
  oldHostName: string;
  newHostName: string;
  myName: string;
  onDismiss: () => void;
}

export const HostTransferDialog = memo(function HostTransferDialog({
  oldHostName,
  newHostName,
  myName,
  onDismiss,
}: HostTransferDialogProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onDismiss]);

  const handleBackdropClick = useCallback(() => onDismiss(), [onDismiss]);
  const stopPropagation = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  // Determine message based on who is viewing
  let message: string;
  if (myName === newHostName) {
    message = 'You are now the game host';
  } else if (myName === oldHostName) {
    message = `You have successfully transferred host privileges to ${newHostName}`;
  } else {
    return null;
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={handleBackdropClick}
    >
      <div
        style={{
          background: 'rgb(0,0,0)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--space-3)',
          padding: 'var(--space-8) calc(var(--space-8) * 1.5)',
          textAlign: 'center',
          maxWidth: 'calc(480px * var(--scale))',
        }}
        onClick={stopPropagation}
        role="dialog"
        aria-label="Host Transfer"
      >
        <p style={{ fontSize: 'var(--font-2xl)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
          Host Changed
        </p>
        <p style={{ fontSize: 'var(--font-base)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>
          {message}
        </p>
        <button
          onClick={onDismiss}
          style={{
            padding: 'var(--space-3) var(--space-6)',
            borderRadius: 'var(--space-2)',
            border: 'none',
            background: 'var(--color-gold-accent)',
            color: 'var(--color-felt-green-dark)',
            fontSize: 'var(--font-lg)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          OK
        </button>
      </div>
    </div>,
    document.body,
  );
});
