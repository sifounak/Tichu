// REQ-F-C01: 56-card deck with unique IDs
// REQ-F-C02: Fisher-Yates shuffle
// REQ-F-C03: Deal 8+6 cards per player

import type { Card, GameCard } from '../types/card.js';
import { ALL_RANKS, ALL_SUITS } from '../types/card.js';
import type { Seat } from '../types/game.js';
import { SEATS_IN_ORDER } from '../types/game.js';
import { DECK_SIZE, FIRST_DEAL_SIZE, SECOND_DEAL_SIZE } from '../constants.js';

/**
 * REQ-F-C01: Creates a full 56-card Tichu deck with unique IDs (0–55).
 * Cards 0–51: standard cards (4 suits × 13 ranks)
 * Cards 52–55: Mahjong, Dog, Phoenix, Dragon
 */
export function createDeck(): GameCard[] {
  const cards: GameCard[] = [];
  let id = 0;

  // Standard cards: 4 suits × 13 ranks = 52 cards
  for (const suit of ALL_SUITS) {
    for (const rank of ALL_RANKS) {
      cards.push({
        id,
        card: { kind: 'standard', suit, rank } as Card,
      });
      id++;
    }
  }

  // Special cards
  const specials: Card[] = [
    { kind: 'mahjong' },
    { kind: 'dog' },
    { kind: 'phoenix' },
    { kind: 'dragon' },
  ];

  for (const card of specials) {
    cards.push({ id, card });
    id++;
  }

  return cards;
}

/**
 * REQ-F-C02: Fisher-Yates shuffle for fair randomization.
 * Returns a new array with the same cards in shuffled order.
 * Uses the modern (Durstenfeld) version of Fisher-Yates.
 */
export function shuffleDeck(deck: readonly GameCard[]): GameCard[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Result of dealing cards to one player */
export interface DealResult {
  first8: GameCard[];
  remaining6: GameCard[];
}

/**
 * REQ-F-C03: Deal cards to all 4 players.
 * First 8 cards each (for Grand Tichu decision), then remaining 6 each.
 * Expects a shuffled 56-card deck.
 */
export function dealCards(deck: readonly GameCard[]): Record<Seat, DealResult> {
  if (deck.length !== DECK_SIZE) {
    throw new Error(`Expected ${DECK_SIZE} cards, got ${deck.length}`);
  }

  const result = {} as Record<Seat, DealResult>;

  // Deal first 8 to each player (cards 0–31)
  for (let seatIdx = 0; seatIdx < 4; seatIdx++) {
    const seat = SEATS_IN_ORDER[seatIdx];
    const startFirst = seatIdx * FIRST_DEAL_SIZE;
    const startRemaining = 4 * FIRST_DEAL_SIZE + seatIdx * SECOND_DEAL_SIZE;

    result[seat] = {
      first8: deck.slice(startFirst, startFirst + FIRST_DEAL_SIZE),
      remaining6: deck.slice(startRemaining, startRemaining + SECOND_DEAL_SIZE),
    };
  }

  return result;
}
