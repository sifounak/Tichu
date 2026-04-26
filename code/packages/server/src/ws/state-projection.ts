// REQ-NF-A02: Server authoritative, projected state
// Transforms full game state into per-player views that hide opponents' hands

import type {
  Seat,
  TrickState,
  TichuCall,
  ClientGameView,
  GamePhase,
  GameCard,
} from '@tichu/shared';
import { SEATS_IN_ORDER } from '@tichu/shared';
import type { GameMachineContext } from '../game/game-state-machine.js';

/**
 * REQ-NF-A02: Project full server game state into a client view for a specific seat.
 *
 * Hides other players' hands (shows only card count).
 * Includes the requesting player's full hand, trick state, scores, and indicators.
 */
export function projectGameState(
  context: GameMachineContext,
  machineState: string,
  forSeat: Seat,
  vacatedSeats: readonly Seat[] = [],
  choosingSeats: readonly Seat[] = [],
  disconnectVoteStatus?: { votes: Record<string, 'wait' | 'kick' | null>; disconnectedSeats: Seat[]; timeoutMs: number } | null,
  activeVote?: { voteId: string; voteType: 'kick' | 'restart'; initiatorSeat: Seat; targetSeat?: Seat; votes: Record<string, boolean | null>; timeoutMs: number } | null,
  timerInfo?: { startTime: number | null; durationMs: number | null },
  endOfTrickBombWindowEndTime?: number | null,
): ClientGameView {
  const round = context.currentRound;

  // Map XState machine state names to GamePhase enum values
  const phase = mapMachineStateToPhase(machineState);

  // Base view with no round-specific data
  if (!round) {
    return {
      gameId: context.gameId,
      config: context.config,
      phase,
      scores: { ...context.scores },
      roundHistory: [...context.roundHistory],
      mySeat: forSeat,
      myHand: [],
      myTichuCall: 'none',
      myHasPlayed: false,
      otherPlayers: SEATS_IN_ORDER
        .filter(s => s !== forSeat)
        .map(seat => ({
          seat,
          cardCount: 0,
          tichuCall: 'none' as TichuCall,
          hasPlayed: false,
          finishOrder: null,
        })),
      currentTrick: null,
      currentTurn: null,
      mahjongWish: null,
      wishFulfilled: false,
      finishOrder: [],
      dragonGiftPending: false,
      dragonGiftedTo: null,
      receivedCards: { north: null, east: null, south: null, west: null },
      lastDogPlay: null,
      grandTichuDecided: [],
      cardPassConfirmed: [],
      vacatedSeats: [...vacatedSeats],
      choosingSeat: choosingSeats.includes(forSeat),
      // REQ-F-ES04: Per-seat disconnect vote status
      disconnectVotes: disconnectVoteStatus?.votes ?? {},
      // REQ-F-ES02: Game halted when seats are vacant or a disconnect vote is active
      gameHalted: vacatedSeats.length > 0 || !!disconnectVoteStatus,
      winner: context.winner,
      // REQ-F-PV23: Active player-initiated vote
      activeVote: activeVote ?? null,
      // REQ-F-TT05: Turn timer data
      turnTimerStartedAt: timerInfo?.startTime ?? null,
      turnTimerDurationMs: timerInfo?.durationMs ?? null,
      endOfTrickBombWindowEndTime: endOfTrickBombWindowEndTime ?? null,
      serverTime: Date.now(),
    };
  }

  const myPlayer = round.players[forSeat];
  const isChoosing = choosingSeats.includes(forSeat);

  return {
    gameId: context.gameId,
    config: context.config,
    phase,
    scores: { ...context.scores },
    roundHistory: [...context.roundHistory],
    mySeat: forSeat,
    myHand: isChoosing ? [] : [...myPlayer.hand],
    myTichuCall: myPlayer.tipiCall,
    myHasPlayed: myPlayer.hasPlayed,
    otherPlayers: SEATS_IN_ORDER
      .filter(s => s !== forSeat)
      .map(seat => {
        const player = round.players[seat];
        return {
          seat,
          cardCount: player.hand.length,
          tichuCall: player.tipiCall,
          hasPlayed: player.hasPlayed,
          finishOrder: player.finishOrder,
        };
      }),
    currentTrick: round.currentTrick ? sanitizeTrickState(round.currentTrick) : null,
    currentTurn: round.currentTurn,
    mahjongWish: round.mahjongWish,
    wishFulfilled: round.wishFulfilled,
    finishOrder: [...round.finishOrder],
    dragonGiftPending: round.dragonGiftPending !== null,
    dragonGiftedTo: round.dragonGiftedTo ?? null,
    lastDogPlay: round.lastDogPlay,
    grandTichuDecided: [...context.grandTichuDecisions],
    cardPassConfirmed: [...context.cardPassDecisions],
    vacatedSeats: [...vacatedSeats],
    choosingSeat: isChoosing,
    // REQ-F-ES04: Per-seat disconnect vote status
    disconnectVotes: disconnectVoteStatus?.votes ?? {},
    // REQ-F-ES02: Game halted when seats are vacant or a disconnect vote is active
    gameHalted: vacatedSeats.length > 0 || !!disconnectVoteStatus,
    winner: context.winner,
    // REQ-F-PV23: Active player-initiated vote
    activeVote: activeVote ?? null,
    // REQ-F-TT05: Turn timer data
    turnTimerStartedAt: timerInfo?.startTime ?? null,
    turnTimerDurationMs: timerInfo?.durationMs ?? null,
    receivedCards: myPlayer.passedCards.received
      ? SEATS_IN_ORDER.reduce((acc, fromSeat) => {
          acc[fromSeat] = fromSeat === forSeat
            ? null
            : (round.players[fromSeat].passedCards.to[forSeat] ?? null);
          return acc;
        }, {} as Record<Seat, GameCard | null>)
      : { north: null, east: null, south: null, west: null } as Record<Seat, GameCard | null>,
    endOfTrickBombWindowEndTime: endOfTrickBombWindowEndTime ?? null,
    serverTime: Date.now(),
  };
}

