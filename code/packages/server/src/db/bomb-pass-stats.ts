// REQ-F-PS02: Canonical pass-stat bombs; gameplay still enumerates all playable subsets.
import { createDeck, detectAllBombs, CombinationType } from '@tichu/shared';

const deck = createDeck();

export function getPassBombs(hand: number[]): number[][] {
  const cards = [...new Set(hand)].map(id => deck[id]).filter(card => card !== undefined);
  const bombs = detectAllBombs(cards);
  return bombs.filter(bomb => bomb.type === CombinationType.FourBomb
    || !bombs.some(other => other.type === CombinationType.StraightFlushBomb
      && other.cards.length > bomb.cards.length
      && bomb.cards.every(card => other.cards.some(candidate => candidate.id === card.id))))
    .map(bomb => bomb.cards.map(card => card.id));
}

export function countBombContributions(hand: number[], passedCards: number[]): number {
  return getPassBombs(hand).filter(bomb => passedCards.some(card => bomb.includes(card))).length;
}

export function getReceivedBombStats(hand: number[], partnerCards: number[], opponentCards: number[]) {
  let partner = 0, opponent = 0, total = 0;
  for (const bomb of getPassBombs(hand)) {
    const fromPartner = partnerCards.some(card => bomb.includes(card));
    const fromOpponent = opponentCards.some(card => bomb.includes(card));
    if (fromPartner) partner++;
    if (fromOpponent) opponent++;
    if (fromPartner || fromOpponent) total++;
  }
  return { partner, opponent, total };
}
