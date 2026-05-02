// REQ-F-GA18: Non-host confirmation dialog (Cancel + Start Vote)
// REQ-F-GA20: Host confirmation dialog (Cancel + Start Vote + Force)
// REQ-F-GA21: Force button uses destructive red styling
// REQ-F-GA22: Start Vote is the primary button
// REQ-F-GA26: Transfer Host immediate confirmation dialog
'use client';

import { memo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

export type ConfirmDialogAction =
  | { type: 'kick'; targetName: string }
  | { type: 'restartRound' }
  | { type: 'restartGame' }
  | { type: 'transferHost'; targetName: string };

interface ActionConfirmDialogProps {
  action: ConfirmDialogAction;
  isHost: boolean;
  onCancel: () => void;
  onStartVote?: () => void;
  onForceAction?: () => void;
}

export const ActionConfirmDialog = memo(function ActionConfirmDialog({
  action,
  isHost,
  onCancel,
  onStartVote,
  onForceAction,
}: ActionConfirmDialogProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const isTransfer = action.type === 'transferHost';

  let title: string;
  let message: string;
  let voteLabel: string;
  let forceLabel: string;

  switch (action.type) {
    case 'kick':
      title = 'Kick Player';
      message = `Kick ${action.targetName}?`;
      voteLabel = 'Start Vote';
      forceLabel = 'Force Kick';
      break;
    case 'restartRound':
      title = 'Restart Round';
      message = 'Restart the current round?';
      voteLabel = 'Start Vote';
      forceLabel = 'Force Restart';
      break;
    case 'restartGame':
      title = 'Restart Game';
      message = 'Restart the entire game? All scores will be reset.';
      voteLabel = 'Start Vote';
      forceLabel = 'Force Restart';
      break;
    case 'transferHost':
      title = 'Transfer Host';
      message = `Transfer host role to ${action.targetName}?`;
      voteLabel = '';
      forceLabel = '';
      break;
  }

  const handleBackdropClick = useCallback(() => onCancel(), [onCancel]);
  const stopPropagation = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

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
        aria-label={title}
      >
        <p style={{ fontSize: 'var(--font-2xl)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
          {title}
        </p>
        <p style={{ fontSize: 'var(--font-base)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
          {/* Cancel button — always present */}
          <button
            onClick={onCancel}
            style={{
              padding: 'var(--space-3) var(--space-6)',
              borderRadius: 'var(--space-2)',
              border: '1px solid var(--color-border)',
              background: 'rgba(255,255,255,0.1)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-lg)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          {isTransfer ? (
            /* REQ-F-GA26: Transfer Host — immediate with confirm */
            <button
              onClick={onForceAction}
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
              Transfer
            </button>
          ) : (
            <>
              {/* REQ-F-GA22: Start Vote — primary button */}
              {onStartVote && (
                <button
                  onClick={onStartVote}
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
                  {voteLabel}
                </button>
              )}
              {/* REQ-F-GA20, GA21: Host force button — destructive styling */}
              {isHost && onForceAction && (
                <button
                  onClick={onForceAction}
                  style={{
                    padding: 'var(--space-3) var(--space-6)',
                    borderRadius: 'var(--space-2)',
                    border: 'none',
                    background: '#dc2626',
                    color: 'white',
                    fontSize: 'var(--font-lg)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {forceLabel}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
});
