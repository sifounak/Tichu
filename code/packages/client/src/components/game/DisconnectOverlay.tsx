// REQ-F-MP08: Disconnect handling UI — overlay, vote buttons, countdown, reconnect notification
'use client';

import { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Seat } from '@tichu/shared';
import { useAnimationSettings } from '@/hooks/useAnimationSettings';
import styles from './DisconnectOverlay.module.css';

// REQ-F-ES04: Vote options reduced to Wait/Kick
export type DisconnectVote = 'wait' | 'kick';

export interface DisconnectOverlayProps {
  /** REQ-F-ES17: Multi-disconnect support */
  disconnectedSeats: Seat[];
  /** Whether we need to vote */
  voteRequired: boolean;
  onVote: (vote: DisconnectVote) => void;
  /** Countdown seconds remaining (server-driven, 45s auto-kick) */
  countdownSeconds: number;
  /** Reconnection notification */
  reconnectedSeat: Seat | null;
  seatNames?: Record<Seat, string>;
}

const SEAT_LABELS: Record<Seat, string> = {
  north: 'North',
  east: 'East',
  south: 'South',
  west: 'West',
};

export const DisconnectOverlay = memo(function DisconnectOverlay({
  disconnectedSeats,
  voteRequired,
  onVote,
  countdownSeconds,
  reconnectedSeat,
  seatNames,
}: DisconnectOverlayProps) {
  const { durations, enabled } = useAnimationSettings();
  const [showReconnected, setShowReconnected] = useState(false);

  // REQ-NF-DL05: Show "reconnected" notification (reduced from 3s to 1.5s)
  useEffect(() => {
    if (reconnectedSeat) {
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [reconnectedSeat]);

  return (
    <>
      {/* REQ-F-ES04: Disconnect overlay with Wait/Kick vote */}
      <AnimatePresence>
        {disconnectedSeats.length > 0 && (
          <motion.div
            className={styles.overlay}
            initial={enabled ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            exit={enabled ? { opacity: 0 } : undefined}
            transition={{ duration: durations.cardPlay }}
          >
            <div className={styles.panel} role="alertdialog" aria-label="Player disconnected">
              <h3 className={styles.title}>
                {disconnectedSeats.length === 1 ? 'Player Disconnected' : 'Players Disconnected'}
              </h3>
              <p className={styles.message}>
                {disconnectedSeats.map(s => seatNames?.[s] ?? SEAT_LABELS[s]).join(' and ')}
                {disconnectedSeats.length === 1 ? ' has' : ' have'} lost connection.
              </p>

              {countdownSeconds > 0 && (
                <div className={styles.countdown} aria-live="polite">
                  Auto-kicking in {countdownSeconds}s
                </div>
              )}

              {voteRequired && (
                <div className={styles.voteButtons}>
                  <button
                    className={`${styles.voteButton} ${styles.waitButton}`}
                    onClick={() => onVote('wait')}
                    aria-label="Wait for player to rejoin"
                  >
                    Wait
                  </button>
                  <button
                    className={`${styles.voteButton} ${styles.abandonButton}`}
                    onClick={() => onVote('kick')}
                    aria-label="Kick disconnected player"
                  >
                    Kick
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reconnected notification */}
      <AnimatePresence>
        {showReconnected && reconnectedSeat && (
          <motion.div
            className={styles.reconnectedNotification}
            initial={enabled ? { opacity: 0, y: -20 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={enabled ? { opacity: 0, y: -20 } : undefined}
            transition={{ duration: durations.cardLift }}
            role="status"
            aria-live="polite"
          >
            {seatNames?.[reconnectedSeat] ?? SEAT_LABELS[reconnectedSeat]} reconnected
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
