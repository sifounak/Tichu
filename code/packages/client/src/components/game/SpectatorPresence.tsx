'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { RoomPlayer } from '@tichu/shared';
import styles from './SpectatorPresence.module.css';

type PresenceKind = 'joined' | 'left' | 'changed';

interface PresenceToast {
  id: number;
  kind: PresenceKind;
  label: string;
  initial: string;
}

export interface SpectatorPresenceProps {
  spectatorCount: number;
  spectatorNames: string[];
  players: RoomPlayer[];
  compact?: boolean;
}

function sameNames(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const aSet = new Set(a);
  return b.every((name) => aSet.has(name));
}

function getInitial(name: string): string {
  const trimmed = name.trim();
  return (trimmed[0] ?? '?').toUpperCase();
}

function formatToast(added: string[], removed: string[]): Omit<PresenceToast, 'id'> | null {
  if (added.length > 0 && removed.length > 0) {
    return {
      kind: 'changed',
      label: `${added.length} joined, ${removed.length} left`,
      initial: '+',
    };
  }

  if (added.length === 1) {
    return {
      kind: 'joined',
      label: `${added[0]} is spectating`,
      initial: getInitial(added[0]),
    };
  }

  if (added.length > 1) {
    return {
      kind: 'joined',
      label: `${added.length} spectators joined`,
      initial: '+',
    };
  }

  if (removed.length === 1) {
    return {
      kind: 'left',
      label: `${removed[0]} left`,
      initial: getInitial(removed[0]),
    };
  }

  if (removed.length > 1) {
    return {
      kind: 'left',
      label: `${removed.length} spectators left`,
      initial: '-',
    };
  }

  return null;
}

export const SpectatorPresence = memo(function SpectatorPresence({
  spectatorCount,
  spectatorNames,
  players,
  compact = false,
}: SpectatorPresenceProps) {
  const [listOpen, setListOpen] = useState(false);
  const [toast, setToast] = useState<PresenceToast | null>(null);
  const previousNamesRef = useRef<string[] | null>(null);
  const toastIdRef = useRef(0);
  const playerNames = useMemo(() => new Set(players.map((player) => player.name)), [players]);

  useEffect(() => {
    const previousNames = previousNamesRef.current;
    previousNamesRef.current = spectatorNames;

    if (previousNames === null || sameNames(previousNames, spectatorNames)) return;

    const currentSet = new Set(spectatorNames);
    const previousSet = new Set(previousNames);
    const added = spectatorNames.filter((name) => !previousSet.has(name));
    const removed = previousNames.filter((name) => !currentSet.has(name) && !playerNames.has(name));
    const nextToast = formatToast(added, removed);

    if (!nextToast) return;

    toastIdRef.current += 1;
    setToast({ ...nextToast, id: toastIdRef.current });
  }, [playerNames, spectatorNames]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const openList = () => {
    setToast(null);
    setListOpen(true);
  };

  const closeList = () => setListOpen(false);

  return (
    <div
      className={styles.container}
      onMouseEnter={openList}
      onMouseLeave={closeList}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          closeList();
        }
      }}
    >
      <button
        type="button"
        className={`${styles.countButton} ${compact ? styles.countButtonCompact : ''}`}
        onFocus={openList}
        onClick={openList}
        aria-label={`${spectatorCount} spectator${spectatorCount === 1 ? '' : 's'}`}
        aria-expanded={listOpen}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        {spectatorCount}
      </button>

      {listOpen && (
        <div className={styles.popover} role="tooltip">
          <div className={styles.title}>
            {spectatorNames.length > 0 ? 'Spectators' : 'No Spectators'}
          </div>
          {spectatorNames.map((name) => (
            <div key={name} className={styles.name}>{name}</div>
          ))}
        </div>
      )}

      {!listOpen && toast && (
        <div
          key={toast.id}
          className={`${styles.toast} ${styles[toast.kind]}`}
          role="status"
          aria-live="polite"
        >
          <span className={styles.avatar} aria-hidden="true">{toast.initial}</span>
          <span className={styles.toastText}>{toast.label}</span>
        </div>
      )}
    </div>
  );
});
