// Verifies: REQ-F-BOT02

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegularBot } from '../../src/bot/regular-bot.js';
import type { GameCard, Seat, Rank, TrickState, RoundState, Combination } from '@tichu/shared';
import { Suit } from '@tichu/shared';
import type { BotPlayContext } from '../../src/bot/bot-interface.js';

// ─── Test Helpers ──────────────────────────────────────────────────────────

function makeStandardCard(id: number, rank: Rank, suit = Suit.Jade): GameCard {
  return { id, card: { kind: 'standard', suit, rank } };
}

function makePhoenix(id = 52): GameCard {
  return { id, card: { kind: 'phoenix' } };
}

function makeMahjong(id = 54): GameCard {
  return { id, card: { kind: 'mahjong' } };
}

function makeDragon(id = 53): GameCard {
  return { id, card: { kind: 'dragon' } };
}

function makeHand(count: number, startId = 0): GameCard[] {
  const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const suits = [Suit.Jade, Suit.Pagoda, Suit.Star, Suit.Sword];
  const cards: GameCard[] = [];
  for (let i = 0; i < count; i++) {
    cards.push(makeStandardCard(startId + i, ranks[i % 13], suits[Math.floor(i / 13)]));
  }
  return cards;
}

function makeCombination(cards: GameCard[], type = 'single', rank = 5): Combination {
  return {
    type,
    cards,
    rank,
    length: cards.length,
  } as Combination;
}

