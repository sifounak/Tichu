// REQ-F-HV06: Prevent invalid plays via UI
// REQ-F-HV07: Click-to-select interaction with progressive filtering
// REQ-F-BI09: Off-turn bomb selection and play
'use client';

import { useMemo, useCallback } from 'react';
import type { GameCard, CardId, TrickState, Rank } from '@tichu/shared';
import {
  getSelectableCards,
  resolvePhoenixValues,
  detectCombination,
  canPlayerPass,
  canBeat,
} from '@tichu/shared';
import type { PhoenixResolution } from '@tichu/shared';

export interface CardSelectionState {
  /** Currently selected card IDs */
  selectedIds: Set<CardId>;
  /** Cards that can still be clicked/selected */
  selectableIds: Set<CardId>;
  /** Cards that are disabled (greyed out) */
  disabledIds: Set<CardId>;
  /** Whether the current selection forms a valid playable combination */
  canPlay: boolean;
  /** Whether the player can pass this turn */
  canPass: boolean;
  /** REQ-F-BI09: Whether the current selection is a valid bomb (for off-turn play) */
  isBombSelection: boolean;
  /** Phoenix resolution for the current selection */
  phoenixResolution: PhoenixResolution;
  /** Toggle a card's selection state */
  toggleCard: (id: CardId) => void;
  /** Clear all selections */
  clearSelection: () => void;
}

/**
 * REQ-F-HV06, REQ-F-HV07: Hook that manages card selection with progressive filtering.
 *
 * Uses the shared engine's hand-filter to compute which cards are selectable
 * based on the current selection, trick state, and active wish.
 *
 * REQ-F-BI10: When off-turn, allows selecting bomb-forming combinations only.
 */
export function useCardSelection(
  hand: GameCard[],
  currentTrick: TrickState | null,
  wish: Rank | null,
  selectedIds: Set<CardId>,
  onToggleCard: (id: CardId) => void,
  onClearSelection: () => void,
  isMyTurn: boolean,
): CardSelectionState {
  // Build selected GameCard array from IDs
  const selectedCards = useMemo(
    () => hand.filter((gc) => selectedIds.has(gc.id)),
    [hand, selectedIds],
  );

  // REQ-F-HV01: Progressive filtering — compute selectable cards
  // REQ-F-BI10: Off-turn uses same filtering (bomb prefixes already supported)
  const selectableIds = useMemo(
    () => getSelectableCards(hand, selectedCards, currentTrick, wish),
    [hand, selectedCards, currentTrick, wish],
  );

  // REQ-F-HV09: Disabled cards = in hand but not selected and not selectable
  const disabledIds = useMemo(() => {
    const disabled = new Set<CardId>();
    for (const gc of hand) {
      if (!selectedIds.has(gc.id) && !selectableIds.has(gc.id)) {
        disabled.add(gc.id);
      }
    }
    return disabled;
  }, [hand, selectedIds, selectableIds]);

  // REQ-F-PH06: Phoenix resolution for current selection
  const phoenixResolution = useMemo(
    () => resolvePhoenixValues(selectedCards, currentTrick),
    [selectedCards, currentTrick],
  );

  // REQ-F-BI09: Check if current selection is a bomb that beats the trick top
  const isBombSelection = useMemo(() => {
    if (selectedCards.length < 4) return false;
    const combo = detectCombination(selectedCards);
    if (!combo?.isBomb) return false;
    // Must beat current trick top if there is one
    if (currentTrick && currentTrick.plays.length > 0) {
      const trickTop = currentTrick.plays[currentTrick.plays.length - 1].combination;
      return canBeat(combo, trickTop);
    }
    return false;
  }, [selectedCards, currentTrick]);

  // REQ-F-HV06: canPlay — selection forms a valid combination
  // REQ-F-BI11: Off-turn, only bombs are playable
  const canPlay = useMemo(() => {
    if (selectedCards.length === 0) return false;
    if (phoenixResolution.status === 'choose') return false;
    if (phoenixResolution.status === 'invalid') return false;
    const combo = detectCombination(selectedCards);
    if (combo === null) return false;
    if (!isMyTurn) return combo.isBomb;
    return true;
  }, [selectedCards, phoenixResolution, isMyTurn]);

  // Can player pass?
  const canPass = useMemo(
    () => canPlayerPass(hand, currentTrick, wish),
    [hand, currentTrick, wish],
  );

  // Toggle handler that respects selectability
  const toggleCard = useCallback(
    (id: CardId) => {
      // Allow deselecting any selected card
      if (selectedIds.has(id)) {
        onToggleCard(id);
        return;
      }
      // Only allow selecting if the card is selectable
      if (selectableIds.has(id)) {
        onToggleCard(id);
      }
    },
    [selectedIds, selectableIds, onToggleCard],
  );

  return {
    selectedIds,
    selectableIds,
    disabledIds,
    canPlay,
    canPass,
    isBombSelection,
    phoenixResolution,
    toggleCard,
    clearSelection: onClearSelection,
  };
}
