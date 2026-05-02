// REQ-F-GA07: Kebab (three-dot) button visible to all users
// REQ-F-GA08: Desktop popover dropdown on click
// REQ-F-GA10: Dismiss on Escape, click-outside, or item selection
// REQ-F-GA12: Pre-game menu items: Kick Player, [Transfer Host], [Toggle Voting], Game Settings
// REQ-F-GA14: In-game menu items: Kick, Restart Round, Restart Game, [Transfer Host], [Toggle Voting], Game Settings
// REQ-F-GA24: Transfer Host visible to host only
// REQ-F-GA30: Game Settings last item in menu
// REQ-F-GA39: Spectator: Game Settings only
// REQ-F-GA46: Host toggle voting control
// REQ-F-GA47: Voting disabled: items greyed with hint text
// REQ-F-GA56: Disabled items visible but greyed
// REQ-F-GA57: Kebab tooltip "Game Actions"
// REQ-F-GA58: Arrow key menu navigation
'use client';

import { memo, useState, useRef, useEffect, useCallback } from 'react';
import type { Seat } from '@tichu/shared';
import styles from './GameActionsMenu.module.css';

/** Actions that can be dispatched from the menu */
export type MenuAction =
  | { type: 'kickPlayer' }
  | { type: 'restartRound' }
  | { type: 'restartGame' }
  | { type: 'transferHost' }
  | { type: 'gameSettings' }
  | { type: 'toggleVoting' }
  | { type: 'cancelVote' };

interface MenuItem {
  action: MenuAction;
  label: string;
  disabled?: boolean;
  hint?: string;
  destructive?: boolean;
}

export interface GameActionsMenuProps {
  isHost: boolean;
  isSpectator: boolean;
  isPreGame: boolean;
  votingEnabled: boolean;
  activeVote: { initiatorSeat: Seat } | null;
  mySeat: Seat | null;
  onAction: (action: MenuAction) => void;
  /** REQ-F-GA59: Check cooldown for a given key */
  isOnCooldown?: (key: string) => boolean;
  getCooldownRemaining?: (key: string) => number;
}

export const GameActionsMenu = memo(function GameActionsMenu({
  isHost,
  isSpectator,
  isPreGame,
  votingEnabled,
  activeVote,
  mySeat,
  onAction,
  isOnCooldown,
  getCooldownRemaining,
}: GameActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<HTMLButtonElement[]>([]);

  // REQ-F-GA45: Cancel Vote replaces kebab during active vote
  const canCancelVote = activeVote && (
    isHost || (mySeat && activeVote.initiatorSeat === mySeat)
  );

  // REQ-F-GA10: Click-outside dismiss
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // REQ-F-GA10: Escape dismiss
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const handleItemClick = useCallback((action: MenuAction) => {
    setOpen(false);
    onAction(action);
  }, [onAction]);

  // Build menu items based on role and phase
  const items: MenuItem[] = [];

  if (!isSpectator) {
    // Kick Player — always first for players
    // REQ-F-GA59: Kick cooldown is per-target, checked at target selection (not menu item level)
    const kickDisabled = !isHost && !votingEnabled;
    const kickHint = kickDisabled ? 'Voting disabled by host' : undefined;
    items.push({ action: { type: 'kickPlayer' }, label: 'Kick Player', disabled: kickDisabled, hint: kickHint });

    if (!isPreGame) {
      // Restart Round
      const rrCooldown = isOnCooldown?.('restartRound') ?? false;
      const rrDisabled = (!isHost && !votingEnabled) || rrCooldown;
      let rrHint: string | undefined;
      if (!isHost && !votingEnabled) rrHint = 'Voting disabled by host';
      else if (rrCooldown) rrHint = `Cooldown (${getCooldownRemaining?.('restartRound') ?? 0}s)`;
      items.push({ action: { type: 'restartRound' }, label: 'Restart Round', disabled: rrDisabled, hint: rrHint });

      // Restart Game
      const rgCooldown = isOnCooldown?.('restartGame') ?? false;
      const rgDisabled = (!isHost && !votingEnabled) || rgCooldown;
      let rgHint: string | undefined;
      if (!isHost && !votingEnabled) rgHint = 'Voting disabled by host';
      else if (rgCooldown) rgHint = `Cooldown (${getCooldownRemaining?.('restartGame') ?? 0}s)`;
      items.push({ action: { type: 'restartGame' }, label: 'Restart Game', disabled: rgDisabled, hint: rgHint });
    }

    // REQ-F-GA24: Transfer Host — host only
    // REQ-F-GA44: Disabled during active vote
    if (isHost) {
      const transferDisabled = !!activeVote;
      items.push({ action: { type: 'transferHost' }, label: 'Transfer Host', disabled: transferDisabled, hint: transferDisabled ? 'Vote in progress' : undefined });
    }

    // REQ-F-GA46: Toggle Voting — host only
    if (isHost) {
      items.push({
        action: { type: 'toggleVoting' },
        label: votingEnabled ? 'Disable Voting' : 'Enable Voting',
      });
    }
  }

  // REQ-F-GA30: Game Settings always last
  items.push({ action: { type: 'gameSettings' }, label: 'Game Settings' });

  // REQ-F-GA58: Arrow key navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (index + 1) % itemsRef.current.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (index - 1 + itemsRef.current.length) % itemsRef.current.length;
    }
    if (nextIndex !== null) {
      itemsRef.current[nextIndex]?.focus();
    }
  }, []);

  // Focus first item when menu opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        itemsRef.current[0]?.focus();
      });
    }
  }, [open]);

  // REQ-F-GA45: Show Cancel Vote button when vote is active
  if (canCancelVote) {
    return (
      <button
        className={styles.cancelVoteButton}
        onClick={() => onAction({ type: 'cancelVote' })}
        title="Cancel Vote"
      >
        Cancel Vote
      </button>
    );
  }

  return (
    <div ref={menuRef} className={styles.container}>
      {/* REQ-F-GA07: Kebab button */}
      <button
        ref={buttonRef}
        className={styles.kebabButton}
        onClick={() => {
          setOpen(!open);
          // REQ-F-GA42: Opening kebab cancels target selection (handled by parent via onAction)
        }}
        title="Game Actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        &#x22EE;
      </button>

      {/* REQ-F-GA08: Desktop popover */}
      {open && (
        <div className={styles.popover} role="menu">
          {items.map((item, i) => (
            <button
              key={item.action.type}
              ref={(el) => { if (el) itemsRef.current[i] = el; }}
              className={`${styles.menuItem} ${item.disabled ? styles.menuItemDisabled : ''} ${item.destructive ? styles.menuItemDestructive : ''}`}
              role="menuitem"
              disabled={item.disabled}
              onClick={() => !item.disabled && handleItemClick(item.action)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              tabIndex={open ? 0 : -1}
            >
              <span className={styles.menuItemLabel}>{item.label}</span>
              {item.hint && <span className={styles.menuItemHint}>{item.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
