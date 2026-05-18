// REQ-F-RAD07: Spinner overlay after 3s without ACK/NACK
'use client';

import { memo } from 'react';
import { useUiStore } from '@/stores/uiStore';

export const ActionSpinner = memo(function ActionSpinner() {
  const visible = useUiStore((s) => s.pendingActionSpinner);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 'var(--space-2)',
        zIndex: 20,
        pointerEvents: 'none',
      }}
      role="status"
      aria-label="Sending action"
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
      }}>
        <div
          style={{
            width: '24px',
            height: '24px',
            border: '3px solid rgba(255, 255, 255, 0.3)',
            borderTopColor: 'white',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span style={{
          color: 'white',
          fontSize: 'var(--font-sm)',
          fontWeight: 500,
        }}>
          Sending...
        </span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
});
