// Verifies: REQ-F-GF01 — Game state types and utility functions

import { describe, it, expect } from 'vitest';
import {
  GamePhase,
  SEATS_IN_ORDER,
  getTeam,
  getPartner,
  getNextSeat,
  DEFAULT_GAME_CONFIG,
} from '../../src/types/game.js';
import type { Seat, Team } from '../../src/types/game.js';

describe('Seat utilities', () => {
  describe('SEATS_IN_ORDER', () => {
    it('has 4 seats in clockwise order', () => {
      expect(SEATS_IN_ORDER).toEqual(['north', 'east', 'south', 'west']);
    });
  });

  describe('getTeam', () => {
    it('maps north and south to northSouth', () => {
      expect(getTeam('north')).toBe('northSouth');
      expect(getTeam('south')).toBe('northSouth');
    });

    it('maps east and west to eastWest', () => {
      expect(getTeam('east')).toBe('eastWest');
      expect(getTeam('west')).toBe('eastWest');
    });
  });

  describe('getPartner', () => {
    it('returns correct partners', () => {
      expect(getPartner('north')).toBe('south');
      expect(getPartner('south')).toBe('north');
      expect(getPartner('east')).toBe('west');
      expect(getPartner('west')).toBe('east');
    });
  });

  describe('getNextSeat', () => {
    it('follows clockwise order', () => {
      expect(getNextSeat('north')).toBe('east');
      expect(getNextSeat('east')).toBe('south');
      expect(getNextSeat('south')).toBe('west');
      expect(getNextSeat('west')).toBe('north');
    });
  });
});

describe('GamePhase enum', () => {
  it('has all expected phases', () => {
    expect(GamePhase.WaitingForPlayers).toBe('waitingForPlayers');
    expect(GamePhase.GrandTichuDecision).toBe('grandTichuDecision');
    expect(GamePhase.CardPassing).toBe('cardPassing');
    expect(GamePhase.Playing).toBe('playing');
    expect(GamePhase.RoundScoring).toBe('roundScoring');
    expect(GamePhase.GameOver).toBe('gameOver');
  });
});

describe('DEFAULT_GAME_CONFIG', () => {
  it('has correct defaults', () => {
    expect(DEFAULT_GAME_CONFIG.targetScore).toBe(1000);
    expect(DEFAULT_GAME_CONFIG.turnTimerSeconds).toBeNull();
    expect(DEFAULT_GAME_CONFIG.botDifficulty).toBe('expert');
    expect(DEFAULT_GAME_CONFIG.spectatorsAllowed).toBe(true);
    expect(DEFAULT_GAME_CONFIG.isPrivate).toBe(false);
  });
});
