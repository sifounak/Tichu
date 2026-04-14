import type {
  Seat,
  Team,
  GameConfig,
  RoomConfig,
  GameCard,
  RoundScore,
  RoundState,
  CombinationType,
} from '@tichu/shared';
import type { RoundEventSummary } from './round-event-types.js';

// ─── Conversion Helpers ────────────────────────────────────────────────────

export function serializeSet<T>(set: Set<T>): T[] {
  return [...set];
}

export function deserializeSet<T>(arr: T[]): Set<T> {
  return new Set(arr);
}

export function serializeMap<K, V>(map: Map<K, V>): Record<string, V> {
  return Object.fromEntries(map);
}

export function deserializeMap<K extends string, V>(
  obj: Record<string, V>,
): Map<K, V> {
  return new Map(Object.entries(obj)) as Map<K, V>;
}

/** Deserialize a Map that originally had numeric keys (JSON stringifies them). */
export function deserializeNumericKeyMap<V>(
  obj: Record<string, V>,
): Map<number, V> {
  return new Map(Object.entries(obj).map(([k, v]) => [Number(k), v]));
}

// ─── Snapshot Types ────────────────────────────────────────────────────────

export interface SerializedContext {
  gameId: string;
  config: GameConfig;
  seats: Record<Seat, boolean>;
  scores: Record<Team, number>;
  roundHistory: RoundScore[];
  currentRound: RoundState | null;
  grandTichuDecisions: Seat[];
  cardPassDecisions: Seat[];
  winner: Team | null;
}

export interface TimerSnapshot {
  currentSeat: Seat;
  startTime: number;
  durationMs: number;
}

export interface CardTrackerSnapshot {
  dragonPlayed: boolean;
  dragonPlayedBy: Seat | null;
  phoenixPlayed: boolean;
  phoenixPlayedBy: Seat | null;
  playedByRank: Record<string, { count: number; bySeat: Seat[] }>;
  processedCardIds: number[];
  ownHandRankCounts: Record<string, number>;
  ownHandHasDragon: boolean;
  ownHandHasPhoenix: boolean;
}

export interface BotSnapshot {
  seat: Seat;
  cardTracker: CardTrackerSnapshot;
  handPlan: unknown | null;
  planCreated: boolean;
  currentRound: number;
  scoreDiff: number | null;
  passedToRight: GameCard | null;
  mahjongPlayedInStraight: boolean;
  gameScores: Record<Team, number> | null;
  targetScore: number;
  partnerPassedCard: GameCard | null;
  partnerStrengthDetected: boolean;
  partnerStrengthChecked: boolean;
  uncontestedSingleCounts: Record<Seat, number>;
  uncontestedSingleLastRank: Record<Seat, number>;
  lastTricksWonCounts: Record<Seat, number>;
  lastSeenTrickType: CombinationType | null;
  ptsConsecutiveLeads: number;
  lastLeadSeat: Seat | null;
  lastRoundState: RoundState | null;
}

export interface EventTrackerSnapshot {
  summaries: Record<string, RoundEventSummary>;
  currentRoundNumber: number;
  processedBombCount: Record<string, number>;
  dogStuckDetected: Seat[];
}

export interface GameSnapshot {
  gameId: string;
  roomCode: string;
  machineSnapshot: unknown;
  vacatedSeats: Seat[];
  choosingSeats: Seat[];
  joinedAfterSpectating: string[];
  roundEventHistory: Record<string, RoundEventSummary[]>;
  currentRoundEvents: EventTrackerSnapshot;
  endOfTrickBombWindowEndTime: number | null;
  timerState: TimerSnapshot | null;
  botSeats: Seat[];
  botStates: Record<string, BotSnapshot>;
  config: GameConfig;
}

export interface RoomSnapshot {
  roomCode: string;
  roomName: string;
  hostSeat: Seat;
  players: Array<{ seat: Seat; name: string; isBot: boolean }>;
  config: RoomConfig;
  gameInProgress: true;
  seatToUserId: Record<string, string>;
}
