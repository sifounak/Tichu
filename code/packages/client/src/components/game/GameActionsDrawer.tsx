// REQ-F-GA09: Mobile slide-in drawer from left edge
// REQ-NF-GA02: 200ms slide transition
'use client';

import { memo, useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Seat } from '@tichu/shared';
import type { MenuAction } from './GameActionsMenu';
import styles from './GameActionsDrawer.module.css';

export interface GameActionsDrawerProps {
  open: boolean;
  onClose: () => void;
  isHost: boolean;
  isSpectator: boolean;
  isPreGame: boolean;
  votingEnabled: boolean;
  onAction: (action: MenuAction) => void;
  activeVote: { initiatorSeat: Seat } | null;
  mySeat: Seat | null;
  isOnCooldown?: (key: string) => boolean;
  getCooldownRemaining?: (key: string) => number;
}

interface DrawerItem {
  action: MenuAction;
  label: string;
  disabled?: boolean;
  hint?: string;
}

export const GameActionsDrawer = memo(function GameActionsDrawer({
  open,
  onClose,
  isHost,
  isSpectator,
  isPreGame,
  votingEnabled,
  onAction,
  activeVote,
  isOnCooldown,
  getCooldownRemaining,
}: GameActionsDrawerProps) {
  // Manage visibility for exit transition
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setVisible(true);
      // Trigger animation on next frame
      requestAnimationFrame(() => setAnimating(true));
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleItemClick = useCallback((action: MenuAction) => {
    onClose();
    onAction(action);
  }, [onClose, onAction]);

  // Build menu items (same logic as GameActionsMenu)
  const items: DrawerItem[] = [];

  if (!isSpectator) {
    // REQ-F-GA59: Kick cooldown is per-target, checked at target selection (not menu item level)
    const kickDisabled = !isHost && !votingEnabled;
    const kickHint = kickDisabled ? 'Voting disabled by host' : undefined;
    items.push({ action: { type: 'kickPlayer' }, label: 'Kick Player', disabled: kickDisabled, hint: kickHint });

    if (!isPreGame) {
      const rrCooldown = isOnCooldown?.('restartRound') ?? false;
      const rrDisabled = (!isHost && !votingEnabled) || rrCooldown;
      let rrHint: string | undefined;
      if (!isHost && !votingEnabled) rrHint = 'Voting disabled by host';
      else if (rrCooldown) rrHint = `Cooldown (${getCooldownRemaining?.('restartRound') ?? 0}s)`;
      items.push({ action: { type: 'restartRound' }, label: 'Restart Round', disabled: rrDisabled, hint: rrHint });

      const rgCooldown = isOnCooldown?.('restartGame') ?? false;
      const rgDisabled = (!isHost && !votingEnabled) || rgCooldown;
      let rgHint: string | undefined;
      if (!isHost && !votingEnabled) rgHint = 'Voting disabled by host';
      else if (rgCooldown) rgHint = `Cooldown (${getCooldownRemaining?.('restartGame') ?? 0}s)`;
      items.push({ action: { type: 'restartGame' }, label: 'Restart Game', disabled: rgDisabled, hint: rgHint });
    }

    // REQ-F-GA44: Transfer Host disabled during active vote
    if (isHost) {
      const transferDisabled = !!activeVote;
      items.push({ action: { type: 'transferHost' }, label: 'Transfer Host', disabled: transferDisabled, hint: transferDisabled ? 'Vote in progress' : undefined });
      items.push({
        action: { type: 'toggleVoting' },
        label: votingEnabled ? 'Disable Voting' : 'Enable Voting',
      });
    }
  }

  items.push({ action: { type: 'gameSettings' }, label: 'Game Settings' });

  if (!visible) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`${styles.backdrop} ${animating ? styles.backdropVisible : ''}`}
        onClick={onClose}
      />
      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className={`${styles.drawer} ${animating ? styles.drawerOpen : ''}`}
        role="menu"
        aria-label="Game Menu"
      >
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Game Menu</span>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close menu">
            &times;
          </button>
        </div>
        <div className={styles.drawerItems}>
          {items.map((item) => (
            <button
              key={item.action.type}
              className={`${styles.drawerItem} ${item.disabled ? styles.drawerItemDisabled : ''}`}
              role="menuitem"
              disabled={item.disabled}
              onClick={() => !item.disabled && handleItemClick(item.action)}
            >
              <span className={styles.drawerItemLabel}>{item.label}</span>
              {item.hint && <span className={styles.drawerItemHint}>{item.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </>,
    document.body,
  );
});
