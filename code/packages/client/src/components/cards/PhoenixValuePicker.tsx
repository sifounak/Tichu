// REQ-F-PH07: Present only valid Phoenix options
// REQ-F-PH06: Auto-dismiss when only one value
'use client';

import { memo } from 'react';
import type { Rank } from '@tichu/shared';
import styles from './PhoenixValuePicker.module.css';

const RANK_LABELS: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

export interface PhoenixValuePickerProps {
  /** Valid rank options for Phoenix */
  options: Rank[];
  /** Callback when a value is chosen */
  onSelect: (value: Rank) => void;
  /** Callback to cancel selection */
  onCancel: () => void;
}

export const PhoenixValuePicker = memo(function PhoenixValuePicker({
  options,
  onSelect,
  onCancel,
}: PhoenixValuePickerProps) {
  return (
    <div className={styles.overlay} onClick={onCancel} role="dialog" aria-label="Choose Phoenix value">
      <div className={styles.picker} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>Phoenix Value</h3>
        <p className={styles.subtitle}>Choose the rank for Phoenix:</p>
        <div className={styles.options}>
          {options.map((rank) => (
            <button
              key={rank}
              className={styles.option}
              onClick={() => onSelect(rank)}
              aria-label={`Set Phoenix to ${RANK_LABELS[rank]}`}
            >
              {RANK_LABELS[rank]}
            </button>
          ))}
        </div>
        <button className={styles.cancelButton} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
});
