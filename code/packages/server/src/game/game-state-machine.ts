// REQ-F-GF01: Game lifecycle state machine
// REQ-F-GF02: Card passing (1 to each other player)
// REQ-F-GF03: Mahjong leads first trick + wish
// REQ-F-GF05: Trick won by 3 consecutive passes
// REQ-F-GF06: Round ends when ≤1 player has cards
// REQ-F-GF07: Turn order skips finished players
// REQ-F-GF08: Tichu declaration +100/-100
// REQ-F-GF09: Grand Tichu +200/-200
// REQ-F-DR01: Dragon trick given to opponent
// REQ-F-MP09: Optional turn timer
// REQ-F-BI01: Out-of-turn bomb interrupts

import { setup, assign, createActor, type ActorRefFrom } from 'xstate';
import type {
  GameCard,
  Rank,
  Seat,
  Team,
  TichuCall,
  RoundState,
  PlayerState,
  TrickState,
  GameConfig,
  RoundScore,
  Combination,
} from '@tichu/shared';
import {
  GamePhase,
  SEATS_IN_ORDER,
  getTeam,
  getPartner,
  getNextSeat,
  DEFAULT_GAME_CONFIG,
  createDeck,
  shuffleDeck,
  dealCards,
  isMahjong,
  isDog,
  isDragon,
  validatePlay,
  canPlayerPass,
  scoreRound,
  checkGameOver,
  detectCombination,
} from '@tichu/shared';

// ─── Event Types ────────────────────────────────────────────────────────────

export type GameEvent =
  | { type: 'PLAYER_JOINED'; seat: Seat }
  | { type: 'HOST_START_GAME' }
  | { type: 'GRAND_TICHU_CALL'; seat: Seat }
  | { type: 'GRAND_TICHU_PASS'; seat: Seat }
  | { type: 'REGULAR_TICHU_CALL'; seat: Seat }
  | { type: 'REGULAR_TICHU_PASS'; seat: Seat }
  | { type: 'CARDS_PASSED'; seat: Seat; cards: Record<Seat, GameCard> }
  | { type: 'PLAY_CARDS'; seat: Seat; cards: GameCard[]; wish?: Rank }
  | { type: 'PASS_TURN'; seat: Seat }
  | { type: 'DRAGON_GIFT_CHOSEN'; seat: Seat; recipient: Seat }
  | { type: 'TURN_TIMEOUT'; seat: Seat }
  | { type: 'DECLARE_WISH'; seat: Seat; rank: Rank | null };

// ─── Context Type ───────────────────────────────────────────────────────────

