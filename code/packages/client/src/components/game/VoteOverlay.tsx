// REQ-F-PV05: Kick vote dialog
// REQ-F-PV06: Kick target notification
// REQ-F-PV07: Restart vote dialog
// REQ-F-PV08: Vote submission
// REQ-F-VI06: Spectator read-only vote overlay
// REQ-NF-PV02: Consistent UI patterns (follows DisconnectOverlay pattern)
// REQ-NF-PV03: Accessibility
'use client';

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Seat } from '@tichu/shared';
import { useAnimationSettings } from '@/hooks/useAnimationSettings';
import styles from './VoteOverlay.module.css';

export interface VoteOverlayProps {
  activeVote: {
    voteId: string;
    voteType: 'kick' | 'restart';
    initiatorSeat: Seat;
    targetSeat?: Seat;
    votes: Record<string, boolean | null>;
    timeoutMs: number;
  } | null;
  mySeat: Seat;
  countdownSeconds: number;
  seatNames: Record<Seat, string>;
  onVote: (voteId: string, vote: boolean) => void;
  /** REQ-F-VI06: Read-only mode for spectators — shows vote info but no voting buttons */
  readOnly?: boolean;
}

export const VoteOverlay = memo(function VoteOverlay({
  activeVote,
  mySeat,
  countdownSeconds,
  seatNames,
  onVote,
  readOnly,
}: VoteOverlayProps) {
  const { durations, enabled } = useAnimationSettings();
  const [hasVoted, setHasVoted] = useState(false);

  // Reset hasVoted when vote changes
  const currentVoteId = activeVote?.voteId ?? null;
  const [trackedVoteId, setTrackedVoteId] = useState<string | null>(null);
  if (currentVoteId !== trackedVoteId) {
    setTrackedVoteId(currentVoteId);
    setHasVoted(false);
  }

  if (!activeVote) return null;

  const { voteType, initiatorSeat, targetSeat, voteId } = activeVote;
  const initiatorName = seatNames[initiatorSeat];
  const targetName = targetSeat ? seatNames[targetSeat] : '';

  // REQ-F-PV06: Kick target sees info-only message
  const isKickTarget = voteType === 'kick' && targetSeat === mySeat;

  // Determine button labels
  const approveLabel = voteType === 'kick' ? 'Kick' : 'Restart';
  const rejectLabel = voteType === 'kick' ? "Don't Kick" : "Don't Restart";

  // Build dialog message
  let dialogMessage: string;
  if (isKickTarget) {
    dialogMessage = `${initiatorName} has started a vote to kick you`;
  } else if (voteType === 'kick') {
    dialogMessage = `${initiatorName} has started a vote to kick ${targetName}`;
  } else {
    dialogMessage = `${initiatorName} has started a vote to restart the game`;
  }

  const handleVote = (vote: boolean) => {
    setHasVoted(true);
    onVote(voteId, vote);
  };

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={enabled ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        exit={enabled ? { opacity: 0 } : undefined}
        transition={{ duration: durations.cardPlay }}
      >
        <div className={styles.panel} role="dialog" aria-label="Player vote">
          <p className={styles.title}>{dialogMessage}</p>

          {countdownSeconds > 0 && (
            <div className={styles.countdown} aria-live="polite">
              {countdownSeconds}s remaining
            </div>
          )}

          {/* REQ-F-VI06: Spectators see read-only message */}
          {readOnly && (
            <p className={styles.waiting}>Vote in progress — spectators cannot vote</p>
          )}

          {/* REQ-F-PV08: Vote buttons (hidden for kick target and spectators) */}
          {!readOnly && !isKickTarget && !hasVoted && (
            <div className={styles.voteButtons}>
              <button
                className={`${styles.voteButton} ${styles.approveButton}`}
                onClick={() => handleVote(true)}
                aria-label={approveLabel}
              >
                {approveLabel}
              </button>
              <button
                className={`${styles.voteButton} ${styles.rejectButton}`}
                onClick={() => handleVote(false)}
                aria-label={rejectLabel}
              >
                {rejectLabel}
              </button>
            </div>
          )}

          {!readOnly && !isKickTarget && hasVoted && (
            <p className={styles.waiting}>Waiting for other players...</p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
});
