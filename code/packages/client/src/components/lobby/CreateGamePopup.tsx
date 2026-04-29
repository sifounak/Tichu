// REQ-F-CG01: Settings popup for game creation
// REQ-F-CG02: Target score, turn timer, private room, spectators
// REQ-F-CG03: Create Game + Cancel buttons
// REQ-F-CG04: Cancel dismisses with no side effects
'use client';

import { useState } from 'react';
import { GameSettingsForm } from '@/components/ui/GameSettingsForm';
import styles from './CreateGamePopup.module.css';

export interface CreateGameConfig {
  targetScore: number;
  turnTimerSeconds: 30 | 60 | 90 | null;
  isPrivate: boolean;
  spectatorsAllowed: boolean;
  spectatorChatEnabled: boolean;
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
  spectatorChatEnabled: false,
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

        <div className={styles.formWrapper}>
          <GameSettingsForm
            config={config}
            onChange={(updates) => setConfig({ ...config, ...updates } as CreateGameConfig)}
          />
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
