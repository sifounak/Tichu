// Verifies: REQ-F-INFO02 (Expert bot top-10 card tracking + bomb detection)

import { describe, it, expect, beforeEach } from 'vitest';
import type { GameCard, Rank, Seat, RoundState, TrickState, Combination } from '@tichu/shared';
import { CombinationType, Suit } from '@tichu/shared';
import { CardTracker } from '../../src/bot/card-tracker.js';

// ─── Test Helpers ───────────────────────────────────────────────────────────

let nextId = 1;

function card(kind: string, rank?: number, suit?: string, id?: number): GameCard {
  if (kind === 'standard') {
    return {
      id: id ?? nextId++,
      card: { kind: 'standard', rank: rank as Rank, suit: suit as any ?? Suit.Jade },
    };
  }
  const idMap: Record<string, number> = { dragon: 900, phoenix: 901, mahjong: 902, dog: 903 };
  return { id: id ?? idMap[kind], card: { kind } as any };
}

function makeRoundState(overrides: Partial<Record<string, any>> = {}): RoundState {
  return {
    roundNumber: 1,
    phase: 'playing',
    currentTrick: null,
    currentTurn: 'north',
    mahjongWish: null,
    wishFulfilled: false,
    finishOrder: [],
    dragonGiftPending: null,
    dragonGiftedTo: null,
    lastDogPlay: null,
    bombsPerTeam: { northSouth: 0, eastWest: 0 },
    players: {
      north: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
      east: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
      south: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
      west: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
    },
    ...overrides,
  } as any;
}

