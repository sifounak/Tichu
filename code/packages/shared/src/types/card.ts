// REQ-F-C01: 56-card deck — 4 suits × 13 ranks + Dragon, Phoenix, Mahjong, Dog

/** The four standard suits in Tichu */
export enum Suit {
  Jade = 'jade',
  Pagoda = 'pagoda',
  Star = 'star',
  Sword = 'sword',
}

/** The four special (non-suited) card types */
export enum SpecialCardType {
  Dragon = 'dragon',
  Phoenix = 'phoenix',
  Mahjong = 'mahjong',
  Dog = 'dog',
}

/** Standard card ranks 2–14 (Ace = 14) */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

/** A standard suited card (2–Ace in one of 4 suits) */
export interface StandardCard {
  kind: 'standard';
  suit: Suit;
  rank: Rank;
}

/** Dragon: highest single (rank 25), trick must be given to an opponent */
export interface DragonCard {
  kind: 'dragon';
}

/** Phoenix: wild card, +0.5 as single, substitutes in combinations */
export interface PhoenixCard {
  kind: 'phoenix';
}

/** Mahjong: rank 1, holder leads first trick, may declare a wish */
export interface MahjongCard {
  kind: 'mahjong';
}

/** Dog: passes lead to partner, can only be played as a lead */
export interface DogCard {
  kind: 'dog';
}

/** Discriminated union of all card types */
export type Card = StandardCard | DragonCard | PhoenixCard | MahjongCard | DogCard;

/** Card ID: unique index 0–55 for each card in the deck */
export type CardId = number;

/** A card with its unique game ID */
export interface GameCard {
  id: CardId;
  card: Card;
}

// --- Type guards ---

/** Returns true if the card is a special (non-suited) card */
export function isSpecial(card: Card): card is DragonCard | PhoenixCard | MahjongCard | DogCard {
  return card.kind !== 'standard';
}

/** Returns true if the card is a standard suited card */
export function isStandard(card: Card): card is StandardCard {
  return card.kind === 'standard';
}

/** Returns true if the card is a Dragon */
export function isDragon(card: Card): card is DragonCard {
  return card.kind === 'dragon';
}

/** Returns true if the card is a Phoenix */
export function isPhoenix(card: Card): card is PhoenixCard {
  return card.kind === 'phoenix';
}

/** Returns true if the card is a Mahjong */
export function isMahjong(card: Card): card is MahjongCard {
  return card.kind === 'mahjong';
}

/** Returns true if the card is a Dog */
export function isDog(card: Card): card is DogCard {
  return card.kind === 'dog';
}

/**
 * Returns the effective rank of a card for comparison purposes.
 * Standard cards: 2–14, Mahjong: 1, Dragon: 25, Phoenix/Dog: 0 (context-dependent)
 */
export function getCardRank(card: Card): number {
  switch (card.kind) {
    case 'standard':
      return card.rank;
    case 'mahjong':
      return 1;
    case 'dragon':
      return 25;
    case 'phoenix':
      return 0; // context-dependent; caller must handle
    case 'dog':
      return 0; // not comparable
  }
}

/** Returns the suit of a standard card, or undefined for special cards */
export function getCardSuit(card: Card): Suit | undefined {
  return card.kind === 'standard' ? card.suit : undefined;
}

/** All valid standard ranks */
export const ALL_RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;

/** All suits */
export const ALL_SUITS: readonly Suit[] = [Suit.Jade, Suit.Pagoda, Suit.Star, Suit.Sword] as const;
