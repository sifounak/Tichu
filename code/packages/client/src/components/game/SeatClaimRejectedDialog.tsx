// REQ-F-SJ07: Client-side rejection dialog for SEAT_CLAIM_REJECTED payloads.
// Displays the server-authored reason text and — when the server sets
// offerClaimOriginal=true — a one-click "Claim seat {originalSeat} instead"
// action that dispatches CLAIM_SEAT with the user's original seat.
'use client';

import { memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Seat } from '@tichu/shared';

const SEAT_LABELS: Record<Seat, string> = {
  north: 'North',
  east: 'East',
  south: 'South',
  west: 'West',
};

export interface SeatClaimRejection {
  reason: string;
  originalSeat: Seat;
  requestedSeat: Seat;
  currentOccupant: { displayName: string } | null;
  offerClaimOriginal: boolean;
}

interface SeatClaimRejectedDialogProps {
  rejection: SeatClaimRejection | null;
  onClose: () => void;
  onClaimOriginal: (seat: Seat) => void;
}

export const SeatClaimRejectedDialog = memo(function SeatClaimRejectedDialog({
  rejection,
  onClose,
  onClaimOriginal,
}: SeatClaimRejectedDialogProps) {
  const handleClaimOriginal = useCallback(() => {
    if (!rejection) return;
    onClaimOriginal(rejection.originalSeat);
    onClose();
  }, [rejection, onClaimOriginal, onClose]);

  if (!rejection) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Seat claim rejected"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'rgb(0,0,0)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--space-3)',
          padding: 'var(--space-8) calc(var(--space-8) * 1.5)',
          textAlign: 'center',
          maxWidth: 'calc(520px * var(--scale))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{
          fontSize: 'var(--font-xl)',
          fontWeight: 700,
          marginBottom: 'var(--space-4)',
          color: 'var(--color-gold-accent)',
        }}>
          Seat Claim Rejected
        </p>
        <p style={{
          fontSize: 'var(--font-base)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-6)',
          lineHeight: 1.5,
        }}>
          {rejection.reason}
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center' }}>
          <button
            onClick={onClose}
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
            Close
          </button>
          {rejection.offerClaimOriginal && (
            <button
              onClick={handleClaimOriginal}
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
              Claim {SEAT_LABELS[rejection.originalSeat]} instead
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
});
