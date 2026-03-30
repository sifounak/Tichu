// Verifies: REQ-F-GA01–GA05, REQ-F-GB01–GB05

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
      const result = computeGameStats(scores, 'northSouth', [], 'north');
      expect(result.gamesPlayed).toBe(1);
      expect(result.gamesWon).toBe(1);
    });

    it('should compute loss for opposing team', () => {
      const scores: Record<Team, number> = { northSouth: 1050, eastWest: 800 };
      const result = computeGameStats(scores, 'northSouth', [], 'east');
      expect(result.gamesWon).toBe(0);
    });

    // Verifies: REQ-F-GA02
    it('should compute largest win diff', () => {
      const scores: Record<Team, number> = { northSouth: 1200, eastWest: 800 };
      const result = computeGameStats(scores, 'northSouth', [], 'north');
      expect(result.largestWinDiff).toBe(400);
      expect(result.largestLossDiff).toBe(0);
    });

    it('should compute largest loss diff', () => {
      const scores: Record<Team, number> = { northSouth: 600, eastWest: 1100 };
      const result = computeGameStats(scores, 'eastWest', [], 'north');
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
      const result = computeGameStats(scores, 'northSouth', rounds, 'north');
      expect(result.oneTwoWins).toBe(2);
      expect(result.oneTwoAgainst).toBe(1);
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
          tichuResults: {
            north: { call: 'tichu', won: true },
            east: null, south: null, west: null,
          },
        }),
        makeRoundScore({
          tichuResults: {
            north: { call: 'tichu', won: false },
            east: null, south: null, west: null,
          },
        }),
      ];
      const result = computeRoundStats(rounds, 'north');
      expect(result.tichuCalls).toBe(2);
      expect(result.tichuSuccesses).toBe(1);
      expect(result.firstFinishes).toBe(1);
    });

    it('should count grand tichu calls and successes', () => {
      const rounds = [
        makeRoundScore({
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

    // Verifies: REQ-F-GB04
    it('should count partner tichu broken when I won and partner lost', () => {
      const rounds = [
        makeRoundScore({
          tichuResults: {
            north: { call: 'tichu', won: true },
            east: null,
            south: { call: 'tichu', won: false },
            west: null,
          },
        }),
      ];
      const result = computeRoundStats(rounds, 'north');
      expect(result.partnerTichuBroken).toBe(1);
    });

    it('should handle empty round history', () => {
      const result = computeRoundStats([], 'north');
      expect(result.totalRoundsPlayed).toBe(0);
      expect(result.roundsWon).toBe(0);
      expect(result.tichuCalls).toBe(0);
    });

    it('should handle all 4 players calling tichu in one round', () => {
      const rounds = [
        makeRoundScore({
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
      expect(result.partnerTichuBroken).toBe(1); // south failed, north won
    });
  });
});