function makeMinimalRoundState(): RoundState {
  const seats: Seat[] = ['north', 'east', 'south', 'west'];
  const players = {} as Record<Seat, any>;
  for (const s of seats) {
    players[s] = {
      seat: s,
      hand: makeHand(14, seats.indexOf(s) * 14),
      tricksWon: [],
      tipiCall: 'none',
      hasPlayed: false,
      finishOrder: null,
      passedCards: { to: { north: null, east: null, south: null, west: null }, received: false },
    };
  }
  return {
    roundNumber: 1,
    phase: 'playing' as any,
    players,
    currentTrick: null,
    currentTurn: 'north',
    mahjongWish: null,
    wishFulfilled: false,
    finishOrder: [],
    dragonGiftPending: null,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('RegularBot', () => {
  let bot: RegularBot;

  beforeEach(() => {
    bot = new RegularBot();
  });

  describe('difficulty', () => {
    it('should report regular difficulty', () => {
      expect(bot.difficulty).toBe('regular');
    });
  });

  describe('chooseGrandTichu', () => {
    it('should always pass on Grand Tichu', () => {
      const hand8 = makeHand(8);
      expect(bot.chooseGrandTichu(hand8)).toBe(false);
    });

    it('should pass even with a great hand', () => {
      // All aces + dragon
      const greatHand = [
        makeStandardCard(0, 14, Suit.Jade),
        makeStandardCard(1, 14, Suit.Pagoda),
        makeStandardCard(2, 14, Suit.Star),
        makeStandardCard(3, 14, Suit.Sword),
        makeDragon(),
        makePhoenix(),
        makeStandardCard(6, 13, Suit.Jade),
        makeStandardCard(7, 13, Suit.Pagoda),
      ];
      expect(bot.chooseGrandTichu(greatHand)).toBe(false);
    });
  });

  describe('chooseRegularTichu', () => {
    it('should always pass on Regular Tichu', () => {
      const hand14 = makeHand(14);
      expect(bot.chooseRegularTichu(hand14)).toBe(false);
    });
  });

  describe('chooseCardsToPass', () => {
    it('should pass exactly 3 cards to other players', () => {
      const hand = makeHand(14);
      const result = bot.chooseCardsToPass(hand, 'north');

      // Should have cards for east, south, west
      expect(result.east).toBeDefined();
      expect(result.south).toBeDefined();
      expect(result.west).toBeDefined();

      // Should not have a card for self
      expect(result.north).toBeUndefined();
    });

    it('should pass 3 distinct cards', () => {
      const hand = makeHand(14);
      const result = bot.chooseCardsToPass(hand, 'south');

      const passedIds = [result.north.id, result.east.id, result.west.id];
      const unique = new Set(passedIds);
      expect(unique.size).toBe(3);
    });

    it('should pass cards from the hand', () => {
      const hand = makeHand(14);
      const handIds = new Set(hand.map((gc) => gc.id));
      const result = bot.chooseCardsToPass(hand, 'east');

      expect(handIds.has(result.north.id)).toBe(true);
      expect(handIds.has(result.south.id)).toBe(true);
      expect(handIds.has(result.west.id)).toBe(true);
    });
  });

  describe('choosePlay', () => {
    it('should pass when no valid plays exist', () => {
      const context: BotPlayContext = {
        hand: makeHand(5),
        currentTrick: null,
        wish: null,
        validPlays: [],
        canPass: true,
        roundState: makeMinimalRoundState(),
        seat: 'north',
      };
      const decision = bot.choosePlay(context);
      expect(decision.action).toBe('pass');
    });

    it('should play when valid plays exist and cannot pass', () => {
      const cards = [makeStandardCard(0, 5)];
      const combo = makeCombination(cards, 'single', 5);

      const context: BotPlayContext = {
        hand: makeHand(14),
        currentTrick: null,
        wish: null,
        validPlays: [combo],
        canPass: false,
        roundState: makeMinimalRoundState(),
        seat: 'north',
      };
      const decision = bot.choosePlay(context);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        expect(decision.cards).toEqual(cards);
      }
    });

    it('should sometimes pass when allowed (statistical test)', () => {
      const cards = [makeStandardCard(0, 5)];
      const combo = makeCombination(cards, 'single', 5);

      const context: BotPlayContext = {
        hand: makeHand(14),
        currentTrick: null,
        wish: null,
        validPlays: [combo],
        canPass: true,
        roundState: makeMinimalRoundState(),
        seat: 'north',
      };

      // Run multiple times to check that both play and pass occur
      let playCount = 0;
      let passCount = 0;
      for (let i = 0; i < 100; i++) {
        const decision = bot.choosePlay(context);
        if (decision.action === 'play') playCount++;
        else passCount++;
      }

      // With 30% pass rate and 100 trials, both should occur
      expect(playCount).toBeGreaterThan(0);
      expect(passCount).toBeGreaterThan(0);
    });

    it('should select from multiple valid plays', () => {
      const combo1 = makeCombination([makeStandardCard(0, 5)], 'single', 5);
      const combo2 = makeCombination([makeStandardCard(1, 7)], 'single', 7);
      const combo3 = makeCombination([makeStandardCard(2, 9)], 'single', 9);

      const context: BotPlayContext = {
        hand: makeHand(14),
        currentTrick: null,
        wish: null,
        validPlays: [combo1, combo2, combo3],
        canPass: false,
        roundState: makeMinimalRoundState(),
        seat: 'north',
      };

      // Run multiple times and check different plays are chosen
      const chosen = new Set<number>();
      for (let i = 0; i < 100; i++) {
        const decision = bot.choosePlay(context);
        if (decision.action === 'play') {
          chosen.add(decision.cards[0].id);
        }
      }
      // Should choose at least 2 different plays in 100 trials
      expect(chosen.size).toBeGreaterThanOrEqual(2);
    });

    it('should include phoenixAs when Phoenix is used with resolved value', () => {
      const phoenix = makePhoenix();
      const cards = [phoenix, makeStandardCard(1, 7)];
      const combo: Combination = {
        type: 'pair',
        cards,
        rank: 7,
        length: 2,
        phoenixUsedAs: 7,
      } as Combination;

      const context: BotPlayContext = {
        hand: [...cards, ...makeHand(12, 10)],
        currentTrick: null,
        wish: null,
        validPlays: [combo],
        canPass: false,
        roundState: makeMinimalRoundState(),
        seat: 'north',
      };

      // Force play (not pass)
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const decision = bot.choosePlay(context);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        expect(decision.phoenixAs).toBe(7);
      }
      vi.restoreAllMocks();
    });
  });

  describe('chooseDragonGiftRecipient', () => {
    it('should choose from available opponents', () => {
      const opponents: Seat[] = ['east', 'west'];
      const result = bot.chooseDragonGiftRecipient(opponents, 50);
      expect(opponents).toContain(result);
    });

    it('should return the only opponent when just one available', () => {
      const opponents: Seat[] = ['west'];
      const result = bot.chooseDragonGiftRecipient(opponents, 25);
      expect(result).toBe('west');
    });

    it('should choose from both opponents over many runs', () => {
      const opponents: Seat[] = ['east', 'west'];
      const chosen = new Set<Seat>();
      for (let i = 0; i < 100; i++) {
        chosen.add(bot.chooseDragonGiftRecipient(opponents, 50));
      }
      expect(chosen.size).toBe(2);
    });
  });

  describe('chooseMahjongWish', () => {
    it('should always return null (no wish)', () => {
      const hand = makeHand(14);
      expect(bot.chooseMahjongWish(hand)).toBeNull();
    });
  });
});
