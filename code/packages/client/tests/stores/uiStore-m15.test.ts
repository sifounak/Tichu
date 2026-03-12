// Verifies: REQ-F-MP07 — Chat state in UI store
// Verifies: REQ-F-MP08 — Disconnect state in UI store
// Verifies: REQ-NF-U02 — Tichu banner event state
import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from '@/stores/uiStore';

describe('uiStore — M15 features', () => {
  beforeEach(() => {
    useUiStore.setState({
      chatOpen: false,
      chatMessages: [],
      chatUnread: 0,
      disconnectedSeat: null,
      disconnectVoteRequired: false,
      disconnectCountdown: 0,
      reconnectedSeat: null,
      tichuEvent: null,
    });
  });

  describe('chat (REQ-F-MP07)', () => {
    it('toggleChat opens and clears unread', () => {
      useUiStore.getState().addChatMessage({ from: 'north', text: 'hi', timestamp: 1 });
      expect(useUiStore.getState().chatUnread).toBe(1);
      useUiStore.getState().toggleChat();
      expect(useUiStore.getState().chatOpen).toBe(true);
      expect(useUiStore.getState().chatUnread).toBe(0);
    });

    it('addChatMessage appends and increments unread when closed', () => {
      useUiStore.getState().addChatMessage({ from: 'east', text: 'hello', timestamp: 1 });
      useUiStore.getState().addChatMessage({ from: 'west', text: 'hey', timestamp: 2 });
      expect(useUiStore.getState().chatMessages).toHaveLength(2);
      expect(useUiStore.getState().chatUnread).toBe(2);
    });

    it('addChatMessage does not increment unread when chat is open', () => {
      useUiStore.getState().toggleChat(); // open
      useUiStore.getState().addChatMessage({ from: 'south', text: 'msg', timestamp: 1 });
      expect(useUiStore.getState().chatUnread).toBe(0);
    });

    it('toggleChat closes when already open', () => {
      useUiStore.getState().toggleChat(); // open
      useUiStore.getState().toggleChat(); // close
      expect(useUiStore.getState().chatOpen).toBe(false);
    });
  });

  describe('disconnect (REQ-F-MP08)', () => {
    it('setDisconnected stores the seat', () => {
      useUiStore.getState().setDisconnected('north');
      expect(useUiStore.getState().disconnectedSeat).toBe('north');
    });

    it('setDisconnectVoteRequired enables voting', () => {
      useUiStore.getState().setDisconnected('east');
      useUiStore.getState().setDisconnectVoteRequired(true);
      expect(useUiStore.getState().disconnectVoteRequired).toBe(true);
    });

    it('setDisconnectCountdown updates countdown', () => {
      useUiStore.getState().setDisconnectCountdown(30);
      expect(useUiStore.getState().disconnectCountdown).toBe(30);
    });

    it('setReconnected clears disconnect state', () => {
      useUiStore.getState().setDisconnected('west');
      useUiStore.getState().setDisconnectVoteRequired(true);
      useUiStore.getState().setReconnected('west');
      expect(useUiStore.getState().disconnectedSeat).toBeNull();
      expect(useUiStore.getState().disconnectVoteRequired).toBe(false);
      expect(useUiStore.getState().reconnectedSeat).toBe('west');
    });
  });

  describe('tichu banner (REQ-NF-U02)', () => {
    it('setTichuEvent stores the event', () => {
      useUiStore.getState().setTichuEvent({ seat: 'north', level: 'tichu' });
      expect(useUiStore.getState().tichuEvent).toEqual({ seat: 'north', level: 'tichu' });
    });

    it('setTichuEvent can clear the event', () => {
      useUiStore.getState().setTichuEvent({ seat: 'east', level: 'grandTichu' });
      useUiStore.getState().setTichuEvent(null);
      expect(useUiStore.getState().tichuEvent).toBeNull();
    });
  });
});
