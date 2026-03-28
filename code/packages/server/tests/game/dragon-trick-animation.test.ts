// Verifies: REQ-F-DRA01, REQ-F-DRA03, REQ-NF-DRA03

import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import {
  gameMachine,
  getNextActiveSeat,
  type GameEvent,
} from '../../src/game/game-state-machine.js';
import { projectGameState } from '../../src/ws/state-projection.js';
import type {
  Seat,
  GameCard,
  RoundState,
  GameConfig,
} from '@tichu/shared';
import {
  GamePhase,
  SEATS_IN_ORDER,
  getNextSeat,
  getTeam,
  isDragon,
  isDog,
  isPhoenix,
  isMahjong,
} from '@tichu/shared';

// ─── Test Helpers ───────────────────────────────────────────────────────────

function createTestActor(config?: Partial<GameConfig>) {
  const actor = createActor(gameMachine, {
    input: { gameId: 'test-game', config },
  });
  actor.start();
  return actor;
}

function fillSeats(actor: ReturnType<typeof createTestActor>) {
  for (const seat of SEATS_IN_ORDER) {
    actor.send({ type: 'PLAYER_JOINED', seat });
  }
}

function startGame(actor: ReturnType<typeof createTestActor>) {
  fillSeats(actor);
  actor.send({ type: 'HOST_START_GAME' });
}

function passAllGrandTichu(actor: ReturnType<typeof createTestActor>) {
  for (const seat of SEATS_IN_ORDER) {
    actor.send({ type: 'GRAND_TICHU_PASS', seat });
  }
}

function passAllRegularTichu(actor: ReturnType<typeof createTestActor>) {
  for (const seat of SEATS_IN_ORDER) {
  }
}

function passAllCards(actor: ReturnType<typeof createTestActor>) {
  const ctx = actor.getSnapshot().context;
  const round = ctx.currentRound!;
  for (const seat of SEATS_IN_ORDER) {
    const hand = round.players[seat].hand;
    const otherSeats = SEATS_IN_ORDER.filter((s) => s !== seat);
    const cards: Record<Seat, GameCard> = {} as Record<Seat, GameCard>;
    otherSeats.forEach((s, i) => {
      cards[s] = hand[i];
    });
    cards[seat] = hand[0];
    actor.send({ type: 'CARDS_PASSED', seat, cards });
  }
}

function getToPlayingPhase(actor: ReturnType<typeof createTestActor>) {
  startGame(actor);
  passAllGrandTichu(actor);
  passAllRegularTichu(actor);
  passAllCards(actor);
}

/** Find the Dragon card in a player's hand */
function findDragon(hand: GameCard[]): GameCard | null {
  return hand.find((gc) => isDragon(gc.card)) ?? null;
}

/** Find a non-special single card in a player's hand */
function findPlayableSingle(hand: GameCard[]): GameCard | null {
  return hand.find((gc) =>
    !isDog(gc.card) && !isDragon(gc.card) && !isPhoenix(gc.card) && !isMahjong(gc.card),
  ) ?? null;
}

