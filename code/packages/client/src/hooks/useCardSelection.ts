// REQ-F-HV06: Prevent invalid plays via UI
// REQ-F-HV07: Click-to-select interaction with progressive filtering
'use client';

import { useMemo, useCallback } from 'react';
import type { GameCard, CardId, TrickState, Rank } from '@tichu/shared';
import {
  getSelectableCards,
  resolvePhoenixValues,
  detectCombination,
  canPlayerPass,
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
 */
export function useCardSelection(
  hand: GameCard[],
  currentTrick: TrickState | null,
  wish: Rank | null,
  selectedIds: Set<CardId>,
  onToggleCard: (id: CardId) => void,
  onClearSelection: () => void,
): CardSelectionState {
  // Build selected GameCard array from IDs
  const selectedCards = useMemo(
    () => hand.filter((gc) => selectedIds.has(gc.id)),
    [hand, selectedIds],
  );

  // REQ-F-HV01: Progressive filtering — compute selectable cards
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

  // REQ-F-HV06: canPlay — selection forms a valid combination
  const canPlay = useMemo(() => {
    if (selectedCards.length === 0) return false;
    // If Phoenix needs user choice, can't play yet
    if (phoenixResolution.status === 'choose') return false;
    if (phoenixResolution.status === 'invalid') return false;
    const combo = detectCombination(selectedCards);
    return combo !== null;
  }, [selectedCards, phoenixResolution]);

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
    phoenixResolution,
    toggleCard,
    clearSelection: onClearSelection,
  };
}
