// REQ-F-SC03–SC11, REQ-F-CP01–CP02: TypeScript interfaces for raw event data layers
// These replace the flat RoundEventSummary with structured per-layer records.

import type { Seat } from '@tichu/shared';

// ─── Action Source ──────────────────────────────────────────────────────

/** REQ-F-CP02: Distinguishes how a play action was initiated */
export type ActionSource = 'player' | 'automation' | 'timeout' | 'bot';

/** REQ-F-SC05: Play action types */
export type PlayActionType = 'play' | 'pass' | 'bomb';

/** REQ-F-SC09: Bomb types */
export type BombType = 'fourOfAKind' | 'straightFlush';

/** REQ-F-SC09: Bomb fate */
export type BombFate = 'played' | 'brokenUp' | 'heldToEnd';

/** REQ-F-SC03: Tichu call phase */
export type TichuCallPhase = 'prePassing' | 'midRound';

/** REQ-F-SC10: Bomb event types */
export type BombEventType = 'playBomb' | 'wishSideEffect';

// ─── Pre-Play Context (computed by GameManager before actor.send) ───────
// REQ-F-CP02: Pre-play enrichment fields

export interface PrePlayContext {
  seat: Seat;
  /** Number of legal combinations available at time of play */
  legalPlayCount: number;
  /** True when chosen play is lowest-ranking legal option of same combination type */
  playedMinimum: boolean;
  /** Had a legal play that would empty hand, but chose something else */
  couldHaveGoneOut: boolean;
  /** How the action was initiated */
  actionSource: ActionSource;
  /** Cards remaining for partner */
  partnerCardsRemaining: number;
  /** Cards remaining for left opponent */
  leftOppCardsRemaining: number;
  /** Cards remaining for right opponent */
  rightOppCardsRemaining: number;
  /** When this player's turn began (ISO timestamp, null for OOT bombs) */
  turnStartedAt: string | null;
  /** Milliseconds from turn start to action */
  durationMs: number | null;
}

// ─── Layer 3: Player Round Record ───────────────────────────────────────
// REQ-F-SC03: One per player per round — hands, passes, calls, finish, points

export interface PlayerRoundRecord {
  gameId: number;
  roundNumber: number;
  seat: Seat;
  userId: string | null;

  // Hands
  first8Cards: number[] | null;
  fullHandPrePass: number[] | null;
  passedToLeft: number | null;
  passedToPartner: number | null;
  passedToRight: number | null;
  receivedFromLeft: number | null;
  receivedFromPartner: number | null;
  receivedFromRight: number | null;
  handAfterPass: number[] | null;

  // Calls
  grandTichuCall: boolean;
  tichuCall: boolean;
  tichuCallPhase: TichuCallPhase | null;
  tichuCallTrickNumber: number | null;
  tichuCallHandSizes: { partner: number; leftOpp: number; rightOpp: number } | null;
  tichuCallSuccess: boolean | null;

  // Finish
  finishPosition: number | null; // 1-4
  finishTrickNumber: number | null;

  // Points
  cardPointsCaptured: number;
  handPointsGivenToOpponents: number;
  capturedPointsGivenToFirstOut: number;

  // Running total
  trickPointRunningTotal: number[];
}

// ─── Layer 4+6: Trick Record (merged trick + result) ────────────────────
// REQ-F-SC04: One per trick per round

export interface TrickRecord {
  gameId: number;
  roundNumber: number;
  trickNumber: number;

  // Lead info
  leadSeat: Seat;
  leadCombinationType: string | null;
  leadCombinationRank: number | null;
  leadCombinationLength: number | null;

  // Result info (populated when trick completes)
  winnerSeat: Seat | null;
  pointValue: number;
  trickLength: number; // plays, not passes
  uncontested: boolean;

  // Winning combination
  winningCombinationType: string | null;
  winningCombinationRank: number | null;
  winningCombinationLength: number | null;

  // Content flags
  containsDragon: boolean;
  containsPhoenix: boolean;

  // Context
  activeTichuSeats: Seat[];
}

// ─── Layer 5: Play Record ───────────────────────────────────────────────
// REQ-F-SC05: One per action within a trick

export interface PlayRecord {
  gameId: number;
  roundNumber: number;
  trickNumber: number;
  sequenceNumber: number;
  seat: Seat;

  // Action
  actionType: PlayActionType;
  actionAt: string | null; // ISO timestamp
  actionSource: ActionSource | null;

  // Card details (play/bomb only)
  cards: number[] | null;
  combinationType: string | null;
  combinationRank: number | null;
  combinationLength: number | null;
  phoenixUsedAs: number | null;
  phoenixEffectiveValue: number | null;
  isBomb: boolean | null;
  legalPlayCount: number | null;

  // Contextual flags
  outOfTurn: boolean | null;
  interruptedSeat: Seat | null;
  endOfTrickBomb: boolean | null;
  playedOnTopOf: Seat | null;
  playerFinished: boolean | null;
  cardsRemainingAfter: number | null;
  couldHaveGoneOut: boolean | null;
  playedMinimum: boolean | null;

  // Hand sizes of other players
  partnerCardsRemaining: number | null;
  leftOppCardsRemaining: number | null;
  rightOppCardsRemaining: number | null;

  // Pass-specific (actionType='pass')
  couldHavePlayed: boolean | null;
  hadBombAvailable: boolean | null;

  // Wish context
  wishActive: boolean | null;
  wishRank: number | null;
  playForcedByWish: boolean | null;

  // Tichu context
  partnerTichuActive: boolean | null;
  opponentTichuActive: { left: string | null; right: string | null } | null;

  // Timing
  turnStartedAt: string | null;
  durationMs: number | null;
}

