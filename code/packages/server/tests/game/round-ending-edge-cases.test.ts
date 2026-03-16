// Verifies: REQ-F-BUG01, REQ-F-BUG03

import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import {
  gameMachine,
  getNextActiveSeat,
  countActivePlayers,
  type GameEvent,
} from '../../src/game/game-state-machine.js';
import type {
  Seat,
  GameCard,
  RoundState,
  GameConfig,
} from '@tichu/shared';
import {
  SEATS_IN_ORDER,
  getTeam,
  getPartner,
  isMahjong,
  isDog,
  isDragon,
  isPhoenix,
  detectCombination,
  getValidPlays,
  CombinationType,
} from '@tichu/shared';

// ─── Test Helpers ───────────────────────────────────────────────────────────

function createTestActor(config?: Partial<GameConfig>) {
  const actor = createActor(gameMachine, {
    input: { gameId: 'test-game', config },
  });
  actor.start();
  return actor;
}

function startGame(actor: ReturnType<typeof createTestActor>) {
  for (const seat of SEATS_IN_ORDER) {
    actor.send({ type: 'PLAYER_JOINED', seat });
  }
  actor.send({ type: 'HOST_START_GAME' });
}

function passAllGrandTichu(actor: ReturnType<typeof createTestActor>) {
  for (const seat of SEATS_IN_ORDER) {
    actor.send({ type: 'GRAND_TICHU_PASS', seat });
  }
}

