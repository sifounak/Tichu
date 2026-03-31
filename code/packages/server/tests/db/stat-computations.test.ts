// Verifies: REQ-F-GA01–GA05, REQ-F-GB01–GB05, REQ-F-SO07–SO11

import { describe, it, expect } from 'vitest';
import {
  computeGameStats,
  computeRoundStats,
  getOpponentSeats,
} from '../../src/db/stat-computations.js';
import type { RoundScore, Team } from '@tichu/shared';

function makeRoundScore(overrides: Partial<RoundScore> = {}): RoundScore {
  return {
    roundNumber: 1,
    cardPoints: { northSouth: 75, eastWest: 25 },
    tichuBonuses: { northSouth: 0, eastWest: 0 },
    oneTwoBonus: null,
    total: { northSouth: 75, eastWest: 25 },
    tichuResults: { north: null, east: null, south: null, west: null },
    bombsPerTeam: { northSouth: 0, eastWest: 0 },
    finishOrder: ['north', 'east', 'south', 'west'],
    ...overrides,
  };
}

describe('stat-computations', () => {
  describe('getOpponentSeats', () => {
    it('should return east/west for north', () => {
      expect(getOpponentSeats('north')).toEqual(['east', 'west']);
    });
    it('should return north/south for east', () => {
      expect(getOpponentSeats('east')).toEqual(['north', 'south']);
    });
  });

  describe('computeGameStats', () => {
    // Verifies: REQ-F-GA01
    it('should compute basic game stats', () => {
      const scores: Record<Team, number> = { northSouth: 1050, eastWest: 800 };
      const result = computeGameStats(scores, 'northSouth', [], 'north', 1000);
      expect(result.gamesPlayed).toBe(1);
      expect(result.gamesWon).toBe(1);
    });

    it('should compute loss for opposing team', () => {
      const scores: Record<Team, number> = { northSouth: 1050, eastWest: 800 };
      const result = computeGameStats(scores, 'northSouth', [], 'east', 1000);
      expect(result.gamesWon).toBe(0);
    });

    // Verifies: REQ-F-GA02
    it('should compute largest win diff', () => {
      const scores: Record<Team, number> = { northSouth: 1200, eastWest: 800 };
      const result = computeGameStats(scores, 'northSouth', [], 'north', 1000);
      expect(result.largestWinDiff).toBe(400);
      expect(result.largestLossDiff).toBe(0);
    });

    it('should compute largest loss diff', () => {
      const scores: Record<Team, number> = { northSouth: 600, eastWest: 1100 };
      const result = computeGameStats(scores, 'eastWest', [], 'north', 1000);
      expect(result.largestWinDiff).toBe(0);
      expect(result.largestLossDiff).toBe(500);
    });

    // Verifies: REQ-F-GA05
    it('should count 1-2 wins and against', () => {
      const rounds = [
        makeRoundScore({ oneTwoBonus: 'northSouth' }),
        makeRoundScore({ oneTwoBonus: 'eastWest' }),
        makeRoundScore({ oneTwoBonus: 'northSouth' }),
      ];
      const scores: Record<Team, number> = { northSouth: 1050, eastWest: 800 };
      const result = computeGameStats(scores, 'northSouth', rounds, 'north', 1000);
      expect(result.oneTwoWins).toBe(2);
      expect(result.oneTwoAgainst).toBe(1);
    });

    // Verifies: REQ-F-SO10
    it('should detect tie-break game', () => {
      const rounds = [
        makeRoundScore({ total: { northSouth: 500, eastWest: 500 } }),
        makeRoundScore({ total: { northSouth: 600, eastWest: 600 } }),
        // Both at 1100 after round 2 — tie-break needed
        makeRoundScore({ total: { northSouth: 100, eastWest: -100 } }),
        // NS wins after round 3
      ];
      const scores: Record<Team, number> = { northSouth: 1200, eastWest: 1000 };
      const result = computeGameStats(scores, 'northSouth', rounds, 'north', 1000);
      expect(result.gamesRequiringTieBreak).toBe(1);
      expect(result.mostTieBreakRoundsNeeded).toBe(1);
    });

    it('should detect multi-round tie-break', () => {
      const rounds = [
        makeRoundScore({ total: { northSouth: 600, eastWest: 600 } }),
        makeRoundScore({ total: { northSouth: 500, eastWest: 500 } }),
        // Both at 1100 after round 2 — tie-break
        makeRoundScore({ total: { northSouth: 50, eastWest: 50 } }),
        // Still tied — another round
        makeRoundScore({ total: { northSouth: 200, eastWest: -200 } }),
      ];
      const scores: Record<Team, number> = { northSouth: 1350, eastWest: 950 };
      const result = computeGameStats(scores, 'northSouth', rounds, 'north', 1000);
      expect(result.gamesRequiringTieBreak).toBe(1);
      expect(result.mostTieBreakRoundsNeeded).toBe(2);
    });

    it('should NOT detect tie-break when only one team reaches target', () => {
      const rounds = [
        makeRoundScore({ total: { northSouth: 500, eastWest: 400 } }),
        makeRoundScore({ total: { northSouth: 600, eastWest: 300 } }),
      ];
      const scores: Record<Team, number> = { northSouth: 1100, eastWest: 700 };
      const result = computeGameStats(scores, 'northSouth', rounds, 'north', 1000);
      expect(result.gamesRequiringTieBreak).toBe(0);
      expect(result.mostTieBreakRoundsNeeded).toBe(0);
    });

    it('should NOT detect tie-break when both reach target in the final round', () => {
      // Game ended naturally — no extra rounds were needed
      const rounds = [
        makeRoundScore({ total: { northSouth: 500, eastWest: 400 } }),
        makeRoundScore({ total: { northSouth: 600, eastWest: 700 } }),
        // Both at 1100 in final round, but NS wins because 1100 > 1100 is false
        // Actually both exceed target — but no more rounds means no tie-break
      ];
      const scores: Record<Team, number> = { northSouth: 1100, eastWest: 1100 };
      const result = computeGameStats(scores, null, rounds, 'north', 1000);
      // Final round — no extra rounds needed, so no tie-break
      expect(result.gamesRequiringTieBreak).toBe(0);
    });
  });

  describe('computeRoundStats', () => {
    // Verifies: REQ-F-GB01
    it('should count rounds won', () => {
      const rounds = [
        makeRoundScore({ total: { northSouth: 75, eastWest: 25 } }),
        makeRoundScore({ total: { northSouth: 40, eastWest: 60 } }),
        makeRoundScore({ total: { northSouth: 100, eastWest: 0 } }),
      ];
      const result = computeRoundStats(rounds, 'north');
      expect(result.totalRoundsPlayed).toBe(3);
      expect(result.roundsWon).toBe(2);
    });

    // Verifies: REQ-F-GB02
    it('should count tichu calls and successes', () => {
      const rounds = [
        makeRoundScore({
          finishOrder: ['north', 'east', 'south', 'west'],
          tichuResults: {
            north: { call: 'tichu', won: true },
            east: null, south: null, west: null,
          },
        }),
        makeRoundScore({
          finishOrder: ['east', 'south', 'north', 'west'],
          tichuResults: {
            north: { call: 'tichu', won: false },
            east: null, south: null, west: null,
          },
        }),
      ];
      const result = computeRoundStats(rounds, 'north');
      expect(result.tichuCalls).toBe(2);
      expect(result.tichuSuccesses).toBe(1);
    });

    it('should count grand tichu calls and successes', () => {
      const rounds = [
        makeRoundScore({
          finishOrder: ['north', 'east', 'south', 'west'],
          tichuResults: {
            north: { call: 'grandTichu', won: true },
            east: null, south: null, west: null,
          },
        }),
      ];
      const result = computeRoundStats(rounds, 'north');
      expect(result.grandTichuCalls).toBe(1);
      expect(result.grandTichuSuccesses).toBe(1);
    });

    // Verifies: REQ-F-SO07
    it('should count first finishes based on finishOrder (not tichu calls)', () => {
      const rounds = [
        makeRoundScore({
          finishOrder: ['north', 'east', 'south', 'west'],
          tichuResults: { north: null, east: null, south: null, west: null },
        }),
        makeRoundScore({
          finishOrder: ['east', 'north', 'south', 'west'],
          tichuResults: { north: null, east: null, south: null, west: null },
        }),
      ];
      const result = computeRoundStats(rounds, 'north');
      expect(result.firstFinishes).toBe(1); // Only round 1, no tichu call needed
    });

    // Verifies: REQ-F-SO08
    it('should count last finishes', () => {
      const rounds = [
        makeRoundScore({ finishOrder: ['east', 'south', 'west', 'north'] }),
        makeRoundScore({ finishOrder: ['north', 'east', 'south', 'west'] }),
        makeRoundScore({ finishOrder: ['east', 'south', 'west', 'north'] }),
      ];
      const result = computeRoundStats(rounds, 'north');
      expect(result.lastFinishes).toBe(2);
      expect(result.firstFinishes).toBe(1);
    });

    // Verifies: REQ-F-GB03
    it('should count opponent tichu broken', () => {
      const rounds = [
        makeRoundScore({
          tichuResults: {
            north: null,
            east: { call: 'tichu', won: false },
            south: null,
            west: { call: 'grandTichu', won: false },
          },
        }),
      ];
      const result = computeRoundStats(rounds, 'north');
      expect(result.opponentTichuBroken).toBe(1);
      expect(result.opponentGrandTichuBroken).toBe(1);
    });

    it('should NOT count successful opponent tichu as broken', () => {
      const rounds = [
        makeRoundScore({
          tichuResults: {
            north: null,
            east: { call: 'tichu', won: true },
            south: null, west: null,
          },
        }),
      ];
      const result = computeRoundStats(rounds, 'north');
      expect(result.opponentTichuBroken).toBe(0);
    });

    // Verifies: REQ-F-SO11
    it('should count partner tichu broken when I finished first and partner lost', () => {
      const rounds = [
        makeRoundScore({
          finishOrder: ['north', 'east', 'west', 'south'],
          tichuResults: {
            north: null,
            east: null,
            south: { call: 'tichu', won: false },
            west: null,
          },
        }),
      ];
      const result = computeRoundStats(rounds, 'north');
      expect(result.partnerTichuBroken).toBe(1);
    });

    it('should NOT count partner tichu broken when someone else finished first', () => {
      const rounds = [
        makeRoundScore({
          finishOrder: ['east', 'north', 'west', 'south'],
          tichuResults: {
            north: null,
            east: null,
            south: { call: 'tichu', won: false },
            west: null,
          },
        }),
      ];
      const result = computeRoundStats(rounds, 'north');
      expect(result.partnerTichuBroken).toBe(0);
    });

    // Verifies: REQ-F-SO09
    it('should count tichu broken by partner', () => {
      const rounds = [
        makeRoundScore({
          finishOrder: ['south', 'east', 'north', 'west'],
          tichuResults: {
            north: { call: 'tichu', won: false },
            east: null,
            south: null, // partner finished first
            west: null,
          },
        }),
      ];
      const result = computeRoundStats(rounds, 'north');
      expect(result.tichuBrokenByPartner).toBe(1);
    });

    it('should count grand tichu broken by partner', () => {
      const rounds = [
        makeRoundScore({
          finishOrder: ['south', 'east', 'north', 'west'],
          tichuResults: {
            north: { call: 'grandTichu', won: false },
            east: null,
            south: null,
            west: null,
          },
        }),
      ];
      const result = computeRoundStats(rounds, 'north');
      expect(result.grandTichuBrokenByPartner).toBe(1);
    });

    it('should NOT count tichu broken by partner when opponent finished first', () => {
      const rounds = [
        makeRoundScore({
          finishOrder: ['east', 'south', 'north', 'west'],
          tichuResults: {
            north: { call: 'tichu', won: false },
            east: null, south: null, west: null,
          },
        }),
      ];
      const result = computeRoundStats(rounds, 'north');
      expect(result.tichuBrokenByPartner).toBe(0);
    });

    it('should handle empty round history', () => {
      const result = computeRoundStats([], 'north');
      expect(result.totalRoundsPlayed).toBe(0);
      expect(result.roundsWon).toBe(0);
      expect(result.tichuCalls).toBe(0);
      expect(result.lastFinishes).toBe(0);
      expect(result.tichuBrokenByPartner).toBe(0);
    });

    it('should handle all 4 players calling tichu in one round', () => {
      const rounds = [
        makeRoundScore({
          finishOrder: ['north', 'east', 'south', 'west'],
          tichuResults: {
            north: { call: 'tichu', won: true },
            east: { call: 'tichu', won: false },
            south: { call: 'tichu', won: false },
            west: { call: 'tichu', won: false },
          },
        }),
      ];
      const result = computeRoundStats(rounds, 'north');
      expect(result.tichuCalls).toBe(1);
      expect(result.tichuSuccesses).toBe(1);
      expect(result.opponentTichuBroken).toBe(2); // east and west both failed
      expect(result.partnerTichuBroken).toBe(1); // south failed, north finished first
    });
  });
});