function makeCombo(
  type: CombinationType,
  cards: GameCard[],
  rank: number,
  isBomb = false,
): Combination {
  return { type, cards, rank, length: cards.length, isBomb };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CardTracker', () => {
  let tracker: CardTracker;

  beforeEach(() => {
    nextId = 1;
    tracker = new CardTracker();
  });

  // Verifies: REQ-F-INFO02 (initial state)
  describe('initial state', () => {
    it('reports all top-10 as unplayed initially', () => {
      tracker.update(makeRoundState(), 'north', []);
      const status = tracker.getTop10Status();
      expect(status.length).toBe(10); // Dragon, Phoenix, 4 Aces, 4 Kings
      expect(status.every((s) => !s.played)).toBe(true);
    });

    it('counts 10 unaccounted top cards with empty hand', () => {
      tracker.update(makeRoundState(), 'north', []);
      expect(tracker.getUnaccountedTop10Count()).toBe(10);
    });
  });

  // Verifies: REQ-F-INFO02 (tracking played cards)
  describe('tracking played cards from tricks won', () => {
    it('tracks Dragon when it appears in a won trick', () => {
      const dragonCard = card('dragon');
      const rs = makeRoundState({
        players: {
          north: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [], tricksWon: [[dragonCard, card('standard', 5, 'jade', 50)]], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      tracker.update(rs, 'north', []);
      expect(tracker.isDragonUnaccounted()).toBe(false);
    });

    it('tracks Phoenix when it appears in a won trick', () => {
      const phoenixCard = card('phoenix');
      const rs = makeRoundState({
        players: {
          north: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: [], tricksWon: [[phoenixCard]], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      tracker.update(rs, 'north', []);
      expect(tracker.isPhoenixUnaccounted()).toBe(false);
    });

    it('tracks Aces across multiple tricks', () => {
      const ace1 = card('standard', 14, 'jade', 1401);
      const ace2 = card('standard', 14, 'pagoda', 1402);
      const rs = makeRoundState({
        players: {
          north: { hand: [], tricksWon: [[ace1]], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [], tricksWon: [[ace2]], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      tracker.update(rs, 'north', []);
      expect(tracker.getUnaccountedAces()).toBe(2); // 4 - 2 played
    });
  });

  // Verifies: REQ-F-INFO02 (tracking current trick)
  describe('tracking current trick', () => {
    it('tracks cards in the current trick', () => {
      const kingCard = card('standard', 13, 'jade', 1301);
      const trick: TrickState = {
        plays: [
          { seat: 'east' as Seat, combination: makeCombo(CombinationType.Single, [kingCard], 13) },
        ],
        passes: [],
        leadSeat: 'east' as Seat,
        currentWinner: 'east' as Seat,
      };

      const rs = makeRoundState({ currentTrick: trick });
      tracker.update(rs, 'north', []);
      expect(tracker.getUnaccountedKings()).toBe(3); // 4 - 1 in trick
    });
  });

  // Verifies: REQ-F-INFO02 (own hand tracking)
  describe('own hand tracking', () => {
    it('accounts for cards in own hand', () => {
      const ownAce = card('standard', 14, 'star', 1403);
      const ownDragon = card('dragon');

      tracker.update(makeRoundState(), 'north', [ownAce, ownDragon]);

      expect(tracker.getUnaccountedAces()).toBe(3); // 4 - 1 in hand
      expect(tracker.isDragonUnaccounted()).toBe(false); // In our hand
    });

    it('correctly updates when hand changes', () => {
      const ownAce = card('standard', 14, 'star', 1403);
      tracker.update(makeRoundState(), 'north', [ownAce]);
      expect(tracker.getUnaccountedAces()).toBe(3);

      // After playing the Ace, hand is empty
      tracker.update(makeRoundState(), 'north', []);
      expect(tracker.getUnaccountedAces()).toBe(4); // Unless it's in a trick
    });
  });

  // Verifies: REQ-F-INFO02 (absent rank bomb detection)
  describe('absent rank bomb detection', () => {
    it('flags ranks where 3+ cards are unaccounted for', () => {
      // With no cards played and empty hand, all ranks 2-14 have 4 unaccounted
      tracker.update(makeRoundState(), 'north', []);
      const absent = tracker.getAbsentRanks();
      // All 13 ranks (2-14) should have 4 unaccounted
      expect(absent.length).toBe(13);
      expect(absent.every((a) => a.unaccounted === 4)).toBe(true);
    });

    it('does not flag ranks where we hold cards', () => {
      // Hold 2 fives → only 2 unaccounted → not flagged (threshold is 3)
      const hand = [
        card('standard', 5, 'jade', 501),
        card('standard', 5, 'pagoda', 502),
      ];
      tracker.update(makeRoundState(), 'north', hand);
      const absent = tracker.getAbsentRanks();
      const fiveEntry = absent.find((a) => a.rank === 5);
      // 4 - 0 played - 2 in hand = 2, which is < 3, so not flagged
      expect(fiveEntry).toBeUndefined();
    });

    it('reduces unaccounted when cards are played', () => {
      const five1 = card('standard', 5, 'jade', 501);
      const five2 = card('standard', 5, 'pagoda', 502);

      const rs = makeRoundState({
        players: {
          north: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [], tricksWon: [[five1, five2]], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      tracker.update(rs, 'north', []);
      const absent = tracker.getAbsentRanks();
      const fiveEntry = absent.find((a) => a.rank === 5);
      // 4 - 2 played = 2 unaccounted → not flagged
      expect(fiveEntry).toBeUndefined();
    });

    it('detects potential opponent bomb', () => {
      // No 8s have been played and we don't hold any
      tracker.update(makeRoundState(), 'north', []);
      expect(tracker.couldOpponentHaveBomb(8)).toBe(true);

      // After seeing one 8, they can't have a bomb
      const eight1 = card('standard', 8, 'jade', 801);
      const rs = makeRoundState({
        players: {
          north: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [], tricksWon: [[eight1]], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });
      tracker.update(rs, 'north', []);
      expect(tracker.couldOpponentHaveBomb(8)).toBe(false);
    });
  });

  // Verifies: REQ-F-INFO02 (reset)
  describe('reset', () => {
    it('clears all tracking on reset', () => {
      const dragonCard = card('dragon');
      const rs = makeRoundState({
        players: {
          north: { hand: [], tricksWon: [[dragonCard]], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      tracker.update(rs, 'north', []);
      expect(tracker.isDragonUnaccounted()).toBe(false);

      tracker.reset();
      tracker.update(makeRoundState(), 'north', []);
      expect(tracker.isDragonUnaccounted()).toBe(true);
    });
  });

  // Verifies: REQ-F-INFO02 (no double counting)
  describe('duplicate card handling', () => {
    it('does not double-count cards seen multiple times', () => {
      const ace = card('standard', 14, 'jade', 1401);

      // Same ace appears in two update calls
      const rs = makeRoundState({
        players: {
          north: { hand: [], tricksWon: [[ace]], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      tracker.update(rs, 'north', []);
      tracker.update(rs, 'north', []);

      // Should still show only 1 ace played, not 2
      const acePlayed = tracker.getTop10Status().filter(
        (s) => s.description.startsWith('Ace') && s.played,
      );
      expect(acePlayed.length).toBe(1);
    });
  });

  // Verifies: REQ-F-INFO02 (comprehensive round scenario)
  describe('full round scenario', () => {
    it('tracks cards through multiple tricks in a round', () => {
      const dragon = card('dragon');
      const ace1 = card('standard', 14, 'jade', 1401);
      const ace2 = card('standard', 14, 'pagoda', 1402);
      const king1 = card('standard', 13, 'jade', 1301);
      const phoenix = card('phoenix');
      const ownAce = card('standard', 14, 'star', 1403);

      // Round state: some cards in won tricks, one in current trick
      const trick: TrickState = {
        plays: [
          { seat: 'west' as Seat, combination: makeCombo(CombinationType.Single, [king1], 13) },
          { seat: 'north' as Seat, combination: makeCombo(CombinationType.Single, [ace1], 14) },
        ],
        passes: [],
        leadSeat: 'west' as Seat,
        currentWinner: 'north' as Seat,
      };

      const rs = makeRoundState({
        currentTrick: trick,
        players: {
          north: { hand: [ownAce], tricksWon: [[dragon, ace2]], tipiCall: 'none', hasPlayed: true, finishOrder: null },
          east: { hand: [], tricksWon: [[phoenix]], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      tracker.update(rs, 'north', [ownAce]);

      // Dragon: played (in north's tricks)
      expect(tracker.isDragonUnaccounted()).toBe(false);
      // Phoenix: played (in east's tricks)
      expect(tracker.isPhoenixUnaccounted()).toBe(false);
      // Aces: ace1 in current trick, ace2 in won trick, ownAce in hand = 3 accounted, 1 left
      expect(tracker.getUnaccountedAces()).toBe(1);
      // Kings: king1 in current trick = 1 accounted, 3 left
      expect(tracker.getUnaccountedKings()).toBe(3);
      // Total unaccounted: 0 (dragon) + 0 (phoenix) + 1 (ace) + 3 (king) = 4
      expect(tracker.getUnaccountedTop10Count()).toBe(4);
    });
  });

  // ─── Point Tracking (REQ-F-TRK01) ────────────────────────────────────────

  describe('getApproxTeamPoints', () => {
    // Verifies: REQ-F-TRK01
    it('computes points for 5s, 10s, Kings, Dragon, Phoenix', () => {
      const tracker = new CardTracker();
      const rs = makeRoundState({
        players: {
          north: {
            hand: [],
            tricksWon: [
              [card('standard', 5, 'jade', 51), card('standard', 10, 'jade', 101)], // 5 + 10 = 15
              [card('dragon')], // 25
            ],
            tipiCall: 'none', hasPlayed: false, finishOrder: null,
          },
          east: {
            hand: [],
            tricksWon: [
              [card('standard', 13, 'jade', 131), card('phoenix')], // 10 + (-25) = -15
            ],
            tipiCall: 'none', hasPlayed: false, finishOrder: null,
          },
          south: {
            hand: [],
            tricksWon: [
              [card('standard', 5, 'pagoda', 52)], // 5
            ],
            tipiCall: 'none', hasPlayed: false, finishOrder: null,
          },
          west: {
            hand: [],
            tricksWon: [],
            tipiCall: 'none', hasPlayed: false, finishOrder: null,
          },
        },
      });

      // northSouth: north(15+25) + south(5) = 45
      expect(tracker.getApproxTeamPoints(rs, 'northSouth')).toBe(45);
      // eastWest: east(-15) + west(0) = -15
      expect(tracker.getApproxTeamPoints(rs, 'eastWest')).toBe(-15);
    });

    it('returns 0 when no tricks won', () => {
      const tracker = new CardTracker();
      const rs = makeRoundState();
      expect(tracker.getApproxTeamPoints(rs, 'northSouth')).toBe(0);
      expect(tracker.getApproxTeamPoints(rs, 'eastWest')).toBe(0);
    });

    it('counts cards with no point value as 0', () => {
      const tracker = new CardTracker();
      const rs = makeRoundState({
        players: {
          north: {
            hand: [],
            tricksWon: [
              [card('standard', 2, 'jade', 21), card('standard', 8, 'jade', 81), card('mahjong')],
            ],
            tipiCall: 'none', hasPlayed: false, finishOrder: null,
          },
          east: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });
      expect(tracker.getApproxTeamPoints(rs, 'northSouth')).toBe(0);
    });
  });

  // ─── Convenience Methods (REQ-F-TRK02) ──────────────────────────────────

  describe('allAcesPlayed', () => {
    // Verifies: REQ-F-TRK02
    it('returns false initially (Aces unplayed)', () => {
      tracker.update(makeRoundState(), 'north', []);
      expect(tracker.allAcesPlayed()).toBe(false);
    });

    it('returns false when Aces in own hand', () => {
      const ownHand = [
        card('standard', 14, 'jade', 2001),
        card('standard', 14, 'pagoda', 2002),
        card('standard', 14, 'star', 2003),
        card('standard', 14, 'sword', 2004),
      ];
      tracker.update(makeRoundState(), 'north', ownHand);
      expect(tracker.allAcesPlayed()).toBe(false); // In hand, not played
    });

    it('returns true when all 4 Aces have been played by others', () => {
      const aces = [
        card('standard', 14, 'jade', 3001),
        card('standard', 14, 'pagoda', 3002),
        card('standard', 14, 'star', 3003),
        card('standard', 14, 'sword', 3004),
      ];
      const rs = makeRoundState({
        players: {
          north: { hand: [card('standard', 5, 'jade', 5001)], tricksWon: [], tipiCall: 'none', hasPlayed: true, finishOrder: null },
          east: { hand: [], tricksWon: [aces.slice(0, 2)], tipiCall: 'none', hasPlayed: true, finishOrder: null },
          south: { hand: [], tricksWon: [aces.slice(2, 4)], tipiCall: 'none', hasPlayed: true, finishOrder: null },
          west: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });
      tracker.update(rs, 'north', [card('standard', 5, 'jade', 5001)]);
      expect(tracker.allAcesPlayed()).toBe(true);
    });
  });

  describe('allAcesAccountedFor', () => {
    it('returns true when all Aces in own hand', () => {
      const ownHand = [
        card('standard', 14, 'jade', 4001),
        card('standard', 14, 'pagoda', 4002),
        card('standard', 14, 'star', 4003),
        card('standard', 14, 'sword', 4004),
      ];
      tracker.update(makeRoundState(), 'north', ownHand);
      expect(tracker.allAcesAccountedFor()).toBe(true);
    });

    it('returns false when some Aces unaccounted', () => {
      const ownHand = [card('standard', 14, 'jade', 4001)];
      tracker.update(makeRoundState(), 'north', ownHand);
      expect(tracker.allAcesAccountedFor()).toBe(false);
    });
  });

  describe('isDragonPlayed', () => {
    it('returns false initially', () => {
      tracker.update(makeRoundState(), 'north', []);
      expect(tracker.isDragonPlayed()).toBe(false);
    });

    it('returns true after Dragon appears in tricks', () => {
      const dragonCard = card('dragon');
      const rs = makeRoundState({
        players: {
          north: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: true, finishOrder: null },
          east: { hand: [], tricksWon: [[dragonCard]], tipiCall: 'none', hasPlayed: true, finishOrder: null },
          south: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });
      tracker.update(rs, 'north', []);
      expect(tracker.isDragonPlayed()).toBe(true);
    });
  });
});
