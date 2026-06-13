import { GamePhase } from '@tichu/shared';

type NullablePhase = GamePhase | null;

export function shouldResetPassStateForPhaseTransition(
  previousPhase: NullablePhase,
  currentPhase: NullablePhase,
): boolean {
  if (previousPhase === null || currentPhase === null) {
    return false;
  }

  if (
    currentPhase === GamePhase.GrandTichuDecision &&
    previousPhase === GamePhase.BlindGrandTichuDecision
  ) {
    return false;
  }

  if (
    currentPhase === GamePhase.CardPassing ||
    currentPhase === GamePhase.Playing
  ) {
    return false;
  }

  return true;
}
