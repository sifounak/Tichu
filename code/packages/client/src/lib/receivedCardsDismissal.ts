import type { GameCard, Seat, TrickState } from '@tichu/shared';

const DISMISS_PREFIX = 'tichu_received_dismissed_v2_';
const LEGACY_DISMISS_PREFIX = 'tichu_received_dismissed_';

function getStorage(kind: 'localStorage' | 'sessionStorage'): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window[kind] ?? null;
  } catch {
    return null;
  }
}

function hasStorageValue(key: string): boolean {
  for (const kind of ['localStorage', 'sessionStorage'] as const) {
    const storage = getStorage(kind);
    try {
      if (storage?.getItem(key)) return true;
    } catch {
      // Ignore blocked storage.
    }
  }
  return false;
}

function setStorageValue(key: string): void {
  for (const kind of ['localStorage', 'sessionStorage'] as const) {
    const storage = getStorage(kind);
    try {
      storage?.setItem(key, '1');
    } catch {
      // Ignore blocked storage.
    }
  }
}

function removeStorageValue(key: string): void {
  for (const kind of ['localStorage', 'sessionStorage'] as const) {
    const storage = getStorage(kind);
    try {
      storage?.removeItem(key);
    } catch {
      // Ignore blocked storage.
    }
  }
}

export function buildReceivedCardsDismissKey(params: {
  gameId: string | null;
  roundIndex: number;
  mySeat: Seat | null;
  receivedCards: Record<Seat, GameCard | null>;
}): string | null {
  const { gameId, roundIndex, mySeat, receivedCards } = params;
  if (!gameId || !mySeat) return null;

  const signature = Object.entries(receivedCards)
    .filter(([, card]) => card !== null)
    .map(([seat, card]) => `${seat}:${card!.id}`)
    .sort()
    .join(',');

  if (!signature) return null;
  return `${DISMISS_PREFIX}${gameId}_${roundIndex}_${mySeat}_${signature}`;
}

export function buildLegacyReceivedCardsDismissKey(gameId: string | null, roundIndex: number): string | null {
  return gameId ? `${LEGACY_DISMISS_PREFIX}${gameId}_${roundIndex}` : null;
}

export function isReceivedCardsDismissed(key: string | null, legacyKey?: string | null): boolean {
  return Boolean((key && hasStorageValue(key)) || (legacyKey && hasStorageValue(legacyKey)));
}

export function markReceivedCardsDismissed(key: string | null, legacyKey?: string | null): void {
  if (key) setStorageValue(key);
  if (legacyKey) setStorageValue(legacyKey);
}

export function clearReceivedCardsDismissals(gameId: string | null): void {
  const prefixes = gameId
    ? [`${DISMISS_PREFIX}${gameId}_`, `${LEGACY_DISMISS_PREFIX}${gameId}_`]
    : [DISMISS_PREFIX, LEGACY_DISMISS_PREFIX];

  for (const kind of ['localStorage', 'sessionStorage'] as const) {
    const storage = getStorage(kind);
    if (!storage) continue;
    try {
      for (let i = storage.length - 1; i >= 0; i -= 1) {
        const key = storage.key(i);
        if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
          removeStorageValue(key);
        }
      }
    } catch {
      // Ignore blocked storage.
    }
  }
}

export function hasTakenTurnAfterReceivingCards(params: {
  mySeat: Seat | null;
  hasPlayedCards: boolean;
  currentTrick: TrickState | null;
}): boolean {
  const { mySeat, hasPlayedCards, currentTrick } = params;
  if (!mySeat) return false;
  if (hasPlayedCards) return true;

  return Boolean(
    currentTrick?.plays.some((play) => play.seat === mySeat) ||
    currentTrick?.passes.includes(mySeat),
  );
}