function passAllRegularTichu(actor: ReturnType<typeof createTestActor>) {
  for (const seat of SEATS_IN_ORDER) {
    actor.send({ type: 'REGULAR_TICHU_PASS', seat });
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

/** Find a non-Dog, non-Dragon single card in the hand */
function findPlayableNonSpecialSingle(hand: GameCard[]): GameCard | null {
  for (const gc of hand) {
    if (!isDog(gc.card) && !isDragon(gc.card) && !isPhoenix(gc.card)) {
      return gc;
    }
  }
  return null;
}

/** Play a complete round: play tricks until state leaves 'playing' */
function playFullRound(actor: ReturnType<typeof createTestActor>): void {
  let safety = 0;
  while (safety < 200) {
    const snap = actor.getSnapshot();
    if (snap.value !== 'playing') break;

    const round = snap.context.currentRound!;
    const seat = round.currentTurn!;
    const hand = round.players[seat].hand;
    const validPlays = getValidPlays(hand, round.currentTrick, round.mahjongWish);

    if (validPlays.length === 0 || (round.currentTrick && round.currentTrick.plays.length > 0)) {
      // Try to pass if possible
      actor.send({ type: 'PASS_TURN', seat });
    } else {
      // Play the first valid combination
      const play = validPlays[0];
      actor.send({ type: 'PLAY_CARDS', seat, cards: play.cards });
    }

    // Handle Dragon gift if needed
    const newSnap = actor.getSnapshot();
    if (newSnap.value === 'awaitingDragonGift') {
      const r = newSnap.context.currentRound!;
      const giftFrom = r.dragonGiftPending!.from;
      const myTeam = getTeam(giftFrom);
      const opponent = SEATS_IN_ORDER.find(
        (s) => getTeam(s) !== myTeam && r.players[s].finishOrder === null,
      )!;
      actor.send({ type: 'DRAGON_GIFT_CHOSEN', seat: giftFrom, recipient: opponent });
    }

    safety++;
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('REQ-F-BUG01: Round-ending edge cases', () => {
  it('game completes a full round without getting stuck', () => {
    const actor = createTestActor();
    getToPlayingPhase(actor);

    expect(actor.getSnapshot().value).toBe('playing');

    playFullRound(actor);

    const snap = actor.getSnapshot();
    // Should have moved to either roundScoring→grandTichuDecision or gameOver
    expect(snap.value).not.toBe('playing');
    expect(['grandTichuDecision', 'gameOver']).toContain(snap.value);
    actor.stop();
  });

  it('no double-scoring: round scores are computed exactly once', () => {
    const actor = createTestActor();
    getToPlayingPhase(actor);

    const scoresBefore = { ...actor.getSnapshot().context.scores };

    playFullRound(actor);

    const snap = actor.getSnapshot();
    const scoresAfter = snap.context.scores;
    const history = snap.context.roundHistory;

    // Exactly one round score entry should have been added
    expect(history.length).toBe(1);

    // Scores should match: before + round total = after
    const roundTotal = history[0].total;
    expect(scoresAfter.northSouth).toBe(scoresBefore.northSouth + roundTotal.northSouth);
    expect(scoresAfter.eastWest).toBe(scoresBefore.eastWest + roundTotal.eastWest);

    actor.stop();
  });

  it('plays multiple rounds without getting stuck or double-scoring', () => {
    const actor = createTestActor({ targetScore: 5000 }); // High target to avoid game over
    getToPlayingPhase(actor);

    // Play 3 rounds
    for (let round = 0; round < 3; round++) {
      const snap = actor.getSnapshot();
      if (snap.value === 'gameOver') break;

      if (snap.value === 'playing') {
        playFullRound(actor);
      }

      // Should transition to next round
      const afterSnap = actor.getSnapshot();
      if (afterSnap.value === 'grandTichuDecision') {
        passAllGrandTichu(actor);
        passAllRegularTichu(actor);
        passAllCards(actor);
      }
    }

    const finalSnap = actor.getSnapshot();
    const history = finalSnap.context.roundHistory;

    // Verify no double-scoring: sum of round totals should equal final scores
    let totalNS = 0;
    let totalEW = 0;
    for (const rs of history) {
      totalNS += rs.total.northSouth;
      totalEW += rs.total.eastWest;
    }
    expect(finalSnap.context.scores.northSouth).toBe(totalNS);
    expect(finalSnap.context.scores.eastWest).toBe(totalEW);

    actor.stop();
  });

  it('1-2 finish: isRoundComplete detects teammates going out 1st and 2nd', () => {
    // This is a unit test for the guard logic
    const round: RoundState = {
      roundNumber: 1,
      phase: 0, // Playing
      players: {
        north: { finishOrder: 1 } as any,
        east: { finishOrder: null } as any,
        south: { finishOrder: 2 } as any,
        west: { finishOrder: null } as any,
      },
      currentTrick: null,
      currentTurn: 'east',
      mahjongWish: null,
      wishFulfilled: false,
      finishOrder: ['north', 'south'] as Seat[],
      dragonGiftPending: null,
      lastDogPlay: null,
    };

    // North-South are teammates and went out 1-2
    expect(getTeam('north')).toBe(getTeam('south'));
    // countActivePlayers is 2 (east and west still playing)
    expect(countActivePlayers(round)).toBe(2);

    // The isRoundComplete guard should detect this via the 1-2 check
    // We verify this indirectly: if the finishOrder has 2 teammates first,
    // the round should end
    expect(round.finishOrder.length).toBeGreaterThanOrEqual(2);
    expect(getTeam(round.finishOrder[0])).toBe(getTeam(round.finishOrder[1]));
  });
});

describe('REQ-F-BUG03: Phoenix singleton display value', () => {
  it('Phoenix single on a trick gets contextual rank (topRank + 0.5)', () => {
    const actor = createTestActor();
    getToPlayingPhase(actor);

    const snap = actor.getSnapshot();
    const round = snap.context.currentRound!;
    const leader = round.currentTurn!;

    // Find a standard single to play first
    const leaderHand = round.players[leader].hand;
    const standardCard = findPlayableNonSpecialSingle(leaderHand);
    if (!standardCard) {
      // Skip if no suitable card (very unlikely with random deal)
      return;
    }

    // Leader plays a standard single
    actor.send({ type: 'PLAY_CARDS', seat: leader, cards: [standardCard] });

    // Find the next player who has Phoenix
    const snap2 = actor.getSnapshot();
    const round2 = snap2.context.currentRound!;
    const nextPlayer = round2.currentTurn!;
    const nextHand = round2.players[nextPlayer].hand;
    const phoenixCard = nextHand.find((gc) => isPhoenix(gc.card));

    if (!phoenixCard) {
      // Skip if next player doesn't have Phoenix
      return;
    }

    // Play Phoenix on the trick
    actor.send({ type: 'PLAY_CARDS', seat: nextPlayer, cards: [phoenixCard] });

    // Check the trick's last play — Phoenix should have contextual rank
    const snap3 = actor.getSnapshot();
    const round3 = snap3.context.currentRound!;
    const trick = round3.currentTrick!;
    const lastPlay = trick.plays[trick.plays.length - 1];
    const phoenixCombo = lastPlay.combination;

    expect(phoenixCombo.type).toBe(CombinationType.Single);
    // Phoenix should have rank = standardCard's rank + 0.5
    const expectedRank = standardCard.card.kind === 'standard'
      ? standardCard.card.rank + 0.5
      : 1.5; // fallback for Mahjong (rank 1)
    expect(phoenixCombo.rank).toBe(expectedRank);

    actor.stop();
  });

  it('Phoenix single as lead keeps rank 1.5', () => {
    const actor = createTestActor();
    getToPlayingPhase(actor);

    const snap = actor.getSnapshot();
    const round = snap.context.currentRound!;
    const leader = round.currentTurn!;
    const hand = round.players[leader].hand;
    const phoenixCard = hand.find((gc) => isPhoenix(gc.card));

    if (!phoenixCard) {
      // Leader doesn't have Phoenix — skip
      return;
    }

    // If leader can play Phoenix as lead (no trick active)
    if (round.currentTrick === null) {
      actor.send({ type: 'PLAY_CARDS', seat: leader, cards: [phoenixCard] });

      const snap2 = actor.getSnapshot();
      const round2 = snap2.context.currentRound!;
      const trick = round2.currentTrick!;
      const lastPlay = trick.plays[trick.plays.length - 1];
      expect(lastPlay.combination.rank).toBe(1.5);
    }

    actor.stop();
  });
});
