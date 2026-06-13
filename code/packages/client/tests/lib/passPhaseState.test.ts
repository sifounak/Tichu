import { describe, expect, it } from 'vitest';
import { GamePhase } from '@tichu/shared';
import { shouldResetPassStateForPhaseTransition } from '@/lib/passPhaseState';

describe('shouldResetPassStateForPhaseTransition', () => {
  it('does not reset while the initial game phase is still unknown', () => {
    expect(shouldResetPassStateForPhaseTransition(null, null)).toBe(false);
    expect(shouldResetPassStateForPhaseTransition(null, GamePhase.GrandTichuDecision)).toBe(false);
    expect(shouldResetPassStateForPhaseTransition(GamePhase.Playing, null)).toBe(false);
  });

  it('preserves pass selections when blind grand decisions advance to grand tichu decisions', () => {
    expect(
      shouldResetPassStateForPhaseTransition(
        GamePhase.BlindGrandTichuDecision,
        GamePhase.GrandTichuDecision,
      ),
    ).toBe(false);
  });

  it('preserves pass selections when decision broadcasts keep the same phase', () => {
    expect(
      shouldResetPassStateForPhaseTransition(
        GamePhase.BlindGrandTichuDecision,
        GamePhase.BlindGrandTichuDecision,
      ),
    ).toBe(false);
    expect(
      shouldResetPassStateForPhaseTransition(
        GamePhase.GrandTichuDecision,
        GamePhase.GrandTichuDecision,
      ),
    ).toBe(false);
  });

  it('preserves pass selections when grand tichu decisions advance to card passing', () => {
    expect(
      shouldResetPassStateForPhaseTransition(
        GamePhase.GrandTichuDecision,
        GamePhase.CardPassing,
      ),
    ).toBe(false);
  });

  it('resets pass selections when a new or restarted round enters a decision phase', () => {
    expect(
      shouldResetPassStateForPhaseTransition(
        GamePhase.CardPassing,
        GamePhase.BlindGrandTichuDecision,
      ),
    ).toBe(true);
    expect(
      shouldResetPassStateForPhaseTransition(
        GamePhase.Playing,
        GamePhase.GrandTichuDecision,
      ),
    ).toBe(true);
    expect(
      shouldResetPassStateForPhaseTransition(
        GamePhase.GrandTichuDecision,
        GamePhase.BlindGrandTichuDecision,
      ),
    ).toBe(true);
  });

  it('resets pass selections after leaving the pass flow', () => {
    expect(
      shouldResetPassStateForPhaseTransition(
        GamePhase.Playing,
        GamePhase.RoundScoring,
      ),
    ).toBe(true);
  });
});
