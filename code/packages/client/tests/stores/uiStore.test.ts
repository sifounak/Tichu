// Verifies: REQ-F-HV07 — UI store for card selection and client state
import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from '@/stores/uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    useUiStore.setState({
      selectedCardIds: new Set(),
      phoenixPickerOptions: null,
      connectionStatus: 'disconnected',
    });
  });

  describe('card selection', () => {
    it('selectCard adds a card', () => {
      useUiStore.getState().selectCard(5);
      expect(useUiStore.getState().selectedCardIds.has(5)).toBe(true);
    });

    it('deselectCard removes a card', () => {
      useUiStore.getState().selectCard(5);
      useUiStore.getState().deselectCard(5);
      expect(useUiStore.getState().selectedCardIds.has(5)).toBe(false);
    });

    it('toggleCard adds then removes', () => {
      useUiStore.getState().toggleCard(3);
      expect(useUiStore.getState().selectedCardIds.has(3)).toBe(true);
      useUiStore.getState().toggleCard(3);
      expect(useUiStore.getState().selectedCardIds.has(3)).toBe(false);
    });

    it('clearSelection empties the set', () => {
      useUiStore.getState().selectCard(1);
      useUiStore.getState().selectCard(2);
      useUiStore.getState().selectCard(3);
      useUiStore.getState().clearSelection();
      expect(useUiStore.getState().selectedCardIds.size).toBe(0);
    });

    it('multiple cards can be selected', () => {
      useUiStore.getState().selectCard(0);
      useUiStore.getState().selectCard(10);
      useUiStore.getState().selectCard(20);
      expect(useUiStore.getState().selectedCardIds.size).toBe(3);
    });
  });

  describe('phoenix picker', () => {
    it('showPhoenixPicker sets options', () => {
      useUiStore.getState().showPhoenixPicker([5, 6, 7]);
      expect(useUiStore.getState().phoenixPickerOptions).toEqual([5, 6, 7]);
    });

    it('hidePhoenixPicker clears options', () => {
      useUiStore.getState().showPhoenixPicker([5, 6]);
      useUiStore.getState().hidePhoenixPicker();
      expect(useUiStore.getState().phoenixPickerOptions).toBeNull();
    });
  });

  describe('connection status', () => {
    it('setConnectionStatus updates status', () => {
      useUiStore.getState().setConnectionStatus('connected');
      expect(useUiStore.getState().connectionStatus).toBe('connected');
    });
  });

});
