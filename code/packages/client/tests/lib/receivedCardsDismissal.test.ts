import { beforeEach, describe, expect, it } from 'vitest';
import type { CardId, Combination, GameCard, Seat, TrickState } from '@tichu/shared';
import {
  buildLegacyReceivedCardsDismissKey,
  buildReceivedCardsDismissKey,
  clearReceivedCardsDismissals,
  hasTakenTurnAfterReceivingCards,
  isReceivedCardsDismissed,
  markReceivedCardsDismissed,
} from '@/lib/receivedCardsDismissal';

function makeCard(id: number): GameCard {
  return { id: id as CardId, card: { kind: 'standard', suit: 'jade', rank: 2 } };
}

const emptyReceived = {
  north: null,
  east: null,
  south: null,
  west: null,
} satisfies Record<Seat, GameCard | null>;

const singleCombination = {
  type: 'single',
  cards: [makeCard(1)],
  rank: 2,
  points: 0,
  isBomb: false,
} as Combination;

function makeTrick(overrides: Partial<TrickState> = {}): TrickState {
  return {
    plays: [],
    passes: [],
    leadSeat: 'north',
    currentWinner: 'north',
    ...overrides,
  };
}

describe('receivedCardsDismissal', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('builds a stable key from game, round, seat, and received card ids', () => {
    const key = buildReceivedCardsDismissKey({
      gameId: 'game-1',
      roundIndex: 2,
      mySeat: 'south',
      receivedCards: {
        ...emptyReceived,
        west: makeCard(23),
        north: makeCard(11),
        east: makeCard(19),
      },
    });

    expect(key).toBe('tichu_received_dismissed_v2_game-1_2_south_east:19,north:11,west:23');
  });

  it('does not build a key until the exchange is identifiable', () => {
    expect(buildReceivedCardsDismissKey({
      gameId: null,
      roundIndex: 0,
      mySeat: 'south',
      receivedCards: { ...emptyReceived, north: makeCard(11) },
    })).toBeNull();
    expect(buildReceivedCardsDismissKey({
      gameId: 'game-1',
      roundIndex: 0,
      mySeat: null,
      receivedCards: { ...emptyReceived, north: makeCard(11) },
    })).toBeNull();
    expect(buildReceivedCardsDismissKey({
      gameId: 'game-1',
      roundIndex: 0,
      mySeat: 'south',
      receivedCards: emptyReceived,
    })).toBeNull();
  });

  it('persists dismissals in localStorage and sessionStorage', () => {
    const key = 'tichu_received_dismissed_v2_game-1_0_south_north:11';

    markReceivedCardsDismissed(key);

    expect(window.localStorage.getItem(key)).toBe('1');
    expect(window.sessionStorage.getItem(key)).toBe('1');
    expect(isReceivedCardsDismissed(key)).toBe(true);
  });

  it('honors legacy sessionStorage dismissals during migration', () => {
    const key = 'tichu_received_dismissed_v2_game-1_0_south_north:11';
    const legacyKey = buildLegacyReceivedCardsDismissKey('game-1', 0)!;
    window.sessionStorage.setItem(legacyKey, '1');

    expect(isReceivedCardsDismissed(key, legacyKey)).toBe(true);
  });

  it('clears dismissals for one game without touching other games', () => {
    const current = 'tichu_received_dismissed_v2_game-1_0_south_north:11';
    const legacy = buildLegacyReceivedCardsDismissKey('game-1', 0)!;
    const other = 'tichu_received_dismissed_v2_game-2_0_south_north:11';
    markReceivedCardsDismissed(current, legacy);
    markReceivedCardsDismissed(other);

    clearReceivedCardsDismissals('game-1');

    expect(isReceivedCardsDismissed(current, legacy)).toBe(false);
    expect(isReceivedCardsDismissed(other)).toBe(true);
  });

  it('detects that the player has taken a turn by playing cards', () => {
    expect(hasTakenTurnAfterReceivingCards({
      mySeat: 'south',
      hasPlayedCards: true,
      currentTrick: null,
    })).toBe(true);
    expect(hasTakenTurnAfterReceivingCards({
      mySeat: 'south',
      hasPlayedCards: false,
      currentTrick: makeTrick({
        plays: [{ seat: 'south', combination: singleCombination }],
      }),
    })).toBe(true);
  });

  it('detects that the player has taken a turn by passing', () => {
    expect(hasTakenTurnAfterReceivingCards({
      mySeat: 'south',
      hasPlayedCards: false,
      currentTrick: makeTrick({ passes: ['south'] }),
    })).toBe(true);
  });

  it('does not detect a turn before the player acts', () => {
    expect(hasTakenTurnAfterReceivingCards({
      mySeat: null,
      hasPlayedCards: true,
      currentTrick: makeTrick({ passes: ['south'] }),
    })).toBe(false);
    expect(hasTakenTurnAfterReceivingCards({
      mySeat: 'south',
      hasPlayedCards: false,
      currentTrick: makeTrick({
        plays: [{ seat: 'west', combination: singleCombination }],
        passes: ['east'],
      }),
    })).toBe(false);
  });
});
