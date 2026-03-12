// Verifies: REQ-F-SC01, REQ-F-SC02, REQ-F-SC03, REQ-F-GF08, REQ-F-GF09, REQ-F-GF10

import { describe, it, expect } from 'vitest';
import { getCardsPoints, getTrickPoints, scoreRound, checkGameOver } from '../../src/engine/scoring.js';
import { createDeck } from '../../src/engine/deck.js';
import type { GameCard } from '../../src/types/card.js';
import type { Seat, Team, TichuCall } from '../../src/types/game.js';

// --- Test Helpers ---

const deck = createDeck();

/** Find a card by kind */
function findCard(kind: string): GameCard {
  return deck.find((gc) => gc.card.kind === kind)!;
}

/** Find a standard card by rank */
function findStandard(rank: number, suitIdx = 0): GameCard {
  const suits = ['jade', 'pagoda', 'star', 'sword'];
  return deck.find(
    (gc) => gc.card.kind === 'standard' && gc.card.rank === rank && gc.card.suit === suits[suitIdx],
  )!;
}

function noCall(): Record<Seat, TichuCall> {
  return { north: 'none', east: 'none', south: 'none', west: 'none' };
}

function emptyHands(): Record<Seat, GameCard[]> {
  return { north: [], east: [], south: [], west: [] };
}

function emptyTricks(): Record<Seat, GameCard[][]> {
  return { north: [], east: [], south: [], west: [] };
}

// --- getCardsPoints ---

describe('getCardsPoints', () => {
  // Verifies: REQ-F-SC01 (card point values)
  it('returns 0 for empty array', () => {
    expect(getCardsPoints([])).toBe(0);
  });

  it('returns 25 for Dragon', () => {
    expect(getCardsPoints([findCard('dragon')])).toBe(25);
  });

  it('returns -25 for Phoenix', () => {
    expect(getCardsPoints([findCard('phoenix')])).toBe(-25);
  });

  it('returns 10 for a King', () => {
    expect(getCardsPoints([findStandard(13)])).toBe(10);
  });

  it('returns 10 for a Ten', () => {
    expect(getCardsPoints([findStandard(10)])).toBe(10);
  });

  it('returns 5 for a Five', () => {
    expect(getCardsPoints([findStandard(5)])).toBe(5);
  });

  it('returns 0 for Mahjong', () => {
    expect(getCardsPoints([findCard('mahjong')])).toBe(0);
  });

  it('returns 0 for Dog', () => {
    expect(getCardsPoints([findCard('dog')])).toBe(0);
  });

  it('returns 0 for a non-scoring standard card', () => {
    expect(getCardsPoints([findStandard(7)])).toBe(0);
  });

  it('sums multiple cards correctly', () => {
    const cards = [findCard('dragon'), findCard('phoenix'), findStandard(13), findStandard(5)];
    // 25 + (-25) + 10 + 5 = 15
    expect(getCardsPoints(cards)).toBe(15);
  });

  it('full deck sums to 100', () => {
    expect(getCardsPoints(deck)).toBe(100);
  });
});

// --- getTrickPoints ---

describe('getTrickPoints', () => {
  // Verifies: REQ-F-SC01
  it('returns 0 for no tricks', () => {
    expect(getTrickPoints([])).toBe(0);
  });

  it('sums across multiple tricks', () => {
    const trick1 = [findStandard(13), findStandard(13, 1)]; // 10 + 10
    const trick2 = [findStandard(5), findStandard(7)]; // 5 + 0
    expect(getTrickPoints([trick1, trick2])).toBe(25);
  });
});

// --- scoreRound ---

