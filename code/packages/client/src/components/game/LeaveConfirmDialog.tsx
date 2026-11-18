// REQ-F-LRC01, REQ-F-LRC02, REQ-F-LRC03: Confirmation dialog shown before leaving a room
'use client';

import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface LeaveConfirmDialogProps {
  /** Title shown in the dialog (e.g. "Leave Room?" or "Leave Game?") */
  title: string;
  /** Subtitle/description (e.g. "You will return to the lobby.") */
  subtitle: string;
  /** Called when user confirms leaving */
  onConfirm: () => void;
  /** Render prop: receives a click handler that opens the dialog */
  children: (openDialog: () => void) => React.ReactNode;
  /** When true, opens the dialog programmatically (e.g., from back button) */
  externalOpen?: boolean;
  /** Called when dialog closes (cancel or confirm) so parent can reset externalOpen */
  onClose?: () => void;
}

export const LeaveConfirmDialog = memo(function LeaveConfirmDialog({
  title,
  subtitle,
  onConfirm,
  children,
  externalOpen,
  onClose,
}: LeaveConfirmDialogProps) {
  const [show, setShow] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const open = useCallback(() => setShow(true), []);
  const close = useCallback(() => {
    setShow(false);
    onClose?.();
  }, [onClose]);
  const confirm = useCallback(() => {
    setShow(false);
    onClose?.();
    onConfirm();
  }, [onClose, onConfirm]);

  // Open dialog programmatically when externalOpen becomes true
  useEffect(() => {
    if (externalOpen) {
      setShow(true);
    }
  }, [externalOpen]);

  // REQ-F-UC03: Keyboard cancellation, focus containment and opener restoration.
  useEffect(() => {
    if (!show) return;
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const buttons = panel?.querySelectorAll<HTMLButtonElement>('button');
    buttons?.[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Tab' && buttons?.length) {
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => { window.removeEventListener('keydown', handleKey); opener?.focus(); };
  }, [show, close]);

  return (
    <>
      {children(open)}
      {show && createPortal(
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
              background: 'rgb(0,0,0)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--space-3)',
              padding: 'var(--space-8) calc(var(--space-8) * 1.5)',
              textAlign: 'center',
              maxWidth: 'calc(480px * var(--scale))',
            }}
            ref={panelRef}
            role="dialog"
            aria-label={title}
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: 'var(--font-2xl)', fontWeight: 600, marginBottom: subtitle ? 'var(--space-3)' : 'var(--space-6)' }}>
              {title}
            </p>
            {subtitle && (
              <p style={{ fontSize: 'var(--font-base)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>
                {subtitle}
              </p>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center' }}>
              <button
                onClick={close}
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
                Stay
              </button>
              <button
                onClick={confirm}
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
                Leave
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
});