/** Map XState machine state names to GamePhase enum values */
function mapMachineStateToPhase(machineState: string): GamePhase {
  const mapping: Record<string, GamePhase> = {
    lobby: 'waitingForPlayers' as GamePhase,
    grandTichuDecision: 'grandTichuDecision' as GamePhase,
    cardPassing: 'cardPassing' as GamePhase,
    playing: 'playing' as GamePhase,
    awaitingDragonGift: 'playing' as GamePhase, // Client sees this as still in playing phase
    awaitingEndOfTrickBomb: 'playing' as GamePhase, // Client sees this as still in playing phase
    roundScoring: 'roundScoring' as GamePhase,
    gameOver: 'gameOver' as GamePhase,
  };
  return mapping[machineState] ?? ('waitingForPlayers' as GamePhase);
}

/**
 * REQ-F-SP05: Project game state for spectators — all hands hidden.
 * REQ-NF-SP02: No card IDs or card objects — only cardCount integers.
 *
 * Spectators see mySeat as 'south' (default camera), myHand is empty,
 * and all 4 players appear in otherPlayers with card counts only.
 */
export function projectSpectatorView(
  context: GameMachineContext,
  machineState: string,
  vacatedSeats: readonly Seat[] = [],
  disconnectVoteStatus?: { votes: Record<string, 'wait' | 'kick' | null>; disconnectedSeats: Seat[]; timeoutMs: number } | null,
  activeVote?: { voteId: string; voteType: 'kick' | 'restart'; initiatorSeat: Seat; targetSeat?: Seat; votes: Record<string, boolean | null>; timeoutMs: number } | null,
  timerInfo?: { startTime: number | null; durationMs: number | null },
  endOfTrickBombWindowEndTime?: number | null,
): ClientGameView {
  const round = context.currentRound;
  const phase = mapMachineStateToPhase(machineState);

  if (!round) {
    return {
      gameId: context.gameId,
      config: context.config,
      phase,
      scores: { ...context.scores },
      roundHistory: [...context.roundHistory],
      mySeat: 'south',
      myHand: [],
      myTichuCall: 'none',
      myHasPlayed: false,
      otherPlayers: SEATS_IN_ORDER.map(seat => ({
        seat,
        cardCount: 0,
        tichuCall: 'none' as TichuCall,
        hasPlayed: false,
        finishOrder: null,
      })),
      currentTrick: null,
      currentTurn: null,
      mahjongWish: null,
      wishFulfilled: false,
      finishOrder: [],
      dragonGiftPending: false,
      dragonGiftedTo: null,
      receivedCards: { north: null, east: null, south: null, west: null },
      lastDogPlay: null,
      grandTichuDecided: [],
      cardPassConfirmed: [],
      vacatedSeats: [...vacatedSeats],
      choosingSeat: false,
      disconnectVotes: disconnectVoteStatus?.votes ?? {},
      gameHalted: vacatedSeats.length > 0 || !!disconnectVoteStatus,
      winner: context.winner,
      activeVote: activeVote ?? null,
      // REQ-F-TT05: Turn timer data
      turnTimerStartedAt: timerInfo?.startTime ?? null,
      turnTimerDurationMs: timerInfo?.durationMs ?? null,
      endOfTrickBombWindowEndTime: endOfTrickBombWindowEndTime ?? null,
      serverTime: Date.now(),
    };
  }

  return {
    gameId: context.gameId,
    config: context.config,
    phase,
    scores: { ...context.scores },
    roundHistory: [...context.roundHistory],
    mySeat: 'south',
    myHand: [],
    myTichuCall: 'none',
    myHasPlayed: false,
    otherPlayers: SEATS_IN_ORDER.map(seat => {
      const player = round.players[seat];
      return {
        seat,
        cardCount: player.hand.length,
        tichuCall: player.tipiCall,
        hasPlayed: player.hasPlayed,
        finishOrder: player.finishOrder,
      };
    }),
    currentTrick: round.currentTrick ? sanitizeTrickState(round.currentTrick) : null,
    currentTurn: round.currentTurn,
    mahjongWish: round.mahjongWish,
    wishFulfilled: round.wishFulfilled,
    finishOrder: [...round.finishOrder],
    dragonGiftPending: round.dragonGiftPending !== null,
    dragonGiftedTo: round.dragonGiftedTo ?? null,
    receivedCards: { north: null, east: null, south: null, west: null },
    lastDogPlay: round.lastDogPlay,
    grandTichuDecided: [...context.grandTichuDecisions],
    cardPassConfirmed: [...context.cardPassDecisions],
    vacatedSeats: [...vacatedSeats],
    choosingSeat: false,
    disconnectVotes: disconnectVoteStatus?.votes ?? {},
    gameHalted: vacatedSeats.length > 0 || !!disconnectVoteStatus,
    winner: context.winner,
    activeVote: activeVote ?? null,
    // REQ-F-TT05: Turn timer data
    turnTimerStartedAt: timerInfo?.startTime ?? null,
    turnTimerDurationMs: timerInfo?.durationMs ?? null,
    endOfTrickBombWindowEndTime: endOfTrickBombWindowEndTime ?? null,
    serverTime: Date.now(),
  };
}

/** Create a safe copy of trick state (cards in tricks are public) */
function sanitizeTrickState(trick: TrickState): TrickState {
  return {
    plays: trick.plays.map(p => ({
      seat: p.seat,
      combination: { ...p.combination, cards: [...p.combination.cards] },
    })),
    passes: [...trick.passes],
    leadSeat: trick.leadSeat,
    currentWinner: trick.currentWinner,
  };
}