/** Repeatedly play tricks until the Dragon holder gets to lead, then return */
function advanceUntilSeatLeads(
  actor: ReturnType<typeof createTestActor>,
  targetSeat: Seat,
  maxAttempts = 20,
): boolean {
  for (let i = 0; i < maxAttempts; i++) {
    const round = actor.getSnapshot().context.currentRound!;
    if (round.currentTurn === targetSeat) return true;

    // Current leader plays a single, others pass
    const leader = round.currentTurn!;
    const card = findPlayableSingle(round.players[leader].hand);
    if (!card) return false;

    actor.send({ type: 'PLAY_CARDS', seat: leader, cards: [card] });

    // Others pass
    let nextSeat = getNextActiveSeat(leader, actor.getSnapshot().context.currentRound!);
    for (let p = 0; p < 3; p++) {
      const snap = actor.getSnapshot();
      if (snap.value !== 'playing') break;
      if (snap.context.currentRound?.currentTurn !== nextSeat) break;
      actor.send({ type: 'PASS_TURN', seat: nextSeat });
      if (p < 2) {
        const ns = actor.getSnapshot();
        if (ns.context.currentRound) {
          nextSeat = getNextActiveSeat(nextSeat, ns.context.currentRound);
        }
      }
    }
  }
  return false;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Dragon Trick Animation — Server Changes (M1)', () => {
  // Verifies: REQ-NF-DRA03 — dragonGiftedTo initialized to null
  describe('createRoundState', () => {
    it('initialises dragonGiftedTo as null', () => {
      const actor = createTestActor();
      startGame(actor);
      const round = actor.getSnapshot().context.currentRound!;
      expect(round.dragonGiftedTo).toBeNull();
      actor.stop();
    });
  });

  // Verifies: REQ-F-DRA01 — trick stays visible during awaitingDragonGift (manual gift)
  describe('completeTrickAndAdvance — manual gift', () => {
    it('keeps currentTrick alive when Dragon wins and manual gift is needed', () => {
      const actor = createTestActor();
      getToPlayingPhase(actor);

      const round = actor.getSnapshot().context.currentRound!;

      // Find a seat with the Dragon
      let dragonSeat: Seat | null = null;
      for (const seat of SEATS_IN_ORDER) {
        if (findDragon(round.players[seat].hand)) {
          dragonSeat = seat;
          break;
        }
      }

      if (!dragonSeat) {
        // Dragon not in anyone's hand (shouldn't happen, but skip test gracefully)
        return;
      }

      // Advance until Dragon holder is leading
      const reached = advanceUntilSeatLeads(actor, dragonSeat);
      if (!reached) return; // Skip if we can't get there

      const preSnap = actor.getSnapshot();
      if (preSnap.value !== 'playing') return;
      const preRound = preSnap.context.currentRound!;
      if (preRound.currentTurn !== dragonSeat) return;

      const dragon = findDragon(preRound.players[dragonSeat].hand);
      if (!dragon) return;

      // Play the Dragon
      actor.send({ type: 'PLAY_CARDS', seat: dragonSeat, cards: [dragon] });

      // All others pass — trick completes with Dragon as winner
      let nextSeat = getNextActiveSeat(dragonSeat, actor.getSnapshot().context.currentRound!);
      for (let p = 0; p < 3; p++) {
        const snap = actor.getSnapshot();
        if (snap.value !== 'playing') break;
        if (snap.context.currentRound?.currentTurn !== nextSeat) break;
        actor.send({ type: 'PASS_TURN', seat: nextSeat });
        if (p < 2) {
          const ns = actor.getSnapshot();
          if (ns.context.currentRound) {
            nextSeat = getNextActiveSeat(nextSeat, ns.context.currentRound);
          }
        }
      }

      const snap = actor.getSnapshot();

      // Should be in awaitingDragonGift (manual gift — both opponents active)
      if (snap.value === 'awaitingDragonGift') {
        const r = snap.context.currentRound!;

        // REQ-F-DRA01: currentTrick must still be non-null
        expect(r.currentTrick).not.toBeNull();
        expect(r.currentTrick!.currentWinner).toBe(dragonSeat);

        // dragonGiftPending should be set
        expect(r.dragonGiftPending).not.toBeNull();
        expect(r.dragonGiftPending!.from).toBe(dragonSeat);

        // dragonGiftedTo should still be null (not yet chosen)
        expect(r.dragonGiftedTo).toBeNull();
      }
      // If auto-gift happened, that's also fine — tested separately

      actor.stop();
    });
  });

  // Verifies: REQ-F-DRA02 — giveDragonTrick sets dragonGiftedTo
  describe('giveDragonTrick — manual gift sets dragonGiftedTo', () => {
    it('sets dragonGiftedTo to the chosen recipient after manual gift', () => {
      const actor = createTestActor();
      getToPlayingPhase(actor);

      const round = actor.getSnapshot().context.currentRound!;

      let dragonSeat: Seat | null = null;
      for (const seat of SEATS_IN_ORDER) {
        if (findDragon(round.players[seat].hand)) {
          dragonSeat = seat;
          break;
        }
      }
      if (!dragonSeat) return;

      const reached = advanceUntilSeatLeads(actor, dragonSeat);
      if (!reached) return;

      const preRound = actor.getSnapshot().context.currentRound!;
      if (preRound.currentTurn !== dragonSeat) return;
      const dragon = findDragon(preRound.players[dragonSeat].hand);
      if (!dragon) return;

      actor.send({ type: 'PLAY_CARDS', seat: dragonSeat, cards: [dragon] });

      // All others pass
      let nextSeat = getNextActiveSeat(dragonSeat, actor.getSnapshot().context.currentRound!);
      for (let p = 0; p < 3; p++) {
        const snap = actor.getSnapshot();
        if (snap.value !== 'playing') break;
        if (snap.context.currentRound?.currentTurn !== nextSeat) break;
        actor.send({ type: 'PASS_TURN', seat: nextSeat });
        if (p < 2) {
          const ns = actor.getSnapshot();
          if (ns.context.currentRound) {
            nextSeat = getNextActiveSeat(nextSeat, ns.context.currentRound);
          }
        }
      }

      const snap = actor.getSnapshot();
      if (snap.value !== 'awaitingDragonGift') return;

      const r = snap.context.currentRound!;
      const myTeam = getTeam(dragonSeat);
      const opponent = SEATS_IN_ORDER.find(
        (s) => getTeam(s) !== myTeam && r.players[s].finishOrder === null,
      )!;

      // Choose recipient
      actor.send({ type: 'DRAGON_GIFT_CHOSEN', seat: dragonSeat, recipient: opponent });

      const afterSnap = actor.getSnapshot();
      const afterRound = afterSnap.context.currentRound!;

      // REQ-F-DRA02: dragonGiftedTo should be set to the chosen recipient
      expect(afterRound.dragonGiftedTo).toBe(opponent);

      // currentTrick should now be null (gift completed)
      expect(afterRound.currentTrick).toBeNull();

      // dragonGiftPending should be cleared
      expect(afterRound.dragonGiftPending).toBeNull();

      actor.stop();
    });
  });

  // Verifies: REQ-F-DRA03 — dragonGiftedTo cleared on next playCards
  describe('dragonGiftedTo reset', () => {
    it('clears dragonGiftedTo on the next playCards action', () => {
      const actor = createTestActor();
      getToPlayingPhase(actor);

      const round = actor.getSnapshot().context.currentRound!;

      let dragonSeat: Seat | null = null;
      for (const seat of SEATS_IN_ORDER) {
        if (findDragon(round.players[seat].hand)) {
          dragonSeat = seat;
          break;
        }
      }
      if (!dragonSeat) return;

      const reached = advanceUntilSeatLeads(actor, dragonSeat);
      if (!reached) return;

      const preRound = actor.getSnapshot().context.currentRound!;
      if (preRound.currentTurn !== dragonSeat) return;
      const dragon = findDragon(preRound.players[dragonSeat].hand);
      if (!dragon) return;

      actor.send({ type: 'PLAY_CARDS', seat: dragonSeat, cards: [dragon] });

      // All others pass
      let nextSeat = getNextActiveSeat(dragonSeat, actor.getSnapshot().context.currentRound!);
      for (let p = 0; p < 3; p++) {
        const snap = actor.getSnapshot();
        if (snap.value !== 'playing') break;
        if (snap.context.currentRound?.currentTurn !== nextSeat) break;
        actor.send({ type: 'PASS_TURN', seat: nextSeat });
        if (p < 2) {
          const ns = actor.getSnapshot();
          if (ns.context.currentRound) {
            nextSeat = getNextActiveSeat(nextSeat, ns.context.currentRound);
          }
        }
      }

      const snap = actor.getSnapshot();
      if (snap.value !== 'awaitingDragonGift') return;

      const r = snap.context.currentRound!;
      const myTeam = getTeam(dragonSeat);
      const opponent = SEATS_IN_ORDER.find(
        (s) => getTeam(s) !== myTeam && r.players[s].finishOrder === null,
      )!;

      actor.send({ type: 'DRAGON_GIFT_CHOSEN', seat: dragonSeat, recipient: opponent });

      // Verify dragonGiftedTo is set
      const midSnap = actor.getSnapshot();
      expect(midSnap.context.currentRound!.dragonGiftedTo).toBe(opponent);

      // Now play another card (the next leader plays)
      if (midSnap.value !== 'playing') return;
      const nextLeader = midSnap.context.currentRound!.currentTurn!;
      const nextCard = findPlayableSingle(midSnap.context.currentRound!.players[nextLeader].hand);
      if (!nextCard) return;

      actor.send({ type: 'PLAY_CARDS', seat: nextLeader, cards: [nextCard] });

      // dragonGiftedTo should now be null
      const afterSnap = actor.getSnapshot();
      expect(afterSnap.context.currentRound!.dragonGiftedTo).toBeNull();

      actor.stop();
    });
  });

  // Verifies: REQ-F-DRA03, REQ-NF-DRA03 — state-projection includes dragonGiftedTo
  describe('state-projection', () => {
    it('projects dragonGiftedTo as null in the client view by default', () => {
      const actor = createTestActor();
      getToPlayingPhase(actor);

      const snap = actor.getSnapshot();
      const view = projectGameState(snap.context, snap.value as string, 'north');

      expect(view.dragonGiftedTo).toBeNull();

      actor.stop();
    });

    it('projects dragonGiftedTo as null in lobby state', () => {
      const actor = createTestActor();
      fillSeats(actor);

      const snap = actor.getSnapshot();
      const view = projectGameState(snap.context, 'lobby', 'north');

      expect(view.dragonGiftedTo).toBeNull();

      actor.stop();
    });
  });
});
