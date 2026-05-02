// Shared game settings form used by CreateGamePopup (lobby) and PreRoomView (pre-game)
'use client';

import styles from './GameSettingsForm.module.css';

/** Subset of GameConfig fields that settings forms edit */
export interface GameSettingsValues {
  targetScore: number;
  turnTimerSeconds: number | null;
  isPrivate: boolean;
  spectatorsAllowed: boolean;
  spectatorChatEnabled: boolean;
}

interface GameSettingsFormProps {
  config: GameSettingsValues;
  onChange: (updates: Partial<GameSettingsValues>) => void;
  /** If true, show read-only summary instead of editable controls */
  readOnly?: boolean;
}

export function GameSettingsForm({ config, onChange, readOnly }: GameSettingsFormProps) {
  if (readOnly) {
    return (
      <div className={styles.summaryGrid}>
        <span>Target: {config.targetScore} pts</span>
        <span>Timer: {config.turnTimerSeconds ? `${config.turnTimerSeconds}s` : 'Off'}</span>
        <span>Spectators: {config.spectatorsAllowed ? 'Yes' : 'No'}</span>
        <span>Spectator Chat: {config.spectatorChatEnabled ? 'Yes' : 'No'}</span>
        <span>{config.isPrivate ? 'Private Room' : 'Public Room'}</span>
      </div>
    );
  }

  return (
    <div className={styles.form}>
      {/* Target Score */}
      <label className={styles.field}>
        <span className={styles.label}>Target Score</span>
        <input
          type="number"
          value={config.targetScore}
          onChange={(e) => onChange({ targetScore: parseInt(e.target.value) || 1000 })}
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
          onChange={(e) => onChange({
            turnTimerSeconds: e.target.value === 'off' ? null : parseInt(e.target.value),
          })}
          className={styles.select}
        >
          <option value="off">Off</option>
          <option value="30">30s</option>
          <option value="60">60s</option>
          <option value="90">90s</option>
        </select>
      </label>

      {/* Checkboxes — left-aligned group, centered in column */}
      <div className={styles.checkboxGroup}>
        {/* Allow Spectators */}
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={config.spectatorsAllowed}
            onChange={(e) => onChange({
              spectatorsAllowed: e.target.checked,
              ...(!e.target.checked && { spectatorChatEnabled: false }),
            })}
          />
          <span className={styles.checkboxLabel}>Spectators</span>
        </label>

        {/* Spectator Chat */}
        <label className={`${styles.checkboxRow} ${!config.spectatorsAllowed ? styles.checkboxDisabled : ''}`}>
          <input
            type="checkbox"
            checked={config.spectatorChatEnabled}
            disabled={!config.spectatorsAllowed}
            onChange={(e) => onChange({ spectatorChatEnabled: e.target.checked })}
          />
          <span className={styles.checkboxLabel}>Spectator Chat</span>
        </label>

        {/* Private */}
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={config.isPrivate}
            onChange={(e) => onChange({ isPrivate: e.target.checked })}
          />
          <span className={styles.checkboxLabel}>Private</span>
        </label>
      </div>
    </div>
  );
}
