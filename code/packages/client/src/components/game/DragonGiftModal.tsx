// REQ-F-DR01: Dragon trick given to opponent via modal dialog
'use client';

import { memo } from 'react';
import type { Seat } from '@tichu/shared';
import styles from './DragonGiftModal.module.css';

const SEAT_LABELS: Record<Seat, string> = {
  north: 'North', east: 'East', south: 'South', west: 'West',
};

export interface DragonGiftModalProps {
  /** Active opponents who can receive the dragon trick */
  options: Seat[];
  /** Callback when an opponent is chosen */
  onGift: (to: Seat) => void;
}

export const DragonGiftModal = memo(function DragonGiftModal({
  options,
  onGift,
}: DragonGiftModalProps) {
  return (
    <div className={styles.overlay} role="dialog" aria-label="Gift Dragon trick">
      <div className={styles.modal}>
        <h2 className={styles.title}>Dragon Trick</h2>
        <p className={styles.subtitle}>Choose which opponent receives this trick:</p>
        <div className={styles.options}>
          {options.map((seat) => (
            <button
              key={seat}
              className={styles.optionButton}
              onClick={() => onGift(seat)}
              aria-label={`Give trick to ${SEAT_LABELS[seat]}`}
            >
              {SEAT_LABELS[seat]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
