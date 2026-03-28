// REQ-F-GF01: Game lifecycle state machine types

import type { GameCard, Rank } from './card.js';
import type { Combination } from './combination.js';

/** Fixed seat positions at the table */
export type Seat = 'north' | 'east' | 'south' | 'west';

/** The two partnership teams */
export type Team = 'northSouth' | 'eastWest';

/** All seats in clockwise turn order */
export const SEATS_IN_ORDER: readonly Seat[] = ['north', 'east', 'south', 'west'] as const;

/** Maps a seat to its team */
export function getTeam(seat: Seat): Team {
  return seat === 'north' || seat === 'south' ? 'northSouth' : 'eastWest';
}

/** Maps a seat to its partner */
export function getPartner(seat: Seat): Seat {
  const partners: Record<Seat, Seat> = {
    north: 'south',
    south: 'north',
    east: 'west',
    west: 'east',
  };
  return partners[seat];
}

/** Returns the next seat in clockwise order */
export function getNextSeat(seat: Seat): Seat {
  const idx = SEATS_IN_ORDER.indexOf(seat);
  return SEATS_IN_ORDER[(idx + 1) % 4];
}

/** All phases of the game state machine */
export enum GamePhase {
  /** Waiting for players to join */
  WaitingForPlayers = 'waitingForPlayers',
  /** First 8 cards dealt; players decide on Grand Tichu */
  GrandTichuDecision = 'grandTichuDecision',
  /** Players pass 1 card to each other player */
  CardPassing = 'cardPassing',
  /** Active gameplay — tricks are played */
  Playing = 'playing',
  /** Round ended, scoring in progress */
  RoundScoring = 'roundScoring',
  /** Game over — a team reached the target score */
  GameOver = 'gameOver',
}

/** Tichu call level */
export type TichuCall = 'none' | 'tichu' | 'grandTichu';

/** State for an individual player within a round */
export interface PlayerState {
  seat: Seat;
  hand: GameCard[];
  tricksWon: GameCard[][];
  tipiCall: TichuCall;
  hasPlayed: boolean;
  finishOrder: number | null;
  passedCards: {
    to: Record<Seat, GameCard | null>;
    received: boolean;
  };
}

/** State for the current trick */
export interface TrickState {
  plays: Array<{
    seat: Seat;
    combination: Combination;
  }>;
  passes: Seat[];
  leadSeat: Seat;
  currentWinner: Seat;
}

/** REQ-F-GS11: Per-seat tichu result for one round */
export interface TichuResult {
  call: TichuCall;
  won: boolean;
}

/** Score record for one round */
export interface RoundScore {
  roundNumber: number;
  cardPoints: Record<Team, number>;
  tichuBonuses: Record<Team, number>;
  oneTwoBonus: Team | null;
  total: Record<Team, number>;
  /** REQ-F-GS11: Tichu/Grand Tichu result per seat; null if no call was made */
  tichuResults: Record<Seat, TichuResult | null>;
  /** REQ-F-GS12: Bombs played per team this round */
  bombsPerTeam: Record<Team, number>;
}

/** Full state for one round of play */
export interface RoundState {
  roundNumber: number;
  phase: GamePhase;
  players: Record<Seat, PlayerState>;
  currentTrick: TrickState | null;
  currentTurn: Seat | null;
  mahjongWish: Rank | null;
  wishFulfilled: boolean;
  finishOrder: Seat[];
  dragonGiftPending: {
    trickCards: GameCard[];
    from: Seat;
  } | null;
  /** REQ-F-DRA03: Ephemeral signal — set when dragon gift resolves, cleared on next play/pass */
  dragonGiftedTo: Seat | null;
  /** REQ-F-DA01: Ephemeral marker for Dog play animation (set on Dog play, cleared on next play) */
  lastDogPlay: { fromSeat: Seat; toSeat: Seat } | null;
  /** REQ-F-GS13: Bombs played per team this round, initialized to zero each round */
  bombsPerTeam: Record<Team, number>;
}

/** REQ-F-GF10: Customizable game configuration */
export interface GameConfig {
  targetScore: number;
  turnTimerSeconds: number | null;
  // REQ-F-TIER01: Three bot difficulty tiers
  botDifficulty: 'regular' | 'hard' | 'expert';
  spectatorsAllowed: boolean;
  isPrivate: boolean;
}

/** Default game configuration */
export const DEFAULT_GAME_CONFIG: GameConfig = {
  targetScore: 1000,
  turnTimerSeconds: null,
  botDifficulty: 'expert',
  spectatorsAllowed: true,
  isPrivate: false,
};

/** Full game state across rounds */
export interface GameState {
  gameId: string;
  config: GameConfig;
  phase: GamePhase;
  scores: Record<Team, number>;
  roundHistory: RoundScore[];
  currentRound: RoundState | null;
}

/**
 * REQ-NF-A02: Projected state for a specific player.
 * Hides other players' hands; shows only public information.
 */
export interface ClientGameView {
  gameId: string;
  config: GameConfig;
  phase: GamePhase;
  scores: Record<Team, number>;
  roundHistory: RoundScore[];
  mySeat: Seat;
  myHand: GameCard[];
  myTichuCall: TichuCall;
  /** Whether the player has played any cards this round (for Tichu call eligibility) */
  myHasPlayed: boolean;
  otherPlayers: Array<{
    seat: Seat;
    cardCount: number;
    tichuCall: TichuCall;
    hasPlayed: boolean;
    finishOrder: number | null;
  }>;
  currentTrick: TrickState | null;
  currentTurn: Seat | null;
  mahjongWish: Rank | null;
  wishFulfilled: boolean;
  finishOrder: Seat[];
  dragonGiftPending: boolean;
  /** REQ-F-DRA03: Ephemeral — set when dragon gift resolves, cleared on next play/pass */
  dragonGiftedTo: Seat | null;
  /** Cards received during card passing, keyed by the seat that sent them */
  receivedCards: Record<Seat, GameCard | null>;
  /** REQ-F-DA01: Last Dog play info for animation (null when no recent Dog play) */
  lastDogPlay: { fromSeat: Seat; toSeat: Seat } | null;
  /** Seats that have made their Grand Tichu decision (call or pass) */
  grandTichuDecided: Seat[];
  /** Seats that have confirmed their card pass */
  cardPassConfirmed: Seat[];
  /** Seats vacated by players who left mid-game (game paused until filled) */
  vacatedSeats: Seat[];
  /** True when the player just joined with 2+ vacated seats and must pick one */
  choosingSeat: boolean;
  /** REQ-F-ES04: Per-seat disconnect vote status (null = not voted, only present during active vote) */
  disconnectVotes: Record<string, 'wait' | 'kick' | null>;
  /** REQ-F-ES02: True when game is halted due to empty seats or active disconnect vote */
  gameHalted: boolean;
  /** Winning team when phase is GameOver, null otherwise */
  winner: Team | null;
  /** REQ-F-PV23: Active player-initiated vote (kick or restart), null when no vote */
  activeVote?: {
    voteId: string;
    voteType: 'kick' | 'restart';
    initiatorSeat: Seat;
    targetSeat?: Seat;
    votes: Record<string, boolean | null>;
    timeoutMs: number;
  } | null;
  /** REQ-F-TT05: Epoch timestamp (ms) when the current turn timer started, null when disabled/stopped */
  turnTimerStartedAt?: number | null;
  /** REQ-F-TT05: Total turn timer duration in milliseconds, null when disabled/stopped */
  turnTimerDurationMs?: number | null;
}
