// REQ-NF-U02: Tichu call banner — scale + opacity, auto-dismiss
'use client';

import { memo, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Seat, TichuCall } from '@tichu/shared';
import { useAnimationSettings } from '@/hooks/useAnimationSettings';
import styles from './TichuBanner.module.css';

export interface TichuBannerProps {
  /** Latest Tichu call event to display */
  tichuEvent: { seat: Seat; level: TichuCall } | null;
}

export const TichuBanner = memo(function TichuBanner({ tichuEvent }: TichuBannerProps) {
  const { durations, enabled } = useAnimationSettings();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (tichuEvent && tichuEvent.level !== 'none') {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), durations.tichuDismiss * 1000);
      return () => clearTimeout(timer);
    }
  }, [tichuEvent, durations.tichuDismiss]);

  const label = tichuEvent?.level === 'grandTichu' ? 'Grand Tichu!' : 'Tichu!';
  const isGrand = tichuEvent?.level === 'grandTichu';

  return (
    <AnimatePresence>
      {visible && tichuEvent && (
        <motion.div
          className={`${styles.banner} ${isGrand ? styles.grand : styles.regular}`}
          initial={enabled ? { opacity: 0, scale: 0.5 } : false}
          animate={{ opacity: 1, scale: 1 }}
          exit={enabled ? { opacity: 0, scale: 0.8 } : undefined}
          transition={{ duration: durations.tichuBanner, type: 'spring', stiffness: 200, damping: 15 }}
          role="alert"
          aria-live="assertive"
        >
          <span className={styles.seatLabel}>
            {tichuEvent.seat.charAt(0).toUpperCase() + tichuEvent.seat.slice(1)}
          </span>
          <span className={styles.callLabel}>{label}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
