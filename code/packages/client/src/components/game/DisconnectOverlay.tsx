// REQ-F-MP08: Disconnect handling UI — overlay, vote buttons, countdown, reconnect notification
'use client';

import { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Seat } from '@tichu/shared';
import { useAnimationSettings } from '@/hooks/useAnimationSettings';
import styles from './DisconnectOverlay.module.css';

export type DisconnectVote = 'wait' | 'bot' | 'abandon';

export interface DisconnectOverlayProps {
  disconnectedSeat: Seat | null;
  /** Whether we need to vote */
  voteRequired: boolean;
  onVote: (vote: DisconnectVote) => void;
  /** Countdown seconds remaining (server-driven) */
  countdownSeconds: number;
  /** Reconnection notification */
  reconnectedSeat: Seat | null;
}

const SEAT_LABELS: Record<Seat, string> = {
  north: 'North',
  east: 'East',
  south: 'South',
  west: 'West',
};

export const DisconnectOverlay = memo(function DisconnectOverlay({
  disconnectedSeat,
  voteRequired,
  onVote,
  countdownSeconds,
  reconnectedSeat,
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
      {/* Disconnect overlay */}
      <AnimatePresence>
        {disconnectedSeat && (
          <motion.div
            className={styles.overlay}
            initial={enabled ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            exit={enabled ? { opacity: 0 } : undefined}
            transition={{ duration: durations.cardPlay }}
          >
            <div className={styles.panel} role="alertdialog" aria-label="Player disconnected">
              <h3 className={styles.title}>Player Disconnected</h3>
              <p className={styles.message}>
                {SEAT_LABELS[disconnectedSeat]} has lost connection.
              </p>

              {countdownSeconds > 0 && (
                <div className={styles.countdown} aria-live="polite">
                  Auto-deciding in {countdownSeconds}s
                </div>
              )}

              {voteRequired && (
                <div className={styles.voteButtons}>
                  <button
                    className={`${styles.voteButton} ${styles.waitButton}`}
                    onClick={() => onVote('wait')}
                    aria-label="Wait for player to reconnect"
                  >
                    Wait
                  </button>
                  <button
                    className={`${styles.voteButton} ${styles.botButton}`}
                    onClick={() => onVote('bot')}
                    aria-label="Replace with bot"
                  >
                    Replace with Bot
                  </button>
                  <button
                    className={`${styles.voteButton} ${styles.abandonButton}`}
                    onClick={() => onVote('abandon')}
                    aria-label="Abandon game"
                  >
                    Abandon
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
            {SEAT_LABELS[reconnectedSeat]} reconnected
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
