// REQ-F-WP01: Wish picker UI for Mahjong wish declaration
'use client';

import { memo } from 'react';
import type { Rank } from '@tichu/shared';
import styles from './WishPicker.module.css';

const RANK_LABELS: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

export interface WishPickerProps {
  onSelect: (rank: Rank | null) => void;
  onCancel: () => void;
}

export const WishPicker = memo(function WishPicker({
  onSelect,
  onCancel,
}: WishPickerProps) {
  return (
    <div className={styles.overlay} onClick={onCancel} role="dialog" aria-label="Choose wish rank">
      <div className={styles.picker} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>Make a Wish</h3>
        <p className={styles.subtitle}>Choose a rank to wish for, or skip:</p>
        <div className={styles.options}>
          {([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as Rank[]).map((rank) => (
            <button
              key={rank}
              className={styles.option}
              onClick={() => onSelect(rank)}
              aria-label={`Wish for ${RANK_LABELS[rank]}`}
            >
              {RANK_LABELS[rank]}
            </button>
          ))}
        </div>
        <button className={styles.noWishButton} onClick={() => onSelect(null)}>
          No Wish
        </button>
        <button className={styles.cancelButton} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
});
