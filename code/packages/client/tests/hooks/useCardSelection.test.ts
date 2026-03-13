// Verifies: REQ-F-HV06, REQ-F-HV07, REQ-F-HV09
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCardSelection } from '../../src/hooks/useCardSelection';
import type { GameCard, TrickState, Rank, CardId } from '@tichu/shared';
import { CombinationType } from '@tichu/shared';

// Helper to make standard cards
function makeCard(id: number, rank: Rank, suit = 'jade'): GameCard {
  return { id: id as CardId, card: { kind: 'standard', suit: suit as 'jade', rank } };
}
function makePhoenix(id = 52): GameCard {
  return { id: id as CardId, card: { kind: 'phoenix' } };
}
function makeDragon(id = 53): GameCard {
  return { id: id as CardId, card: { kind: 'dragon' } };
}
function makeDog(id = 54): GameCard {
  return { id: id as CardId, card: { kind: 'dog' } };
}
function makeMahjong(id = 55): GameCard {
  return { id: id as CardId, card: { kind: 'mahjong' } };
}

describe('useCardSelection', () => {
  const emptySet = new Set<CardId>();
  const noopToggle = vi.fn();
  const noopClear = vi.fn();

  it('returns all cards selectable when nothing selected and leading', () => {
    const hand = [makeCard(0, 5), makeCard(1, 7), makeCard(2, 10)];
    const { result } = renderHook(() =>
      useCardSelection(hand, null, null, emptySet, noopToggle, noopClear, true),
    );

    expect(result.current.selectableIds.size).toBe(3);
    expect(result.current.disabledIds.size).toBe(0);
    expect(result.current.canPlay).toBe(false);
    expect(result.current.canPass).toBe(false); // leading — can't pass
  });

  it('computes disabled cards when some are selected', () => {
    const hand = [makeCard(0, 5), makeCard(1, 5), makeCard(2, 10), makeCard(3, 14)];
    const selected = new Set([0 as CardId]);

    const { result } = renderHook(() =>
      useCardSelection(hand, null, null, selected, noopToggle, noopClear, true),
    );

    // With rank 5 selected (leading), other 5 selectable (pair prefix)
    expect(result.current.selectableIds.has(1 as CardId)).toBe(true);
    // 10 and 14 also selectable as they can form straight prefixes with 5
    // So disabled set may be empty when leading — that's correct
    expect(result.current.selectableIds.size).toBeGreaterThanOrEqual(1);
  });

  it('REQ-F-HV06: canPlay is true when a valid combination is selected', () => {
    const hand = [makeCard(0, 5), makeCard(1, 5), makeCard(2, 10)];
    const selected = new Set([0, 1] as CardId[]);

    const { result } = renderHook(() =>
      useCardSelection(hand, null, null, selected, noopToggle, noopClear, true),
    );

    expect(result.current.canPlay).toBe(true); // pair of 5s
  });

  it('canPlay is false when Phoenix needs choice', () => {
    // 2+2 full house scenario: two pairs, Phoenix makes one triple
    const hand = [
      makeCard(0, 5), makeCard(1, 5),
      makeCard(2, 8), makeCard(3, 8),
      makePhoenix(),
    ];
    const selected = new Set([0, 1, 2, 3, 52] as CardId[]);

    const { result } = renderHook(() =>
      useCardSelection(hand, null, null, selected, noopToggle, noopClear, true),
    );

    // Phoenix resolution should be 'choose' (which rank to make triple)
    expect(result.current.phoenixResolution.status).toBe('choose');
    expect(result.current.canPlay).toBe(false);
  });

  it('REQ-F-HV07: toggleCard respects selectability', () => {
    const mockToggle = vi.fn();
    const hand = [makeDragon(), makeCard(0, 5)];
    // Dragon selected — all others disabled
    const selected = new Set([53 as CardId]);

    const { result } = renderHook(() =>
      useCardSelection(hand, null, null, selected, mockToggle, noopClear, true),
    );

    // Try to select card 0 — should be blocked (Dragon disables all)
    act(() => result.current.toggleCard(0 as CardId));
    expect(mockToggle).not.toHaveBeenCalled();

    // Deselecting Dragon should work
    act(() => result.current.toggleCard(53 as CardId));
    expect(mockToggle).toHaveBeenCalledWith(53);
  });

  it('canPass is true when following a trick', () => {
    const hand = [makeCard(0, 5)];
    const trick: TrickState = {
      plays: [{ seat: 'north', combination: { type: CombinationType.Single, cards: [makeCard(10, 14)], rank: 14, length: 1, isBomb: false } }],
      passes: [],
      leadSeat: 'north',
      currentWinner: 'north',
    };

    const { result } = renderHook(() =>
      useCardSelection(hand, trick, null, emptySet, noopToggle, noopClear, true),
    );

    expect(result.current.canPass).toBe(true);
  });

  it('canPass is false when leading', () => {
    const hand = [makeCard(0, 5)];

    const { result } = renderHook(() =>
      useCardSelection(hand, null, null, emptySet, noopToggle, noopClear, true),
    );

    expect(result.current.canPass).toBe(false);
  });

  it('REQ-F-HV09: disabled cards have correct IDs', () => {
    // Hand with 5, 5, 10 — selecting 10 makes 5s disabled (can't form combo)
    const hand = [makeCard(0, 5), makeCard(1, 5), makeCard(2, 10)];
    const trick: TrickState = {
      plays: [{ seat: 'north', combination: { type: CombinationType.Single, cards: [makeCard(10, 14)], rank: 14, length: 1, isBomb: false } }],
      passes: [],
      leadSeat: 'north',
      currentWinner: 'north',
    };
    const selected = new Set([2 as CardId]); // 10 selected

    const { result } = renderHook(() =>
      useCardSelection(hand, trick, null, selected, noopToggle, noopClear, true),
    );

    // Nothing can beat Ace when you have 10 selected — both 5s disabled
    for (const gc of hand) {
      if (gc.id !== 2) {
        expect(result.current.disabledIds.has(gc.id)).toBe(true);
      }
    }
  });

  it('phoenixResolution returns not_present when no Phoenix selected', () => {
    const hand = [makeCard(0, 5), makeCard(1, 7)];
    const selected = new Set([0 as CardId]);

    const { result } = renderHook(() =>
      useCardSelection(hand, null, null, selected, noopToggle, noopClear, true),
    );

    expect(result.current.phoenixResolution.status).toBe('not_present');
  });

  it('phoenixResolution auto-resolves for pair', () => {
    const hand = [makeCard(0, 5), makePhoenix()];
    const selected = new Set([0, 52] as CardId[]);

    const { result } = renderHook(() =>
      useCardSelection(hand, null, null, selected, noopToggle, noopClear, true),
    );

    expect(result.current.phoenixResolution.status).toBe('auto');
    if (result.current.phoenixResolution.status === 'auto') {
      expect(result.current.phoenixResolution.value).toBe(5);
    }
  });

  it('clearSelection delegates to onClearSelection', () => {
    const mockClear = vi.fn();
    const hand = [makeCard(0, 5)];

    const { result } = renderHook(() =>
      useCardSelection(hand, null, null, emptySet, noopToggle, mockClear, true),
    );

    act(() => result.current.clearSelection());
    expect(mockClear).toHaveBeenCalled();
  });

  it('REQ-F-HV03: Dog disabled when trick is active', () => {
    const hand = [makeDog(), makeCard(0, 5)];
    const trick: TrickState = {
      plays: [{ seat: 'north', combination: { type: CombinationType.Single, cards: [makeCard(10, 3)], rank: 3, length: 1, isBomb: false } }],
      passes: [],
      leadSeat: 'north',
      currentWinner: 'north',
    };

    const { result } = renderHook(() =>
      useCardSelection(hand, trick, null, emptySet, noopToggle, noopClear, true),
    );

    expect(result.current.selectableIds.has(54 as CardId)).toBe(false);
    expect(result.current.disabledIds.has(54 as CardId)).toBe(true);
  });
});
