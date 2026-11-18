// Verifies: REQ-F-UP04–UP06
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CombinationType, DEFAULT_USER_PREFERENCES, Suit, type CardOrder, type CardOverlap, type Combination, type GameCard, type Rank } from '@tichu/shared';
import { CardHand } from '@/components/cards/CardHand';
import { CardRow } from '@/components/cards/CardRow';
import { TrickDisplay, calculateTrickCardLayout } from '@/components/game/TrickDisplay';
import { cardIdentifierSide, cardStackIndex, sortCardsForDisplay, sortCombinationForDisplay } from '@/components/cards/card-utils';
import { usePreferencesStore } from '@/stores/preferencesStore';

const standard = (id: number, rank: Rank, suit = Suit.Jade): GameCard => ({ id, card: { kind: 'standard', rank, suit } });
const modes = (['ascending', 'descending'] as CardOrder[]).flatMap((order) =>
  (['leftOnTop', 'rightOnTop'] as CardOverlap[]).map((overlap) => ({ order, overlap })));
const rankOf = (gc: GameCard, combo: Combination) => gc.card.kind === 'standard' ? gc.card.rank : combo.phoenixUsedAs;

describe('Card preferences', () => {
  beforeEach(() => usePreferencesStore.setState({ preferences: { ...DEFAULT_USER_PREFERENCES } }));
  it('orders special cards and rank/suit ties without mutating input', () => {
    const cards: GameCard[] = [{ id: 0, card: { kind: 'dragon' } }, { id: 1, card: { kind: 'dog' } },
      { id: 2, card: { kind: 'mahjong' } }, { id: 3, card: { kind: 'phoenix' } }, standard(4, 2), standard(5, 14), standard(6, 2, Suit.Sword)];
    const original = [...cards];
    expect(sortCardsForDisplay(cards, 'ascending').map((gc) => gc.id)).toEqual([1, 2, 4, 6, 5, 3, 0]);
    expect(sortCardsForDisplay(cards).map((gc) => gc.id)).toEqual([0, 3, 5, 6, 4, 2, 1]);
    expect(cards).toEqual(original);
  });

  it.each(modes)('keeps full-house triples on top for $order/$overlap, regardless of rank or Phoenix membership', ({ order, overlap }) => {
    for (const tripleRank of [9, 13] as Rank[]) {
      const pairRank = tripleRank === 9 ? 13 : 9;
      for (const phoenixGroup of ['none', 'triple', 'pair']) {
        const cards = [standard(0, tripleRank), standard(1, tripleRank, Suit.Star), standard(2, tripleRank, Suit.Sword), standard(3, pairRank), standard(4, pairRank, Suit.Star)];
        if (phoenixGroup !== 'none') cards[phoenixGroup === 'triple' ? 2 : 4] = { id: 5, card: { kind: 'phoenix' } };
        const combo: Combination = { type: CombinationType.FullHouse, cards, rank: tripleRank, length: 1, isBomb: false,
          ...(phoenixGroup !== 'none' ? { phoenixUsedAs: phoenixGroup === 'triple' ? tripleRank : pairRank } : {}) };
        const sorted = sortCombinationForDisplay(combo, order, overlap);
        const triple = overlap === 'leftOnTop' ? sorted.slice(0, 3) : sorted.slice(2);
        const pair = overlap === 'leftOnTop' ? sorted.slice(3) : sorted.slice(0, 2);
        expect(triple.map((gc) => rankOf(gc, combo))).toEqual([tripleRank, tripleRank, tripleRank]);
        expect(pair.map((gc) => rankOf(gc, combo))).toEqual([pairRank, pairRank]);
        const tripleIndices = triple.map((gc) => cardStackIndex(sorted.indexOf(gc), sorted.length, overlap));
        const pairIndices = pair.map((gc) => cardStackIndex(sorted.indexOf(gc), sorted.length, overlap));
        expect(Math.min(...tripleIndices)).toBeGreaterThan(Math.max(...pairIndices));
        expect(combo.cards).toEqual(cards);
      }
    }
  });

  it.each(['ascending', 'descending'] as CardOrder[])('places Phoenix in its straight and pair-sequence rank for %s', (order) => {
    const phoenix: GameCard = { id: 2, card: { kind: 'phoenix' } };
    const straight: Combination = { type: CombinationType.Straight, cards: [standard(0, 4), phoenix, standard(1, 6)], rank: 6, length: 3, phoenixUsedAs: 5, isBomb: false };
    expect(sortCombinationForDisplay(straight, order).map((gc) => rankOf(gc, straight))).toEqual(order === 'ascending' ? [4, 5, 6] : [6, 5, 4]);
    const sequence: Combination = { type: CombinationType.PairSequence, cards: [standard(0, 4), standard(1, 4, Suit.Star), standard(3, 5), phoenix], rank: 5, length: 2, phoenixUsedAs: 5, isBomb: false };
    const sorted = sortCombinationForDisplay(sequence, order);
    expect(sorted.indexOf(phoenix)).toBe(sorted.findIndex((gc) => gc.id === 3) + 1);
    const triple: Combination = { type: CombinationType.Triple, cards: [standard(0, 4), phoenix, standard(1, 4, Suit.Star)], rank: 4, length: 1, phoenixUsedAs: 4, isBomb: false };
    expect(sortCombinationForDisplay(triple, order)[0]).toBe(phoenix);
  });

  it.each(modes)('renders consistent hand, preview, and trick layout for $order/$overlap', ({ order, overlap }) => {
    usePreferencesStore.setState({ preferences: { ...DEFAULT_USER_PREFERENCES, cardOrder: order, cardOverlap: overlap } });
    const cards = [standard(0, 2), standard(1, 3), standard(2, 4)];
    const combination: Combination = { type: CombinationType.Straight, cards, rank: 4, length: 3, isBomb: false };
    render(<><CardHand cards={cards} selectedIds={new Set([1])} /><CardRow cards={cards} combination={combination} label="Bomb preview" />
      <TrickDisplay trick={{ plays: [{ seat: 'north', combination }], passes: [], leadSeat: 'north', currentWinner: 'north' }} mahjongWish={null} wishFulfilled={false} mySeat="south" /></>);
    for (const group of [screen.getByRole('group', { name: 'Your hand' }), screen.getByRole('img', { name: 'Bomb preview' }), screen.getByLabelText('north played straight')]) {
      const elements = Array.from(group.querySelectorAll<HTMLElement>('[data-card-id]'));
      expect(elements.map((el) => Number(el.dataset.cardId))).toEqual(order === 'ascending' ? [0, 1, 2] : [2, 1, 0]);
      elements.forEach((el, index) => {
        expect(el.dataset.identifierSide).toBe(cardIdentifierSide(overlap));
        expect(el.parentElement?.style.zIndex).toBe(String(cardStackIndex(index, 3, overlap)));
      });
    }
    expect(screen.getByRole('group', { name: 'Your hand' }).querySelector('[data-card-id="1"]')).toHaveAttribute('aria-pressed', 'true');
  });

  it('preserves focused card and selection when saved order changes', () => {
    const cards = [standard(0, 2), standard(1, 3), standard(2, 4)];
    render(<CardHand cards={cards} selectedIds={new Set([1])} />);
    const focused = screen.getByRole('group').querySelector<HTMLButtonElement>('[data-card-id="1"]')!;
    focused.focus();
    act(() => usePreferencesStore.setState({ preferences: { ...DEFAULT_USER_PREFERENCES, cardOrder: 'ascending' } }));
    expect(focused).toHaveFocus();
    expect(focused).toHaveAttribute('aria-pressed', 'true');
  });

  it('caps trick overlap to keep wide identifiers visible and scales large groups to fit', () => {
    for (const containerWidth of [240, 360, 650]) {
      const layout = calculateTrickCardLayout({ cardCount: 14, containerWidth, cardWidth: 105, desiredOverlap: 100 });
      expect(layout.overlapPx).toBeCloseTo(105 * 0.54);
      expect(layout.cardWidthPx * 14 - layout.overlapPx * layout.scale * 13).toBeLessThanOrEqual(containerWidth - 20 + 0.01);
    }
  });
});
