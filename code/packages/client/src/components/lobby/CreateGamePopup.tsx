// REQ-F-CG01: Settings popup for game creation
// REQ-F-CG02: Target score, turn timer, private room, spectators (no bot difficulty)
// REQ-F-CG03: Create Game + Cancel buttons
// REQ-F-CG04: Cancel dismisses with no side effects
'use client';

import { useState } from 'react';
import styles from './CreateGamePopup.module.css';

export interface CreateGameConfig {
  targetScore: number;
  turnTimerSeconds: 30 | 60 | 90 | null;
  isPrivate: boolean;
  spectatorsAllowed: boolean;
}

interface CreateGamePopupProps {
  onCancel: () => void;
  onCreate: (config: CreateGameConfig) => void;
}

// REQ-NF-CG02: Defaults match server defaults
const DEFAULTS: CreateGameConfig = {
  targetScore: 1000,
  turnTimerSeconds: null,
  isPrivate: false,
  spectatorsAllowed: true,
};

export function CreateGamePopup({ onCancel, onCreate }: CreateGamePopupProps) {
  const [config, setConfig] = useState<CreateGameConfig>({ ...DEFAULTS });

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick} role="dialog" aria-modal="true" aria-label="Create Game Settings">
      <div className={styles.popup}>
        <form onSubmit={(e) => { e.preventDefault(); onCreate(config); }}>
        <h2 className={styles.title}>Game Settings</h2>

        <div className={styles.grid}>
          {/* Target Score */}
          <label className={styles.field}>
            <span className={styles.label}>Target Score</span>
            <input
              type="number"
              value={config.targetScore}
              onChange={(e) => setConfig({ ...config, targetScore: parseInt(e.target.value) || 1000 })}
              min={100}
              max={10000}
              step={100}
              className={styles.input}
            />
          </label>

          {/* Turn Timer */}
          <label className={styles.field}>
            <span className={styles.label}>Turn Timer</span>
            <select
              value={config.turnTimerSeconds ?? 'off'}
              onChange={(e) =>
                setConfig({
                  ...config,
                  turnTimerSeconds: e.target.value === 'off' ? null : parseInt(e.target.value) as 30 | 60 | 90,
                })
              }
              className={styles.select}
            >
              <option value="off">Off</option>
              <option value="30">30s</option>
              <option value="60">60s</option>
              <option value="90">90s</option>
            </select>
          </label>

          {/* Private Room */}
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={config.isPrivate}
              onChange={(e) => setConfig({ ...config, isPrivate: e.target.checked })}
            />
            <span className={styles.checkboxLabel}>Private Room</span>
          </label>

          {/* Allow Spectators */}
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={config.spectatorsAllowed}
              onChange={(e) => setConfig({ ...config, spectatorsAllowed: e.target.checked })}
            />
            <span className={styles.checkboxLabel}>Allow Spectators</span>
          </label>
        </div>

        <div className={styles.buttons}>
          <button type="button" onClick={onCancel} className={styles.cancelBtn}>
            Cancel
          </button>
          <button type="submit" autoFocus className={styles.createBtn}>
            Create Game
          </button>
        </div>
        </form>
      </div>
    </div>
  );
}
