// REQ-F-SP08: Seat offer overlay with countdown
// REQ-F-SP08b: Queue status display
// REQ-F-SP08c: Seats available (up-for-grabs) overlay
'use client';

import { memo, useEffect, useState } from 'react';
import type { Seat } from '@tichu/shared';

const SEAT_LABELS: Record<Seat, string> = {
  north: 'North', east: 'East', south: 'South', west: 'West',
};

interface SpectatorOverlayProps {
  /** REQ-F-ES06: Seat offer from SEAT_OFFERED message (multi-seat support) */
  seatOffer: { seats: Seat[]; timeoutMs: number } | null;
  /** Queue status from QUEUE_STATUS message */
  queueStatus: { decidingSpectator: string; position: number; timeoutMs: number } | null;
  /** Available seats from SEATS_AVAILABLE (up-for-grabs) */
  availableSeats: Seat[];
  /** REQ-F-ES04: Whether a disconnect vote is active (spectators see waiting message) */
  disconnectVoteActive?: boolean;
  onClaimSeat: () => void;
  onDeclineSeat: () => void;
  onLeaveRoom: () => void;
}

export const SpectatorOverlay = memo(function SpectatorOverlay({
  seatOffer,
  queueStatus,
  availableSeats,
  disconnectVoteActive,
  onClaimSeat,
  onDeclineSeat,
  onLeaveRoom,
}: SpectatorOverlayProps) {
  // Countdown timer for seat offers
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    if (!seatOffer) { setCountdown(30); return; }
    setCountdown(Math.ceil(seatOffer.timeoutMs / 1000));
    const interval = setInterval(() => {
      setCountdown((prev) => {
        const next = Math.max(0, prev - 1);
        // Auto-dismiss seat offer when countdown expires (treat as timeout)
        if (next === 0 && seatOffer) {
          onDeclineSeat();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [seatOffer, onDeclineSeat]);

  // REQ-F-ES04: Spectators see waiting message during disconnect vote
  if (disconnectVoteActive) {
    return (
      <div style={{ ...infoBarStyle, bottom: 'calc(100px * var(--scale))' }}>
        <p style={{ fontSize: 'var(--font-md)', color: 'var(--color-text-secondary)' }}>
          Waiting for current players to choose what to do about the disconnected player(s)
        </p>
      </div>
    );
  }

  // REQ-F-SP08: Seat offer overlay
  if (seatOffer) {
    return (
      <div style={overlayStyle}>
        <div style={panelStyle}>
          <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
            Seat Available!
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
            {seatOffer.seats.length === 1
              ? <>The <strong>{SEAT_LABELS[seatOffer.seats[0]]}</strong> seat is open.</>
              : <>{seatOffer.seats.map(s => SEAT_LABELS[s]).join(', ')} seats are open.</>
            }
          </p>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)', fontSize: 'var(--font-sm)' }}>
            {countdown}s remaining
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={onClaimSeat} style={buttonStyle('var(--color-gold-accent)', 'var(--color-felt-green-dark)')}>
              Join Game
            </button>
            <button onClick={onDeclineSeat} style={buttonStyle('rgba(255,255,255,0.1)', 'var(--color-text-primary)', '1px solid var(--color-border)')}>
              Continue Spectating
            </button>
            <button onClick={onLeaveRoom} style={buttonStyle('#dc2626', 'white')}>
              Leave Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // REQ-F-SP08b: Queue status display (position 0 = passed/timed out, waiting for others)
  if (queueStatus) {
    return (
      <div style={{ ...infoBarStyle, bottom: 'calc(100px * var(--scale))' }}>
        {queueStatus.position === 0 ? (
          <p style={{ fontSize: 'var(--font-md)', color: 'var(--color-text-secondary)' }}>
            Waiting for other spectators to claim a seat...
          </p>
        ) : (
          <>
            <p style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              A seat has opened up!
            </p>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>
              You are #{queueStatus.position} in line...
            </p>
          </>
        )}
      </div>
    );
  }

  // REQ-F-SP08c: Seats up for grabs
  if (availableSeats.length > 0) {
    return (
      <div style={overlayStyle}>
        <div style={panelStyle}>
          <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
            Seats are up for Grabs!
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            {availableSeats.map(s => SEAT_LABELS[s]).join(', ')} — first come, first served
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
            <button onClick={onClaimSeat} style={buttonStyle('var(--color-gold-accent)', 'var(--color-felt-green-dark)')}>
              Join Game
            </button>
            <button onClick={onLeaveRoom} style={buttonStyle('#dc2626', 'white')}>
              Leave Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
});

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 90,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.5)',
};

const panelStyle: React.CSSProperties = {
  background: 'var(--color-bg-panel)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--space-3)',
  padding: 'var(--space-6) var(--space-8)',
  textAlign: 'center',
  maxWidth: 'calc(420px * var(--scale))',
};

const infoBarStyle: React.CSSProperties = {
  position: 'fixed',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 80,
  background: 'var(--color-bg-panel)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--space-3)',
  padding: 'var(--space-3) var(--space-5)',
  textAlign: 'center',
};

function buttonStyle(bg: string, color: string, border?: string): React.CSSProperties {
  return {
    padding: 'var(--space-2) var(--space-5)',
    borderRadius: 'var(--space-2)',
    border: border ?? 'none',
    background: bg,
    color,
    fontSize: 'var(--font-md)',
    fontWeight: 600,
    cursor: 'pointer',
  };
}
