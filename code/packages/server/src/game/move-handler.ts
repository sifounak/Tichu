// REQ-F-DR01: Dragon trick given to opponent
// REQ-F-DR02: Dragon auto-select when 1 opponent left
// REQ-F-DR03: Bomb overrides Dragon gift
// REQ-F-MP01: Any combination 0-4 humans + bots
// REQ-F-BI01: Out-of-turn bomb interrupts

import type { GameCard, Seat, Rank } from '@tichu/shared';
import { SEATS_IN_ORDER, getTeam, isMahjong, detectCombination } from '@tichu/shared';
import type { GameActor, GameEvent, GameMachineContext } from './game-state-machine.js';

/** Result of handling a client game message */
export type MoveResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Translates client WebSocket messages into state machine events and
 * validates preconditions that the state machine guards don't cover.
 *
 * Responsibilities:
 * - Resolve card IDs to actual GameCard objects from the player's hand
 * - Validate that it's the player's turn where applicable
 * - Map client message types to GameEvent types
 * - Send validated events to the XState actor
 */
export class MoveHandler {
  constructor(private readonly actor: GameActor) {}

  /** Get current machine context */
  private get context(): GameMachineContext {
    return this.actor.getSnapshot().context;
  }

  /** Get current machine state value */
  private get stateValue(): string {
    const value = this.actor.getSnapshot().value;
    return typeof value === 'string' ? value : String(value);
  }

  /** Resolve card IDs to GameCard objects from a player's hand */
  private resolveCards(seat: Seat, cardIds: number[]): GameCard[] | null {
    const round = this.context.currentRound;
    if (!round) return null;

    const hand = round.players[seat].hand;
    const cards: GameCard[] = [];

    for (const id of cardIds) {
      const card = hand.find((gc) => gc.id === id);
      if (!card) return null;
      cards.push(card);
    }

    return cards;
  }

  /** Handle START_GAME from host */
  handleStartGame(): MoveResult {
    if (this.stateValue !== 'lobby') {
      return { ok: false, error: 'Game is not in lobby state' };
    }
    this.actor.send({ type: 'HOST_START_GAME' });
    return { ok: true };
  }

  /** Handle GRAND_TICHU_DECISION */
  handleGrandTichuDecision(seat: Seat, call: boolean): MoveResult {
    if (this.stateValue !== 'grandTichuDecision') {
      return { ok: false, error: 'Not in Grand Tichu decision phase' };
    }
    if (this.context.grandTichuDecisions.has(seat)) {
      return { ok: false, error: 'Already made Grand Tichu decision' };
    }

    const event: GameEvent = call
      ? { type: 'GRAND_TICHU_CALL', seat }
      : { type: 'GRAND_TICHU_PASS', seat };
    this.actor.send(event);
    return { ok: true };
  }

  /** Handle TICHU_DECLARATION */
  handleTichuDeclaration(seat: Seat): MoveResult {
    const state = this.stateValue;
    if (state === 'regularTichuDecision') {
      if (this.context.regularTichuDecisions.has(seat)) {
        return { ok: false, error: 'Already made Tichu decision' };
      }
      this.actor.send({ type: 'REGULAR_TICHU_CALL', seat });
      return { ok: true };
    }

    if (state === 'playing') {
      const round = this.context.currentRound;
      if (!round) return { ok: false, error: 'No active round' };
      const player = round.players[seat];
      if (player.hasPlayed) {
        return { ok: false, error: 'Cannot call Tichu after first play' };
      }
      if (player.tipiCall !== 'none') {
        return { ok: false, error: 'Already made a Tichu call' };
      }
      this.actor.send({ type: 'REGULAR_TICHU_CALL', seat });
      return { ok: true };
    }

    return { ok: false, error: 'Cannot call Tichu in current phase' };
  }

  /** Handle passing on Regular Tichu decision */
  handleRegularTichuPass(seat: Seat): MoveResult {
    if (this.stateValue !== 'regularTichuDecision') {
      return { ok: false, error: 'Not in Tichu decision phase' };
    }
    if (this.context.regularTichuDecisions.has(seat)) {
      return { ok: false, error: 'Already made Tichu decision' };
    }
    this.actor.send({ type: 'REGULAR_TICHU_PASS', seat });
    return { ok: true };
  }

  /** Handle PASS_CARDS — allowed during cardPassing and earlier phases (once player has 14 cards) */
  handlePassCards(seat: Seat, cards: Record<Seat, GameCard>): MoveResult {
    const allowedStates = ['cardPassing', 'grandTichuDecision', 'regularTichuDecision'];
    if (!allowedStates.includes(this.stateValue)) {
      return { ok: false, error: 'Not in card passing phase' };
    }
    // During GT/Tichu decision, player must have decided (and received remaining 6 cards)
    if (this.stateValue !== 'cardPassing') {
      const round = this.context.currentRound;
      if (!round || round.players[seat].hand.length < 14) {
        return { ok: false, error: 'Must decide Grand Tichu before passing cards' };
      }
    }
    if (this.context.cardPassDecisions.has(seat)) {
      return { ok: false, error: 'Already passed cards' };
    }

    // Verify passed cards belong to player's hand
    const round = this.context.currentRound;
    if (!round) return { ok: false, error: 'No active round' };

    const hand = round.players[seat].hand;
    const passedIds = new Set<number>();
    for (const targetSeat of SEATS_IN_ORDER) {
      if (targetSeat === seat) continue;
      const passedCard = cards[targetSeat];
      if (!passedCard) return { ok: false, error: `Missing card for ${targetSeat}` };
      if (!hand.find((gc) => gc.id === passedCard.id)) {
        return { ok: false, error: `Card ${passedCard.id} not in hand` };
      }
      if (passedIds.has(passedCard.id)) {
        return { ok: false, error: 'Cannot pass the same card twice' };
      }
      passedIds.add(passedCard.id);
    }

    this.actor.send({ type: 'CARDS_PASSED', seat, cards });
    return { ok: true };
  }