export interface GameMachineContext {
  gameId: string;
  config: GameConfig;
  seats: Record<Seat, boolean>;
  scores: Record<Team, number>;
  roundHistory: RoundScore[];
  currentRound: RoundState | null;
  /** Tracks which seats have made their Grand Tichu decision */
  grandTichuDecisions: Set<Seat>;
  /** Tracks which seats have made their Regular Tichu decision */
  regularTichuDecisions: Set<Seat>;
  /** Tracks which seats have passed cards */
  cardPassDecisions: Set<Seat>;
  /** Winner of the game, if any */
  winner: Team | null;
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/** REQ-F-GF01: Create initial context for a new game */
export function createInitialContext(gameId: string, config?: Partial<GameConfig>): GameMachineContext {
  return {
    gameId,
    config: { ...DEFAULT_GAME_CONFIG, ...config },
    seats: { north: false, east: false, south: false, west: false },
    scores: { northSouth: 0, eastWest: 0 },
    roundHistory: [],
    currentRound: null,
    grandTichuDecisions: new Set(),
    regularTichuDecisions: new Set(),
    cardPassDecisions: new Set(),
    winner: null,
  };
}

/** Create a fresh PlayerState for a seat */
function createPlayerState(seat: Seat): PlayerState {
  return {
    seat,
    hand: [],
    tricksWon: [],
    tipiCall: 'none',
    hasPlayed: false,
    finishOrder: null,
    passedCards: {
      to: { north: null, east: null, south: null, west: null },
      received: false,
    },
  };
}

/** Create a fresh RoundState */
function createRoundState(roundNumber: number): RoundState {
  return {
    roundNumber,
    phase: GamePhase.GrandTichuDecision,
    players: {
      north: createPlayerState('north'),
      east: createPlayerState('east'),
      south: createPlayerState('south'),
      west: createPlayerState('west'),
    },
    currentTrick: null,
    currentTurn: null,
    mahjongWish: null,
    wishFulfilled: false,
    finishOrder: [],
    dragonGiftPending: null,
  };
}

/** REQ-F-GF03: Find the seat holding the Mahjong card */
export function findMahjongHolder(round: RoundState): Seat {
  for (const seat of SEATS_IN_ORDER) {
    if (round.players[seat].hand.some((gc) => isMahjong(gc.card))) {
      return seat;
    }
  }
  // Should never happen with a valid deal
  return 'north';
}

/** REQ-F-GF07: Get next active player (skip finished players) */
export function getNextActiveSeat(currentSeat: Seat, round: RoundState): Seat {
  let next = getNextSeat(currentSeat);
  let attempts = 0;
  while (round.players[next].finishOrder !== null && attempts < 4) {
    next = getNextSeat(next);
    attempts++;
  }
  return next;
}

/** REQ-F-GF06: Count how many players still have cards */
export function countActivePlayers(round: RoundState): number {
  return SEATS_IN_ORDER.filter((s) => round.players[s].finishOrder === null).length;
}

/** REQ-F-GF05: Check if trick is complete (3 consecutive passes or all active players passed) */
export function isTrickComplete(trick: TrickState, round: RoundState): boolean {
  if (trick.plays.length === 0) return false;

  // 3 consecutive passes means the last play stands
  if (trick.passes.length >= 3) return true;

  // If all remaining active players (except the current winner) have passed
  const activePlayers = SEATS_IN_ORDER.filter((s) => round.players[s].finishOrder === null);
  const nonWinnerActive = activePlayers.filter((s) => s !== trick.currentWinner);
  return nonWinnerActive.length > 0 && nonWinnerActive.every((s) => trick.passes.includes(s));
}

/** Collect all cards from a completed trick */
function collectTrickCards(trick: TrickState): GameCard[] {
  return trick.plays.flatMap((p) => p.combination.cards);
}

/** Check if a play is a Dog (passes lead to partner) */
function isDogPlay(combination: Combination): boolean {
  return combination.cards.length === 1 && isDog(combination.cards[0].card);
}

/** Check if a play contains Dragon */
function isDragonPlay(combination: Combination): boolean {
  return combination.cards.length === 1 && isDragon(combination.cards[0].card);
}

/** REQ-F-DR01: Check if Dragon gift is needed (Dragon won the trick, not by bomb) */
function needsDragonGift(trick: TrickState): boolean {
  // Find the winning play
  const winningPlay = trick.plays.find((p) => p.seat === trick.currentWinner);
  if (!winningPlay) return false;

  // Only applies when Dragon is the winning single card
  if (!isDragonPlay(winningPlay.combination)) return false;

  // If the trick was won by a bomb over the Dragon, no gift needed
  const lastPlay = trick.plays[trick.plays.length - 1];
  if (lastPlay.combination.isBomb && lastPlay.seat !== trick.currentWinner) {
    // A bomb was played but isn't the winning play - this shouldn't happen normally
    // But if someone bombed and became the current winner, that's fine
    return false;
  }

  return true;
}

/** Check if there's only one eligible opponent for Dragon gift */
function getAutoGiftRecipient(trickWinner: Seat, round: RoundState): Seat | null {
  const opponentSeats = SEATS_IN_ORDER.filter(
    (s) => getTeam(s) !== getTeam(trickWinner) && round.players[s].finishOrder === null,
  );
  if (opponentSeats.length === 1) return opponentSeats[0];
  return null;
}

// ─── State Machine Definition ───────────────────────────────────────────────

/** Input type for creating a game machine */
export interface GameMachineInput {
  gameId: string;
  config?: Partial<GameConfig>;
}

export const gameMachine = setup({
  types: {
    context: {} as GameMachineContext,
    events: {} as GameEvent,
    input: {} as GameMachineInput,
  },
  guards: {
    /** REQ-F-GF01: Can start game — all 4 seats filled */
    canStartGame: ({ context }) => {
      return SEATS_IN_ORDER.every((s) => context.seats[s]);
    },

    /** All players made Grand Tichu decision */
    allGrandTichuDecided: ({ context }) => {
      return context.grandTichuDecisions.size === 4;
    },

    /** All players made Regular Tichu decision */
    allRegularTichuDecided: ({ context }) => {
      return context.regularTichuDecisions.size === 4;
    },

    /** All players passed cards */
    allCardsPassed: ({ context }) => {
      return context.cardPassDecisions.size === 4;
    },

    /** REQ-F-GF05: Current trick is complete */
    isTrickDone: ({ context }) => {
      const round = context.currentRound;
      if (!round || !round.currentTrick) return false;
      return isTrickComplete(round.currentTrick, round);
    },

    /** REQ-F-GF06: Round is complete (≤1 player has cards) */
    isRoundComplete: ({ context }) => {
      const round = context.currentRound;
      if (!round) return false;
      return countActivePlayers(round) <= 1;
    },

    /** REQ-F-GF10: Game over — a team reached target score */
    isGameOver: ({ context }) => {
      return context.winner !== null;
    },

    /** Dragon gift is needed */
    needsDragonGift: ({ context }) => {
      const round = context.currentRound;
      if (!round || !round.dragonGiftPending) return false;
      return true;
    },

    /** It's this player's turn */
    isPlayersTurn: ({ context, event }) => {
      const round = context.currentRound;
      if (!round || !round.currentTurn) return false;
      if (!('seat' in event)) return false;
      return event.seat === round.currentTurn;
    },

    /** REQ-F-BI01: Out-of-turn bomb — any non-finished player during an active trick */
    isBombPlay: ({ context, event }) => {
      if (event.type !== 'PLAY_CARDS' || !context.currentRound) return false;
      const round = context.currentRound;
      const seat = event.seat;
      // Player must not be finished
      if (round.players[seat].finishOrder !== null) return false;
      // Must have an active trick with plays (can't bomb-lead)
      if (!round.currentTrick || round.currentTrick.plays.length === 0) return false;
      // Detect combination and check it's a bomb
      const combo = detectCombination(event.cards);
      return combo !== null && combo.isBomb;
    },

    /** Player hasn't already decided Grand Tichu */
    hasNotDecidedGrandTichu: ({ context, event }) => {
      if (!('seat' in event)) return false;
      return !context.grandTichuDecisions.has(event.seat);
    },

    /** Player hasn't already decided Regular Tichu */
    hasNotDecidedRegularTichu: ({ context, event }) => {
      if (!('seat' in event)) return false;
      return !context.regularTichuDecisions.has(event.seat);
    },

    /** Player hasn't already passed cards */
    hasNotPassedCards: ({ context, event }) => {
      if (!('seat' in event)) return false;
      return !context.cardPassDecisions.has(event.seat);
    },

    /** Seat is not already occupied */
    seatAvailable: ({ context, event }) => {
      if (event.type !== 'PLAYER_JOINED') return false;
      return !context.seats[event.seat];
    },
  },
  actions: {
    /** Add a player to a seat */
    seatPlayer: assign({
      seats: ({ context, event }) => {
        if (event.type !== 'PLAYER_JOINED') return context.seats;
        return { ...context.seats, [event.seat]: true };
      },
    }),

    /** REQ-F-GF01: Start a new round — deal first 8 cards */
    startRound: assign(({ context }) => {
      const roundNumber = context.roundHistory.length + 1;
      const round = createRoundState(roundNumber);

      // Deal cards
      const deck = shuffleDeck(createDeck());
      const dealt = dealCards(deck);

      // Give each player their first 8 cards
      for (const seat of SEATS_IN_ORDER) {
        round.players[seat].hand = dealt[seat].first8;
        // Store remaining 6 in a temporary property — we'll add them after Grand Tichu
        (round.players[seat] as PlayerState & { _remaining6?: GameCard[] })._remaining6 =
          dealt[seat].remaining6;
      }

      return {
        currentRound: round,
        grandTichuDecisions: new Set<Seat>(),
        regularTichuDecisions: new Set<Seat>(),
        cardPassDecisions: new Set<Seat>(),
      };
    }),

    /** REQ-F-GF09: Record Grand Tichu call */
    recordGrandTichuCall: assign(({ context, event }) => {
      if (event.type !== 'GRAND_TICHU_CALL' || !context.currentRound) return {};
      const round = structuredClone(context.currentRound) as RoundState;
      round.players[event.seat].tipiCall = 'grandTichu';
      const decisions = new Set(context.grandTichuDecisions);
      decisions.add(event.seat);
      return { currentRound: round, grandTichuDecisions: decisions };
    }),

    /** Record Grand Tichu pass */
    recordGrandTichuPass: assign(({ context, event }) => {
      if (event.type !== 'GRAND_TICHU_PASS') return {};
      const decisions = new Set(context.grandTichuDecisions);
      decisions.add(event.seat);
      return { grandTichuDecisions: decisions };
    }),

    /** Deal remaining 6 cards after Grand Tichu decisions */
    dealRemaining6: assign(({ context }) => {
      if (!context.currentRound) return {};
      const round = structuredClone(context.currentRound) as RoundState;
      round.phase = GamePhase.TichuDecision;

      for (const seat of SEATS_IN_ORDER) {
        const player = round.players[seat] as PlayerState & { _remaining6?: GameCard[] };
        if (player._remaining6) {
          player.hand = [...player.hand, ...player._remaining6];
          delete player._remaining6;
        }
      }

      return { currentRound: round };
    }),

    /** REQ-F-GF08: Record Regular Tichu call */
    recordRegularTichuCall: assign(({ context, event }) => {
      if (event.type !== 'REGULAR_TICHU_CALL' || !context.currentRound) return {};
      const round = structuredClone(context.currentRound) as RoundState;
      // Only allow Tichu if they haven't already called Grand Tichu
      if (round.players[event.seat].tipiCall === 'none') {
        round.players[event.seat].tipiCall = 'tichu';
      }
      const decisions = new Set(context.regularTichuDecisions);
      decisions.add(event.seat);
      return { currentRound: round, regularTichuDecisions: decisions };
    }),

    /** Record Regular Tichu pass */
    recordRegularTichuPass: assign(({ context, event }) => {
      if (event.type !== 'REGULAR_TICHU_PASS') return {};
      const decisions = new Set(context.regularTichuDecisions);
      decisions.add(event.seat);
      return { regularTichuDecisions: decisions };
    }),

    /** Transition to card passing phase */
    enterCardPassing: assign(({ context }) => {
      if (!context.currentRound) return {};
      const round = structuredClone(context.currentRound) as RoundState;
      round.phase = GamePhase.CardPassing;
      return { currentRound: round };
    }),

    /** REQ-F-GF02: Record a player's card passes */
    recordCardPass: assign(({ context, event }) => {
      if (event.type !== 'CARDS_PASSED' || !context.currentRound) return {};
      const round = structuredClone(context.currentRound) as RoundState;
      const seat = event.seat;

      // Record the cards being passed
      for (const targetSeat of SEATS_IN_ORDER) {
        if (targetSeat === seat) continue;
        round.players[seat].passedCards.to[targetSeat] = event.cards[targetSeat];
      }

      const decisions = new Set(context.cardPassDecisions);
      decisions.add(seat);
      return { currentRound: round, cardPassDecisions: decisions };
    }),

    /** REQ-F-GF02: Execute card exchange after all players have passed */
    executeCardExchange: assign(({ context }) => {
      if (!context.currentRound) return {};
      const round = structuredClone(context.currentRound) as RoundState;

      // For each player, remove cards they passed and add cards they received
      for (const seat of SEATS_IN_ORDER) {
        const player = round.players[seat];

        // Remove cards passed to others
        const passedIds = new Set<number>();
        for (const target of SEATS_IN_ORDER) {
          if (target === seat) continue;
          const passedCard = player.passedCards.to[target];
          if (passedCard) passedIds.add(passedCard.id);
        }
        player.hand = player.hand.filter((gc) => !passedIds.has(gc.id));

        // Add cards received from others
        for (const fromSeat of SEATS_IN_ORDER) {
          if (fromSeat === seat) continue;
          const receivedCard = round.players[fromSeat].passedCards.to[seat];
          if (receivedCard) {
            player.hand.push(receivedCard);
          }
        }

        player.passedCards.received = true;
      }

      return { currentRound: round };
    }),

    /** REQ-F-GF03: Enter playing phase — Mahjong holder leads */
    enterPlaying: assign(({ context }) => {
      if (!context.currentRound) return {};
      const round = structuredClone(context.currentRound) as RoundState;
      round.phase = GamePhase.Playing;
      round.currentTurn = findMahjongHolder(round);
      return { currentRound: round };
    }),

    /** Play cards onto the current trick */
    playCards: assign(({ context, event }) => {
      if (event.type !== 'PLAY_CARDS' || !context.currentRound) return {};
      const round = structuredClone(context.currentRound) as RoundState;
      const seat = event.seat;
      const cards = event.cards;

      // Validate the play
      const validation = validatePlay(
        cards,
        round.players[seat].hand,
        round.currentTrick,
        round.mahjongWish && !round.wishFulfilled ? round.mahjongWish : null,
      );

      if (!validation.valid) return {}; // Invalid play — no state change

      const combination = validation.combination;

      // REQ-F-GF03: Handle Mahjong wish
      if (event.wish !== undefined && cards.some((gc) => isMahjong(gc.card))) {
        round.mahjongWish = event.wish;
        round.wishFulfilled = false;
      }

      // Check if wish is fulfilled by this play
      if (round.mahjongWish && !round.wishFulfilled) {
        const hasWishedRank = combination.cards.some(
          (gc) => gc.card.kind === 'standard' && gc.card.rank === round.mahjongWish,
        );
        if (hasWishedRank) {
          round.wishFulfilled = true;
        }
      }

      // Handle Dog play — passes lead to partner
      if (isDogPlay(combination)) {
        const partner = getPartner(seat);
        // Remove Dog from hand
        const cardIds = new Set(cards.map((c) => c.id));
        round.players[seat].hand = round.players[seat].hand.filter((gc) => !cardIds.has(gc.id));
        round.players[seat].hasPlayed = true;

        // Dog goes to the partner (or next active if partner is out)
        let nextLead = partner;
        if (round.players[partner].finishOrder !== null) {
          nextLead = getNextActiveSeat(partner, round);
        }
        round.currentTurn = nextLead;
        round.currentTrick = null; // Dog doesn't create a trick
        return { currentRound: round };
      }

      // Create trick if needed
      if (!round.currentTrick) {
        round.currentTrick = {
          plays: [],
          passes: [],
          leadSeat: seat,
          currentWinner: seat,
        };
      }

      // Add play to trick
      round.currentTrick.plays.push({ seat, combination });
      round.currentTrick.passes = []; // Reset passes after a play
      round.currentTrick.currentWinner = seat;

      // Remove cards from hand
      const cardIds = new Set(cards.map((c) => c.id));
      round.players[seat].hand = round.players[seat].hand.filter((gc) => !cardIds.has(gc.id));
      round.players[seat].hasPlayed = true;

      // Check if player finished (hand empty)
      if (round.players[seat].hand.length === 0) {
        round.finishOrder.push(seat);
        round.players[seat].finishOrder = round.finishOrder.length;
      }

      // Check if trick is complete (e.g., bomb after all others passed)
      if (isTrickComplete(round.currentTrick, round)) {
        return completeTrickAndAdvance(round, context);
      }

      // Advance turn
      round.currentTurn = getNextActiveSeat(seat, round);

      return { currentRound: round };
    }),

    /** Pass on current trick */
    passTurn: assign(({ context, event }) => {
      if (event.type !== 'PASS_TURN' || !context.currentRound) return {};
      const round = structuredClone(context.currentRound) as RoundState;
      const seat = event.seat;

      if (!round.currentTrick) return {}; // Can't pass when leading

      // Check pass validity
      const wish = round.mahjongWish && !round.wishFulfilled ? round.mahjongWish : null;
      if (!canPlayerPass(round.players[seat].hand, round.currentTrick, wish)) {
        return {}; // Invalid pass
      }

      round.currentTrick.passes.push(seat);

      // Check if trick is now complete
      if (isTrickComplete(round.currentTrick, round)) {
        return completeTrickAndAdvance(round, context);
      }

      // Advance turn
      round.currentTurn = getNextActiveSeat(seat, round);

      return { currentRound: round };
    }),

    /** Handle turn timeout (auto-pass or play lowest valid card) */
    handleTimeout: assign(({ context, event }) => {
      if (event.type !== 'TURN_TIMEOUT' || !context.currentRound) return {};
      const round = structuredClone(context.currentRound) as RoundState;
      const seat = event.seat;

      if (round.currentTurn !== seat) return {};

      const wish = round.mahjongWish && !round.wishFulfilled ? round.mahjongWish : null;

      // If can pass, auto-pass
      if (round.currentTrick && canPlayerPass(round.players[seat].hand, round.currentTrick, wish)) {
        round.currentTrick.passes.push(seat);

        if (isTrickComplete(round.currentTrick, round)) {
          return completeTrickAndAdvance(round, context);
        }

        round.currentTurn = getNextActiveSeat(seat, round);
        return { currentRound: round };
      }

      // Must play — handled by the game manager (pick lowest valid play)
      // For the state machine, timeout when must play is a no-op;
      // the game manager should translate it into a PLAY_CARDS event
      return {};
    }),

    /** REQ-F-DR01: Choose Dragon gift recipient */
    giveDragonTrick: assign(({ context, event }) => {
      if (event.type !== 'DRAGON_GIFT_CHOSEN' || !context.currentRound) return {};
      const round = structuredClone(context.currentRound) as RoundState;

      if (!round.dragonGiftPending) return {};

      // Give the trick cards to the chosen opponent
      round.players[event.recipient].tricksWon.push(round.dragonGiftPending.trickCards);
      round.dragonGiftPending = null;

      // Check if round is over
      if (countActivePlayers(round) <= 1) {
        return scoreAndFinishRound(round, context);
      }

      // Continue with next trick — winner leads
      round.currentTrick = null;
      // The trick winner already had their turn advance handled
      return { currentRound: round };
    }),
  },
}).createMachine({
  id: 'tichuGame',
  initial: 'lobby',
  context: ({ input }) => createInitialContext(input.gameId, input.config),
  states: {
    lobby: {
      on: {
        PLAYER_JOINED: {
          guard: 'seatAvailable',
          actions: 'seatPlayer',
        },
        HOST_START_GAME: {
          guard: 'canStartGame',
          target: 'grandTichuDecision',
          actions: 'startRound',
        },
      },
    },

    grandTichuDecision: {
      on: {
        GRAND_TICHU_CALL: {
          guard: 'hasNotDecidedGrandTichu',
          actions: 'recordGrandTichuCall',
        },
        GRAND_TICHU_PASS: {
          guard: 'hasNotDecidedGrandTichu',
          actions: 'recordGrandTichuPass',
        },
      },
      always: {
        guard: 'allGrandTichuDecided',
        target: 'regularTichuDecision',
        actions: 'dealRemaining6',
      },
    },

    regularTichuDecision: {
      on: {
        REGULAR_TICHU_CALL: {
          guard: 'hasNotDecidedRegularTichu',
          actions: 'recordRegularTichuCall',
        },
        REGULAR_TICHU_PASS: {
          guard: 'hasNotDecidedRegularTichu',
          actions: 'recordRegularTichuPass',
        },
      },
      always: {
        guard: 'allRegularTichuDecided',
        target: 'cardPassing',
        actions: 'enterCardPassing',
      },
    },

    cardPassing: {
      on: {
        CARDS_PASSED: {
          guard: 'hasNotPassedCards',
          actions: 'recordCardPass',
        },
      },
      always: {
        guard: 'allCardsPassed',
        target: 'playing',
        actions: ['executeCardExchange', 'enterPlaying'],
      },
    },

    playing: {
      on: {
        // REQ-F-BI01: Array transition — bomb bypass checked first, then normal turn check
        PLAY_CARDS: [
          {
            guard: 'isBombPlay',
            actions: 'playCards',
          },
          {
            guard: 'isPlayersTurn',
            actions: 'playCards',
          },
        ],
        PASS_TURN: {
          guard: 'isPlayersTurn',
          actions: 'passTurn',
        },
        TURN_TIMEOUT: {
          actions: 'handleTimeout',
        },
        REGULAR_TICHU_CALL: {
          // REQ-F-GF08: Can call Tichu before first play
          actions: assign(({ context, event }) => {
            if (event.type !== 'REGULAR_TICHU_CALL' || !context.currentRound) return {};
            const round = structuredClone(context.currentRound) as RoundState;
            const player = round.players[event.seat];
            // Can only call Tichu before first play and if no existing call
            if (!player.hasPlayed && player.tipiCall === 'none') {
              player.tipiCall = 'tichu';
            }
            return { currentRound: round };
          }),
        },
        DECLARE_WISH: {
          // REQ-F-GF03: Mahjong wish declared separately after playing Mahjong
          actions: assign(({ context, event }) => {
            if (event.type !== 'DECLARE_WISH' || !context.currentRound) return {};
            const round = structuredClone(context.currentRound) as RoundState;
            // Only set wish if Mahjong was played in the current trick
            if (!round.currentTrick) return {};
            const mahjongPlayed = round.currentTrick.plays.some((p) =>
              p.seat === event.seat && p.combination.cards.some((gc) => isMahjong(gc.card)),
            );
            if (!mahjongPlayed) return {};
            round.mahjongWish = event.rank;
            if (event.rank !== null) {
              round.wishFulfilled = false;
            }
            return { currentRound: round };
          }),
        },
      },
      always: [
        {
          guard: 'needsDragonGift',
          target: 'awaitingDragonGift',
        },
        {
          guard: 'isRoundComplete',
          target: 'roundScoring',
        },
      ],
    },

    awaitingDragonGift: {
      on: {
        DRAGON_GIFT_CHOSEN: {
          actions: 'giveDragonTrick',
          target: 'playing',
        },
      },
    },

    roundScoring: {
      entry: assign(({ context }) => {
        if (!context.currentRound) return {};
        return scoreAndFinishRound(context.currentRound, context);
      }),
      always: [
        {
          guard: 'isGameOver',
          target: 'gameOver',
        },
        {
          target: 'grandTichuDecision',
          actions: 'startRound',
        },
      ],
    },

    gameOver: {
      type: 'final',
    },
  },
});

// ─── Scoring & Round Completion Helper ──────────────────────────────────────

function completeTrickAndAdvance(
  round: RoundState,
  context: GameMachineContext,
): Partial<GameMachineContext> {
  const trick = round.currentTrick!;
  const trickCards = collectTrickCards(trick);
  const winner = trick.currentWinner;

  // Check for Dragon gift
  if (needsDragonGift(trick)) {
    // Check auto-gift (only 1 opponent remaining)
    const autoRecipient = getAutoGiftRecipient(winner, round);
    if (autoRecipient) {
      round.players[autoRecipient].tricksWon.push(trickCards);
      round.dragonGiftPending = null;
    } else {
      round.dragonGiftPending = { trickCards, from: winner };
      round.currentTrick = null;
      round.currentTurn = winner; // Winner decides who to give it to
      return { currentRound: round };
    }
  } else {
    // Normal trick — winner collects cards
    round.players[winner].tricksWon.push(trickCards);
  }

  round.currentTrick = null;

  // Check if round is over
  if (countActivePlayers(round) <= 1) {
    return scoreAndFinishRound(round, context);
  }

  // Winner leads next trick (or next active if winner is out)
  if (round.players[winner].finishOrder !== null) {
    round.currentTurn = getNextActiveSeat(winner, round);
  } else {
    round.currentTurn = winner;
  }

  return { currentRound: round };
}

function scoreAndFinishRound(
  round: RoundState,
  context: GameMachineContext,
): Partial<GameMachineContext> {
  // Handle last player — give remaining hand points to opponents, tricks to first-out
  const activePlayers = SEATS_IN_ORDER.filter((s) => round.players[s].finishOrder === null);
  if (activePlayers.length === 1) {
    const lastSeat = activePlayers[0];
    round.finishOrder.push(lastSeat);
    round.players[lastSeat].finishOrder = round.finishOrder.length;
  }

  round.phase = GamePhase.RoundScoring;

  // Build scoring data
  const tricksWon: Record<Seat, GameCard[][]> = {
    north: round.players.north.tricksWon,
    east: round.players.east.tricksWon,
    south: round.players.south.tricksWon,
    west: round.players.west.tricksWon,
  };

  const handsRemaining: Record<Seat, GameCard[]> = {
    north: round.players.north.hand,
    east: round.players.east.hand,
    south: round.players.south.hand,
    west: round.players.west.hand,
  };

  const tichuCalls: Record<Seat, TichuCall> = {
    north: round.players.north.tipiCall,
    east: round.players.east.tipiCall,
    south: round.players.south.tipiCall,
    west: round.players.west.tipiCall,
  };

  const roundScore = scoreRound(
    round.roundNumber,
    round.finishOrder,
    tricksWon,
    handsRemaining,
    tichuCalls,
  );

  const newScores = {
    northSouth: context.scores.northSouth + roundScore.total.northSouth,
    eastWest: context.scores.eastWest + roundScore.total.eastWest,
  };

  const newHistory = [...context.roundHistory, roundScore];

  // Check game over — returns Team | null
  const winner = checkGameOver(newScores, context.config.targetScore);

  return {
    currentRound: round,
    scores: newScores,
    roundHistory: newHistory,
    winner,
  };
}

// ─── Actor Creation Helper ──────────────────────────────────────────────────

export function createGameActor(gameId: string, config?: Partial<GameConfig>) {
  return createActor(gameMachine, {
    input: { gameId, config },
  });
}

export type GameActor = ActorRefFrom<typeof gameMachine>;