describe('scoreRound', () => {
  // Verifies: REQ-F-SC01 — standard round scoring
  it('scores a simple round with no bonuses', () => {
    const finishOrder: Seat[] = ['north', 'east', 'south', 'west'];
    const tricks = emptyTricks();
    // North won tricks with Kings (20 points), East won tricks with Tens (20 points)
    tricks.north = [[findStandard(13), findStandard(13, 1)]]; // 20 pts
    tricks.east = [[findStandard(10), findStandard(10, 1)]]; // 20 pts
    tricks.south = [[findStandard(5), findStandard(5, 1)]]; // 10 pts
    // West (last) has Dragon in tricks + some cards in hand
    tricks.west = [[findCard('dragon')]]; // 25 pts

    const hands = emptyHands();
    // West (last player) has Phoenix left in hand
    hands.west = [findCard('phoenix')]; // -25 pts to opponents (NS)

    const result = scoreRound(1, finishOrder, tricks, hands, noCall());

    // West is last (seat west = EW team)
    // West's tricks (25) go to first-out (north = NS team)
    // West's hand points (-25) go to opposing team (NS)
    // NS: north(20) + south(10) + west_tricks(25) + west_hand(-25) = 30
    // EW: east(20) + 0 = 20
    expect(result.cardPoints.northSouth).toBe(30);
    expect(result.cardPoints.eastWest).toBe(20);
    expect(result.total.northSouth).toBe(30);
    expect(result.total.eastWest).toBe(20);
    expect(result.oneTwoBonus).toBeNull();
  });

  // Verifies: REQ-F-SC02 — 1-2 finish bonus
  it('scores 1-2 finish for northSouth team', () => {
    // North and South go out first and second
    const finishOrder: Seat[] = ['north', 'south', 'east', 'west'];
    const result = scoreRound(1, finishOrder, emptyTricks(), emptyHands(), noCall());

    expect(result.cardPoints.northSouth).toBe(200);
    expect(result.cardPoints.eastWest).toBe(0);
    expect(result.oneTwoBonus).toBe('northSouth');
    expect(result.total.northSouth).toBe(200);
    expect(result.total.eastWest).toBe(0);
  });

  it('scores 1-2 finish for eastWest team', () => {
    const finishOrder: Seat[] = ['east', 'west', 'north', 'south'];
    const result = scoreRound(1, finishOrder, emptyTricks(), emptyHands(), noCall());

    expect(result.cardPoints.eastWest).toBe(200);
    expect(result.cardPoints.northSouth).toBe(0);
    expect(result.oneTwoBonus).toBe('eastWest');
  });

  it('does not trigger 1-2 bonus when partners finish 1st and 3rd', () => {
    const finishOrder: Seat[] = ['north', 'east', 'south', 'west'];
    const result = scoreRound(1, finishOrder, emptyTricks(), emptyHands(), noCall());
    expect(result.oneTwoBonus).toBeNull();
  });

  // Verifies: REQ-F-SC03 — Last player redistribution
  it('gives last player tricks to first-out player', () => {
    const finishOrder: Seat[] = ['north', 'east', 'south', 'west'];
    const tricks = emptyTricks();
    tricks.west = [[findStandard(13), findStandard(10)]]; // 20 pts in west's tricks

    const result = scoreRound(1, finishOrder, tricks, emptyHands(), noCall());

    // West's tricks go to North (first out), both NS team
    // NS: 20, EW: 0
    expect(result.cardPoints.northSouth).toBe(20);
    expect(result.cardPoints.eastWest).toBe(0);
  });

  it('gives last player hand points to opposing team', () => {
    const finishOrder: Seat[] = ['north', 'east', 'south', 'west'];
    const hands = emptyHands();
    hands.west = [findStandard(13), findStandard(10)]; // 20 pts in hand

    const result = scoreRound(1, finishOrder, emptyTricks(), hands, noCall());

    // West is EW, so hand points go to NS
    expect(result.cardPoints.northSouth).toBe(20);
    expect(result.cardPoints.eastWest).toBe(0);
  });

  it('handles Dragon in last player hand going to opponents', () => {
    const finishOrder: Seat[] = ['east', 'north', 'south', 'west'];
    const hands = emptyHands();
    hands.west = [findCard('dragon')]; // 25 pts

    const result = scoreRound(1, finishOrder, emptyTricks(), hands, noCall());

    // West (EW) last, Dragon hand points (25) go to NS
    expect(result.cardPoints.northSouth).toBe(25);
  });

  it('handles Phoenix in last player hand (negative points to opponents)', () => {
    const finishOrder: Seat[] = ['north', 'east', 'south', 'west'];
    const hands = emptyHands();
    hands.west = [findCard('phoenix')]; // -25 pts

    const result = scoreRound(1, finishOrder, emptyTricks(), hands, noCall());

    // NS gets -25 as hand points from west
    expect(result.cardPoints.northSouth).toBe(-25);
  });

  // Verifies: REQ-F-GF08 — Tichu +100/-100
  it('awards +100 for successful Tichu', () => {
    const finishOrder: Seat[] = ['north', 'east', 'south', 'west'];
    const calls: Record<Seat, TichuCall> = { ...noCall(), north: 'tichu' };

    const result = scoreRound(1, finishOrder, emptyTricks(), emptyHands(), calls);

    expect(result.tichuBonuses.northSouth).toBe(100);
    expect(result.tichuBonuses.eastWest).toBe(0);
  });

  it('penalizes -100 for failed Tichu', () => {
    const finishOrder: Seat[] = ['east', 'north', 'south', 'west'];
    const calls: Record<Seat, TichuCall> = { ...noCall(), north: 'tichu' };

    const result = scoreRound(1, finishOrder, emptyTricks(), emptyHands(), calls);

    // North called Tichu but didn't finish first
    expect(result.tichuBonuses.northSouth).toBe(-100);
  });

  // Verifies: REQ-F-GF09 — Grand Tichu +200/-200
  it('awards +200 for successful Grand Tichu', () => {
    const finishOrder: Seat[] = ['north', 'east', 'south', 'west'];
    const calls: Record<Seat, TichuCall> = { ...noCall(), north: 'grandTichu' };

    const result = scoreRound(1, finishOrder, emptyTricks(), emptyHands(), calls);

    expect(result.tichuBonuses.northSouth).toBe(200);
  });

  it('penalizes -200 for failed Grand Tichu', () => {
    const finishOrder: Seat[] = ['east', 'north', 'south', 'west'];
    const calls: Record<Seat, TichuCall> = { ...noCall(), north: 'grandTichu' };

    const result = scoreRound(1, finishOrder, emptyTricks(), emptyHands(), calls);

    expect(result.tichuBonuses.northSouth).toBe(-200);
  });

  it('handles multiple Tichu calls in the same round', () => {
    const finishOrder: Seat[] = ['north', 'east', 'south', 'west'];
    const calls: Record<Seat, TichuCall> = {
      north: 'tichu',    // success: +100 NS
      east: 'tichu',     // fail: -100 EW
      south: 'none',
      west: 'grandTichu', // fail: -200 EW
    };

    const result = scoreRound(1, finishOrder, emptyTricks(), emptyHands(), calls);

    expect(result.tichuBonuses.northSouth).toBe(100);
    expect(result.tichuBonuses.eastWest).toBe(-300); // -100 + -200
  });

  it('combines card points and Tichu bonuses in total', () => {
    const finishOrder: Seat[] = ['north', 'south', 'east', 'west'];
    const calls: Record<Seat, TichuCall> = { ...noCall(), north: 'tichu' };

    const result = scoreRound(1, finishOrder, emptyTricks(), emptyHands(), calls);

    // 1-2 finish: NS gets 200 card points + 100 Tichu bonus = 300
    expect(result.total.northSouth).toBe(300);
    expect(result.total.eastWest).toBe(0);
  });

  it('stores the round number', () => {
    const finishOrder: Seat[] = ['north', 'east', 'south', 'west'];
    const result = scoreRound(5, finishOrder, emptyTricks(), emptyHands(), noCall());
    expect(result.roundNumber).toBe(5);
  });
});

// --- checkGameOver ---

describe('checkGameOver', () => {
  // Verifies: REQ-F-GF10
  it('returns null when neither team reaches the target', () => {
    expect(checkGameOver({ northSouth: 500, eastWest: 400 }, 1000)).toBeNull();
  });

  it('returns northSouth when they reach exactly the target', () => {
    expect(checkGameOver({ northSouth: 1000, eastWest: 400 }, 1000)).toBe('northSouth');
  });

  it('returns eastWest when they exceed the target', () => {
    expect(checkGameOver({ northSouth: 400, eastWest: 1100 }, 1000)).toBe('eastWest');
  });

  it('returns the higher-scoring team when both reach the target', () => {
    expect(checkGameOver({ northSouth: 1200, eastWest: 1100 }, 1000)).toBe('northSouth');
    expect(checkGameOver({ northSouth: 1100, eastWest: 1200 }, 1000)).toBe('eastWest');
  });

  it('returns null when both teams are tied at or above the target', () => {
    expect(checkGameOver({ northSouth: 1000, eastWest: 1000 }, 1000)).toBeNull();
  });

  it('works with custom target scores', () => {
    expect(checkGameOver({ northSouth: 500, eastWest: 300 }, 500)).toBe('northSouth');
  });
});