  /** Handle CANCEL_PASS_CARDS — allowed during cardPassing and earlier phases */
  handleCancelPassCards(seat: Seat): MoveResult {
    const allowedStates = ['cardPassing', 'grandTichuDecision', 'regularTichuDecision'];
    if (!allowedStates.includes(this.stateValue)) {
      return { ok: false, error: 'Not in card passing phase' };
    }
    if (!this.context.cardPassDecisions.has(seat)) {
      return { ok: false, error: 'No pass to cancel' };
    }
    this.actor.send({ type: 'CARDS_PASS_CANCELLED', seat });
    return { ok: true };
  }

  /** Handle PLAY_CARDS */
  handlePlayCards(seat: Seat, cardIds: number[], _phoenixAs?: Rank, wish?: Rank | null): MoveResult {
    if (this.stateValue !== 'playing') {
      return { ok: false, error: `Not in playing phase (server state: ${this.stateValue})` };
    }

    const round = this.context.currentRound;
    if (!round) return { ok: false, error: 'No active round' };

    const cards = this.resolveCards(seat, cardIds);
    if (!cards) {
      return { ok: false, error: 'One or more cards not in hand' };
    }

    // REQ-F-BI01: Allow out-of-turn play only for bombs during an active trick
    if (round.currentTurn !== seat) {
      const combo = detectCombination(cards);
      const hasActiveTrick = round.currentTrick !== null && round.currentTrick.plays.length > 0;
      if (!combo?.isBomb || !hasActiveTrick) {
        return { ok: false, error: 'Not your turn' };
      }
      // REQ-F-BI07: Finished players cannot bomb
      if (round.players[seat].finishOrder !== null) {
        return { ok: false, error: 'You have already finished' };
      }
      // REQ-F-BI05: Dragon gift pending blocks all play
      if (round.dragonGiftPending) {
        return { ok: false, error: 'Waiting for Dragon gift decision' };
      }
    }

    // The state machine's playCards action handles full validation
    // REQ-F-WP01: Forward wish from PLAY_CARDS to state machine
    this.actor.send({ type: 'PLAY_CARDS', seat, cards, wish: wish ?? undefined });
    return { ok: true };
  }

  /** Handle PASS_TURN */
  handlePassTurn(seat: Seat): MoveResult {
    if (this.stateValue !== 'playing') {
      return { ok: false, error: `Not in playing phase (server state: ${this.stateValue})` };
    }

    const round = this.context.currentRound;
    if (!round) return { ok: false, error: 'No active round' };

    if (round.currentTurn !== seat) {
      return { ok: false, error: 'Not your turn' };
    }

    this.actor.send({ type: 'PASS_TURN', seat });
    return { ok: true };
  }

  /** Handle DECLARE_WISH */
  handleDeclareWish(seat: Seat, rank: Rank | null): MoveResult {
    if (this.stateValue !== 'playing') {
      return { ok: false, error: 'Not in playing phase' };
    }

    const round = this.context.currentRound;
    if (!round || !round.currentTrick) {
      return { ok: false, error: 'No active trick' };
    }

    // Verify this player played Mahjong in the current trick
    const mahjongPlayed = round.currentTrick.plays.some(
      (p) => p.seat === seat && p.combination.cards.some((gc) => isMahjong(gc.card)),
    );
    if (!mahjongPlayed) {
      return { ok: false, error: 'Can only declare wish after playing Mahjong' };
    }

    // REQ-F-WR02: Reject if another player has played since the Mahjong play
    const lastPlay = round.currentTrick.plays[round.currentTrick.plays.length - 1];
    if (!lastPlay || lastPlay.seat !== seat) {
      return { ok: false, error: 'Cannot declare wish after another player has played' };
    }

    // REQ-F-WV01: Validate wish rank is an integer between 2 and 14
    if (rank !== null && (typeof rank !== 'number' || rank < 2 || rank > 14 || !Number.isInteger(rank))) {
      return { ok: false, error: 'Wish rank must be an integer between 2 and 14' };
    }

    this.actor.send({ type: 'DECLARE_WISH', seat, rank });
    return { ok: true };
  }

  /** REQ-F-DR01: Handle GIFT_DRAGON */
  handleGiftDragon(seat: Seat, recipient: Seat): MoveResult {
    if (this.stateValue !== 'awaitingDragonGift') {
      return { ok: false, error: 'Not awaiting Dragon gift' };
    }

    const round = this.context.currentRound;
    if (!round || !round.dragonGiftPending) {
      return { ok: false, error: 'No Dragon gift pending' };
    }

    if (round.dragonGiftPending.from !== seat) {
      return { ok: false, error: 'Only the Dragon winner can gift the trick' };
    }

    // REQ-F-DR01: Must gift to an opponent
    if (getTeam(seat) === getTeam(recipient)) {
      return { ok: false, error: 'Must gift Dragon trick to an opponent' };
    }

    this.actor.send({ type: 'DRAGON_GIFT_CHOSEN', seat, recipient });
    return { ok: true };
  }

  /** Handle seat joining */
  handlePlayerJoined(seat: Seat): MoveResult {
    if (this.stateValue !== 'lobby') {
      return { ok: false, error: 'Game is not in lobby' };
    }
    if (this.context.seats[seat]) {
      return { ok: false, error: 'Seat is already taken' };
    }
    this.actor.send({ type: 'PLAYER_JOINED', seat });
    return { ok: true };
  }
}