// ─── Layer 7: Special Event Records ─────────────────────────────────────

// REQ-F-SC06: Wish event
export interface WishEventRecord {
  gameId: number;
  roundNumber: number;
  wishRank: number;
  trickNumber: number;
  cardsOfRankRemaining: number;
  cardsOfRankInWisherHand: number;
  wishFulfilledTrick: number | null;
  wishFulfilledBy: Seat | null;
}

// REQ-F-SC07: Dragon gift event
export interface DragonGiftEventRecord {
  gameId: number;
  roundNumber: number;
  trickNumber: number;
  gifterSeat: Seat;
  recipientSeat: Seat;
  trickPointValue: number;
  recipientCardsLeft: number;
  otherOpponentCardsLeft: number;
  gifterFinishedOnPlay: boolean;
  recipientHasTichu: boolean;
  otherOpponentHasTichu: boolean;
  giftWasForced: boolean;
}

// REQ-F-SC08: Dog play event
export interface DogPlayEventRecord {
  gameId: number;
  roundNumber: number;
  trickNumber: number;
  playerSeat: Seat;
  controlPassedTo: Seat;
  partnerAlreadyOut: boolean;
  partnerHasTichu: boolean;
  hadPriorLeadOpportunity: boolean;
  dogWasLastCard: boolean;
}

// REQ-F-SC09: Bomb inventory record (Level 1)
export interface BombInventoryRecord {
  gameId: number;
  roundNumber: number;
  playerSeat: Seat;

  // Bomb identity
  bombType: BombType;
  cards: number[];
  rank: number;
  size: number;

  // Evolution
  acquiredPhase: 'first8' | 'fullDeal' | 'postPass';

  // SFB tracking
  bombPlaysFromRun: number;

  // Overlap
  overlapsWith: number[]; // indices into same round's bomb inventory

  // Fate (set when resolved)
  fate: BombFate | null;
  fateTrickNumber: number | null;
  fateTarget: Seat | null;
  outOfTurn: boolean | null;
  endOfTrickBomb: boolean | null;

  // Context
  playsSeenWhileHeld: number;

  // Aggregate flags (set at round end)
  capturedDragon: boolean;
  wasOverbomb: boolean;
  followedByDog: boolean;
}

// REQ-F-SC10: Bomb event record (Level 2)
export interface BombEventRecord {
  gameId: number;
  roundNumber: number;
  bombInventoryIndex: number; // index into round's bomb inventory array
  eventType: BombEventType;

  // playBomb fields
  trickNumber: number | null;
  followedByDog: boolean | null;

  // wishSideEffect fields
  cardLost: number | null;
  couldHavePlayedBomb: boolean | null;
  runLengthChange: number | null;
}

// ─── Game Event Accumulator ─────────────────────────────────────────────
// REQ-F-ST01: In-memory accumulation of all event data during gameplay

/** Accumulated data for a single round */
export interface RoundEventData {
  roundNumber: number;
  /** REQ-F-SC02: Score at round start (before scoring) */
  scoreNSAtStart: number;
  scoreEWAtStart: number;
  startedAt: string; // ISO timestamp

  /** REQ-F-SC03: One per player per round */
  playerRounds: PlayerRoundRecord[];
  /** REQ-F-SC04: One per trick */
  tricks: TrickRecord[];
  /** REQ-F-SC05: One per action */
  plays: PlayRecord[];
  /** REQ-F-SC06: 0-1 per round */
  wishEvent: WishEventRecord | null;
  /** REQ-F-SC07: 0+ per round */
  dragonGiftEvents: DragonGiftEventRecord[];
  /** REQ-F-SC08: 0+ per round */
  dogPlayEvents: DogPlayEventRecord[];
  /** REQ-F-SC09: 0+ per player per round */
  bombInventory: BombInventoryRecord[];
  /** REQ-F-SC10: 0+ per round */
  bombEvents: BombEventRecord[];
}

/** Full game accumulator — holds all event data across all rounds */
export interface GameEventAccumulator {
  gameId: number;
  rounds: RoundEventData[];
}

/** Create an empty round data container */
export function createEmptyRoundData(
  roundNumber: number,
  scoreNSAtStart: number,
  scoreEWAtStart: number,
): RoundEventData {
  return {
    roundNumber,
    scoreNSAtStart,
    scoreEWAtStart,
    startedAt: new Date().toISOString(),
    playerRounds: [],
    tricks: [],
    plays: [],
    wishEvent: null,
    dragonGiftEvents: [],
    dogPlayEvents: [],
    bombInventory: [],
    bombEvents: [],
  };
}

/** Create an empty game accumulator */
export function createGameAccumulator(gameId: number): GameEventAccumulator {
  return {
    gameId,
    rounds: [],
  };
}

/** Create a blank player round record */
export function createBlankPlayerRound(
  gameId: number,
  roundNumber: number,
  seat: Seat,
  userId: string | null,
): PlayerRoundRecord {
  return {
    gameId,
    roundNumber,
    seat,
    userId,
    first8Cards: null,
    fullHandPrePass: null,
    passedToLeft: null,
    passedToPartner: null,
    passedToRight: null,
    receivedFromLeft: null,
    receivedFromPartner: null,
    receivedFromRight: null,
    handAfterPass: null,
    grandTichuCall: false,
    tichuCall: false,
    tichuCallPhase: null,
    tichuCallTrickNumber: null,
    tichuCallHandSizes: null,
    tichuCallSuccess: null,
    finishPosition: null,
    finishTrickNumber: null,
    cardPointsCaptured: 0,
    handPointsGivenToOpponents: 0,
    capturedPointsGivenToFirstOut: 0,
    trickPointRunningTotal: [],
  };
}
