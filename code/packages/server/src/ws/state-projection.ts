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
  activeVote?: { voteId: string; voteType: 'kick' | 'restartGame' | 'restartRound' | 'enableBlindGrand' | 'disableBlindGrand'; initiatorSeat: Seat; targetSeat?: Seat; votes: Record<string, boolean | null>; timeoutMs: number } | null,
  timerInfo?: { startTime: number | null; durationMs: number | null },
  endOfTrickBombWindowEndTime?: number | null,
  waitingForReconnect?: Seat | null,
  disconnectedSeats?: Seat[],
  kickDialog?: { targetSeat: Seat } | null,
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
      blindGrandTichuDecided: [],
      grandTichuDecided: [],
      cardPassConfirmed: [],
      vacatedSeats: [...vacatedSeats],
      choosingSeat: choosingSeats.includes(forSeat),
      // REQ-F-GF01: Game halted only when seats are vacant (disconnects no longer halt)
      gameHalted: vacatedSeats.length > 0,
      winner: context.winner,
      // REQ-F-PV23: Active player-initiated vote
      activeVote: activeVote ?? null,
      // REQ-F-TT05: Turn timer data
      turnTimerStartedAt: timerInfo?.startTime ?? null,
      turnTimerDurationMs: timerInfo?.durationMs ?? null,
      endOfTrickBombWindowEndTime: endOfTrickBombWindowEndTime ?? null,
      serverTime: Date.now(),
      // REQ-F-GF04, UI01: Seat the game is waiting for during an untimed phase
      waitingForReconnect: waitingForReconnect ?? null,
      // REQ-F-DC01: Currently disconnected seats
      disconnectedSeats: disconnectedSeats ?? [],
      // REQ-F-KM01: Active kick dialog (null hides from spectators per REQ-F-UI03)
      kickDialog: kickDialog ?? null,
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
    blindGrandTichuDecided: [...context.blindGrandTichuDecisions],
    grandTichuDecided: [...context.grandTichuDecisions],
    cardPassConfirmed: [...context.cardPassDecisions],
    vacatedSeats: [...vacatedSeats],
    choosingSeat: isChoosing,
    // REQ-F-GF01: Game halted only when seats are vacant (disconnects no longer halt)
    gameHalted: vacatedSeats.length > 0,
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
    // REQ-F-GF04, UI01: Seat the game is waiting for during an untimed phase
    waitingForReconnect: waitingForReconnect ?? null,
    // REQ-F-DC01: Currently disconnected seats
    disconnectedSeats: disconnectedSeats ?? [],
    // REQ-F-KM01: Active kick dialog
    kickDialog: kickDialog ?? null,
  };
}

/** Map XState machine state names to GamePhase enum values */
function mapMachineStateToPhase(machineState: string): GamePhase {
  const mapping: Record<string, GamePhase> = {
    lobby: 'waitingForPlayers' as GamePhase,
    blindGrandTichuDecision: 'blindGrandTichuDecision' as GamePhase,
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
  activeVote?: { voteId: string; voteType: 'kick' | 'restartGame' | 'restartRound' | 'enableBlindGrand' | 'disableBlindGrand'; initiatorSeat: Seat; targetSeat?: Seat; votes: Record<string, boolean | null>; timeoutMs: number } | null,
  timerInfo?: { startTime: number | null; durationMs: number | null },
  endOfTrickBombWindowEndTime?: number | null,
  waitingForReconnect?: Seat | null,
  disconnectedSeats?: Seat[],
  _kickDialog?: { targetSeat: Seat } | null,
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
      blindGrandTichuDecided: [],
      grandTichuDecided: [],
      cardPassConfirmed: [],
      vacatedSeats: [...vacatedSeats],
      choosingSeat: false,
      gameHalted: vacatedSeats.length > 0,
      winner: context.winner,
      activeVote: activeVote ?? null,
      // REQ-F-TT05: Turn timer data
      turnTimerStartedAt: timerInfo?.startTime ?? null,
      turnTimerDurationMs: timerInfo?.durationMs ?? null,
      endOfTrickBombWindowEndTime: endOfTrickBombWindowEndTime ?? null,
      serverTime: Date.now(),
      waitingForReconnect: waitingForReconnect ?? null,
      disconnectedSeats: disconnectedSeats ?? [],
      // REQ-F-UI03: Spectators do not see kick dialog
      kickDialog: null,
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
    blindGrandTichuDecided: [...context.blindGrandTichuDecisions],
    grandTichuDecided: [...context.grandTichuDecisions],
    cardPassConfirmed: [...context.cardPassDecisions],
    vacatedSeats: [...vacatedSeats],
    choosingSeat: false,
    gameHalted: vacatedSeats.length > 0,
    winner: context.winner,
    activeVote: activeVote ?? null,
    // REQ-F-TT05: Turn timer data
    turnTimerStartedAt: timerInfo?.startTime ?? null,
    turnTimerDurationMs: timerInfo?.durationMs ?? null,
    endOfTrickBombWindowEndTime: endOfTrickBombWindowEndTime ?? null,
    serverTime: Date.now(),
    // REQ-F-UI01: Spectators see the waiting overlay too
    waitingForReconnect: waitingForReconnect ?? null,
    // REQ-F-DC01: Currently disconnected seats
    disconnectedSeats: disconnectedSeats ?? [],
    // REQ-F-UI03: Spectators do not see kick dialog
    kickDialog: null,
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
