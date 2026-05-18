// REQ-F-PH07: Present only valid Phoenix options
// REQ-F-PH06: Auto-dismiss when only one value
'use client';

import { memo, useLayoutEffect, useRef, useState } from 'react';
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
  const pickerRef = useRef<HTMLDivElement>(null);
  const [topOffset, setTopOffset] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const actionBar = document.querySelector('[data-debug-area="Action Bar"]');
    if (!actionBar || !pickerRef.current) return;
    const actionBarRect = actionBar.getBoundingClientRect();
    const pickerHeight = pickerRef.current.offsetHeight;
    // Align bottom of picker with bottom of action bar
    setTopOffset(actionBarRect.bottom - pickerHeight);
  }, []);

  return (
    <div className={styles.overlay} onClick={onCancel} role="dialog" aria-label="Choose Phoenix value">
      <div
        ref={pickerRef}
        className={styles.picker}
        style={topOffset !== undefined ? { position: 'fixed', top: topOffset } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={styles.title}>Choose Phoenix Value</h3>
        <div className={styles.options}>
          {[...options].sort((a, b) => b - a).map((rank) => (
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
