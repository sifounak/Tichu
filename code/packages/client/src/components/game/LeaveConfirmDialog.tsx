// REQ-F-LRC01, REQ-F-LRC02, REQ-F-LRC03: Confirmation dialog shown before leaving a room
'use client';

import { memo, useState, useCallback } from 'react';

interface LeaveConfirmDialogProps {
  /** Title shown in the dialog (e.g. "Leave Room?" or "Leave Game?") */
  title: string;
  /** Subtitle/description (e.g. "You will return to the lobby.") */
  subtitle: string;
  /** Called when user confirms leaving */
  onConfirm: () => void;
  /** Render prop: receives a click handler that opens the dialog */
  children: (openDialog: () => void) => React.ReactNode;
}

export const LeaveConfirmDialog = memo(function LeaveConfirmDialog({
  title,
  subtitle,
  onConfirm,
  children,
}: LeaveConfirmDialogProps) {
  const [show, setShow] = useState(false);

  const open = useCallback(() => setShow(true), []);
  const close = useCallback(() => setShow(false), []);
  const confirm = useCallback(() => {
    setShow(false);
    onConfirm();
  }, [onConfirm]);

  return (
    <>
      {children(open)}
      {show && (
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
          onClick={close}
        >
          <div
            style={{
              background: 'var(--color-bg-panel)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--space-3)',
              padding: 'var(--space-6) var(--space-8)',
              textAlign: 'center',
              maxWidth: 'calc(360px * var(--scale))',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: 'var(--font-base)', fontWeight: 600, marginBottom: subtitle ? 'var(--space-2)' : 'var(--space-5)' }}>
              {title}
            </p>
            {subtitle && (
              <p style={{ fontSize: 'calc(13px * var(--scale))', color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)' }}>
                {subtitle}
              </p>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
              <button
                onClick={close}
                style={{
                  padding: 'var(--space-2) var(--space-5)',
                  borderRadius: 'var(--space-2)',
                  border: '1px solid var(--color-border)',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-md)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Stay
              </button>
              <button
                onClick={confirm}
                style={{
                  padding: 'var(--space-2) var(--space-5)',
                  borderRadius: 'var(--space-2)',
                  border: 'none',
                  background: '#dc2626',
                  color: 'white',
                  fontSize: 'var(--font-md)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
