'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Suit, type GameCard, type UserPreferences } from '@tichu/shared';
import { CardRow } from '@/components/cards/CardRow';
import { usePreferencesStore } from '@/stores/preferencesStore';
import styles from './PreferencesDialog.module.css';

const hand: GameCard[] = [
  { id: 100, card: { kind: 'dog' } }, { id: 101, card: { kind: 'mahjong' } },
  { id: 102, card: { kind: 'standard', suit: Suit.Jade, rank: 2 } },
  { id: 103, card: { kind: 'standard', suit: Suit.Pagoda, rank: 9 } },
  { id: 104, card: { kind: 'standard', suit: Suit.Star, rank: 9 } },
  { id: 105, card: { kind: 'standard', suit: Suit.Sword, rank: 10 } },
  { id: 106, card: { kind: 'standard', suit: Suit.Jade, rank: 14 } },
  { id: 107, card: { kind: 'phoenix' } }, { id: 108, card: { kind: 'dragon' } },
];
const previewStyle = {
  '--card-width': '64px', '--card-height': '92px', '--card-font-size': '16px',
  '--card-suit-size': '24px', '--card-border-radius': '5px',
} as CSSProperties;

const sounds: { field: keyof Pick<UserPreferences, 'soundEnabled' | 'cardsAndWagersSound' | 'yourTurnSound' | 'timerWarningSound' | 'chatSound'>; label: string; description: string }[] = [
  { field: 'soundEnabled', label: 'Sound enabled', description: 'Enable or silence all sounds.' },
  { field: 'cardsAndWagersSound', label: 'Cards and wagers', description: 'Special cards, bombs, and Tichu calls.' },
  { field: 'yourTurnSound', label: 'Your turn', description: 'An alert when it becomes your turn.' },
  { field: 'timerWarningSound', label: 'Timer warning', description: 'Countdown beeps and the out-of-time alert.' },
  { field: 'chatSound', label: 'Chat', description: 'Incoming-message sounds.' },
];

// REQ-F-UP02, UP03, REQ-NF-UP01: Accessible draft-only editing with shared live previews.
export function PreferencesDialog() {
  const store = usePreferencesStore();
  const dialog = useRef<HTMLDivElement>(null);
  const close = store.closeDialog;
  useEffect(() => {
    if (!store.open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLInputElement | HTMLButtonElement>('button, input') ?? [])
        .filter((element) => !element.disabled && !element.closest('fieldset')?.disabled);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); dialog.current?.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keydown, true);
      if (previousFocus?.isConnected) previousFocus.focus();
      else document.querySelector<HTMLElement>('[aria-label="User menu"], [aria-label="Game Menu"]')?.focus();
    };
  }, [store.open, close]);

  if (!store.open) return null;
  const { draft, preferences, loading, saving, error } = store;
  const changed = draft !== null && Object.keys(preferences).some((key) => draft[key as keyof UserPreferences] !== preferences[key as keyof UserPreferences]);
  return createPortal(
    <div className={styles.backdrop} data-testid="preferences-backdrop" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="preferences-title" aria-busy={loading || saving} ref={dialog} tabIndex={-1}>
        <header className={styles.header}>
          <h2 id="preferences-title">Preferences</h2>
          <button type="button" className={styles.close} aria-label="Close preferences" disabled={saving} onClick={close}>×</button>
        </header>
        <div className={styles.content}>
          {loading && <p role="status">Loading preferences…</p>}
          {error && <p className={styles.error} role="alert">{error}</p>}
          {!draft && !loading && <button type="button" className={styles.button} onClick={() => void store.openDialog()}>Retry</button>}
          {draft && <>
            <h3>Cards</h3>
            <fieldset className={styles.fieldset} disabled={saving}>
              <legend>Card order</legend><p className={styles.hint}>From left to right.</p>
              <div className={styles.choices}>
                {(['ascending', 'descending'] as const).map((value) => <label key={value} className={styles.choice}>
                  <input type="radio" name="card-order" checked={draft.cardOrder === value} onChange={() => store.updateDraft({ cardOrder: value })} />
                  {value === 'ascending' ? 'Low to high' : 'High to low'}
                </label>)}
              </div>
            </fieldset>
            <fieldset className={styles.fieldset} disabled={saving}>
              <legend>Card overlap</legend>
              <div className={styles.choices}>
                {(['leftOnTop', 'rightOnTop'] as const).map((value) => <label key={value} className={styles.choice}>
                  <input type="radio" name="card-overlap" checked={draft.cardOverlap === value} onChange={() => store.updateDraft({ cardOverlap: value })} />
                  {value === 'leftOnTop' ? 'Left cards on top' : 'Right cards on top'}
                </label>)}
              </div>
            </fieldset>
            <div className={styles.preview}>
              <p className={styles.previewLabel}>Example hand</p>
              <CardRow cards={hand} preferences={draft} style={previewStyle} label="Example hand" />
            </div>
            <h3>Sounds</h3>
            {sounds.map(({ field, label, description }) => <label key={field} className={styles.soundRow}>
              <span>{label}<span className={styles.soundDescription}>{description}</span></span>
              <input type="checkbox" role="switch" aria-label={label} checked={draft[field]}
                disabled={saving || (field !== 'soundEnabled' && !draft.soundEnabled)}
                onChange={(event) => store.updateDraft({ [field]: event.target.checked })} />
            </label>)}
          </>}
        </div>
        <footer className={styles.footer}>
          <button type="button" className={styles.button} disabled={saving} onClick={close}>Cancel</button>
          <button type="button" className={`${styles.button} ${styles.save}`} disabled={!changed || loading || saving} onClick={() => void store.save()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </footer>
      </div>
    </div>, document.body,
  );
}
