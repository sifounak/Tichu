// Verifies: REQ-NF-A03 — Zod validation on WebSocket messages

import { describe, it, expect } from 'vitest';
import { clientMessageSchema, serverMessageSchema } from '../../src/types/protocol.js';

describe('clientMessageSchema', () => {
  it('validates CREATE_ROOM message', () => {
    const msg = { type: 'CREATE_ROOM', playerName: 'Alice' };
    expect(clientMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates JOIN_ROOM message', () => {
    const msg = { type: 'JOIN_ROOM', roomCode: 'ABCDEF', playerName: 'Bob' };
    expect(clientMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates LEAVE_ROOM message', () => {
    expect(clientMessageSchema.parse({ type: 'LEAVE_ROOM' })).toEqual({ type: 'LEAVE_ROOM' });
  });

  it('validates START_GAME message', () => {
    expect(clientMessageSchema.parse({ type: 'START_GAME' })).toEqual({ type: 'START_GAME' });
  });

  it('validates GRAND_TICHU_DECISION message', () => {
    const msg = { type: 'GRAND_TICHU_DECISION', call: true };
    expect(clientMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates TICHU_DECLARATION message', () => {
    expect(clientMessageSchema.parse({ type: 'TICHU_DECLARATION' })).toEqual({ type: 'TICHU_DECLARATION' });
  });

  it('validates PASS_CARDS message', () => {
    const msg = {
      type: 'PASS_CARDS',
      cards: {
        east: { id: 0, card: { kind: 'standard', suit: 'jade', rank: 5 } },
        south: { id: 1, card: { kind: 'standard', suit: 'star', rank: 10 } },
        west: { id: 52, card: { kind: 'mahjong' } },
      },
    };
    expect(clientMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates PLAY_CARDS message', () => {
    const msg = { type: 'PLAY_CARDS', cardIds: [0, 13, 26] };
    expect(clientMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates PLAY_CARDS with phoenixAs', () => {
    const msg = { type: 'PLAY_CARDS', cardIds: [54, 0], phoenixAs: 5 };
    expect(clientMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates PASS_TURN message', () => {
    expect(clientMessageSchema.parse({ type: 'PASS_TURN' })).toEqual({ type: 'PASS_TURN' });
  });

  it('validates DECLARE_WISH message', () => {
    expect(clientMessageSchema.parse({ type: 'DECLARE_WISH', rank: 8 })).toEqual({ type: 'DECLARE_WISH', rank: 8 });
    expect(clientMessageSchema.parse({ type: 'DECLARE_WISH', rank: null })).toEqual({ type: 'DECLARE_WISH', rank: null });
  });

  it('validates GIFT_DRAGON message', () => {
    expect(clientMessageSchema.parse({ type: 'GIFT_DRAGON', to: 'east' })).toEqual({ type: 'GIFT_DRAGON', to: 'east' });
  });

  // REQ-F-ES04: Vote options changed to wait/kick
  it('validates DISCONNECT_VOTE message', () => {
    expect(clientMessageSchema.parse({ type: 'DISCONNECT_VOTE', vote: 'kick' })).toEqual({ type: 'DISCONNECT_VOTE', vote: 'kick' });
    expect(clientMessageSchema.parse({ type: 'DISCONNECT_VOTE', vote: 'wait' })).toEqual({ type: 'DISCONNECT_VOTE', vote: 'wait' });
  });

  it('validates CHAT_MESSAGE message', () => {
    const msg = { type: 'CHAT_MESSAGE', text: 'Hello!' };
    expect(clientMessageSchema.parse(msg)).toEqual(msg);
  });

  it('rejects invalid message type', () => {
    expect(() => clientMessageSchema.parse({ type: 'INVALID' })).toThrow();
  });

  it('rejects CREATE_ROOM with empty name', () => {
    expect(() => clientMessageSchema.parse({ type: 'CREATE_ROOM', playerName: '' })).toThrow();
  });

  it('rejects JOIN_ROOM with wrong code length', () => {
    expect(() => clientMessageSchema.parse({ type: 'JOIN_ROOM', roomCode: 'ABC', playerName: 'Test' })).toThrow();
  });

  it('rejects PLAY_CARDS with empty card list', () => {
    expect(() => clientMessageSchema.parse({ type: 'PLAY_CARDS', cardIds: [] })).toThrow();
  });

  it('rejects PLAY_CARDS with out-of-range card ID', () => {
    expect(() => clientMessageSchema.parse({ type: 'PLAY_CARDS', cardIds: [56] })).toThrow();
  });

  it('rejects CHAT_MESSAGE with empty text', () => {
    expect(() => clientMessageSchema.parse({ type: 'CHAT_MESSAGE', text: '' })).toThrow();
  });

  // REQ-F-MP04: Room configuration messages
  it('validates CONFIGURE_ROOM message', () => {
    const msg = { type: 'CONFIGURE_ROOM', config: { targetScore: 500, isPrivate: true } };
    expect(clientMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates ADD_BOT message', () => {
    const msg = { type: 'ADD_BOT', seat: 'south' };
    expect(clientMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates ADD_BOT with difficulty', () => {
    const msg = { type: 'ADD_BOT', seat: 'east', difficulty: 'hard' };
    expect(clientMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates REMOVE_BOT message', () => {
    const msg = { type: 'REMOVE_BOT', seat: 'west' };
    expect(clientMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates GET_LOBBY message', () => {
    const msg = { type: 'GET_LOBBY' };
    expect(clientMessageSchema.parse(msg)).toEqual(msg);
  });

  it('rejects CONFIGURE_ROOM with invalid timer value', () => {
    expect(() => clientMessageSchema.parse({
      type: 'CONFIGURE_ROOM',
      config: { turnTimerSeconds: 45 },
    })).toThrow();
  });
});

describe('serverMessageSchema', () => {
  it('validates ROOM_CREATED message', () => {
    const msg = { type: 'ROOM_CREATED', roomCode: 'XYZABC' };
    expect(serverMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates ROOM_JOINED message', () => {
    const msg = { type: 'ROOM_JOINED', roomCode: 'XYZABC', seat: 'north' };
    expect(serverMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates ROOM_UPDATE message', () => {
    const msg = {
      type: 'ROOM_UPDATE',
      roomName: 'Test Room',
      players: [
        { seat: 'north', name: 'Alice', isBot: false, isConnected: true },
        { seat: 'east', name: 'Bot', isBot: true, isConnected: true },
      ],
      hostSeat: 'north',
      config: { targetScore: 1000 },
      gameInProgress: false,
      spectatorCount: 0,
      readyPlayers: [],
    };
    expect(serverMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates ROOM_LEFT message', () => {
    expect(serverMessageSchema.parse({ type: 'ROOM_LEFT' })).toEqual({ type: 'ROOM_LEFT' });
  });

  // REQ-F-MP03: Lobby list message
  it('validates LOBBY_LIST message', () => {
    const msg = {
      type: 'LOBBY_LIST',
      rooms: [
        { roomCode: 'ABC123', roomName: 'Test Room', hostName: 'Alice', playerCount: 2, spectatorCount: 0, config: { targetScore: 1000 }, gameInProgress: false, hasEmptySeats: false },
      ],
    };
    expect(serverMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates GAME_STATE message', () => {
    const msg = { type: 'GAME_STATE', state: { some: 'data' } };
    expect(serverMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates DEAL_FIRST_8 message', () => {
    const cards = Array.from({ length: 8 }, (_, i) => ({ id: i, card: { kind: 'standard', suit: 'jade', rank: (i % 13) + 2 } }));
    const msg = { type: 'DEAL_FIRST_8', cards };
    expect(serverMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates DEAL_REMAINING_6 message', () => {
    const cards = Array.from({ length: 6 }, (_, i) => ({ id: i + 8, card: { kind: 'standard', suit: 'star', rank: (i % 13) + 2 } }));
    const msg = { type: 'DEAL_REMAINING_6', cards };
    expect(serverMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates CARDS_PASSED message', () => {
    const cards = Array.from({ length: 3 }, (_, i) => ({ id: i, card: { kind: 'standard', suit: 'jade', rank: (i % 13) + 2 } }));
    const msg = { type: 'CARDS_PASSED', received: cards };
    expect(serverMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates TICHU_CALLED message', () => {
    expect(serverMessageSchema.parse({ type: 'TICHU_CALLED', seat: 'north', level: 'tichu' })).toBeTruthy();
    expect(serverMessageSchema.parse({ type: 'TICHU_CALLED', seat: 'east', level: 'grandTichu' })).toBeTruthy();
  });

  it('validates CARDS_PLAYED message', () => {
    const msg = { type: 'CARDS_PLAYED', seat: 'south', cardIds: [0, 1], combinationType: 'pair' };
    expect(serverMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates PLAYER_PASSED message', () => {
    expect(serverMessageSchema.parse({ type: 'PLAYER_PASSED', seat: 'west' })).toBeTruthy();
  });

  it('validates TRICK_WON message', () => {
    expect(serverMessageSchema.parse({ type: 'TRICK_WON', seat: 'north' })).toBeTruthy();
  });

  it('validates WISH_DECLARED message', () => {
    expect(serverMessageSchema.parse({ type: 'WISH_DECLARED', rank: 7 })).toBeTruthy();
    expect(serverMessageSchema.parse({ type: 'WISH_DECLARED', rank: null })).toBeTruthy();
  });

  it('validates WISH_FULFILLED message', () => {
    expect(serverMessageSchema.parse({ type: 'WISH_FULFILLED' })).toBeTruthy();
  });

  it('validates DRAGON_GIFT_REQUIRED message', () => {
    expect(serverMessageSchema.parse({ type: 'DRAGON_GIFT_REQUIRED', options: ['east', 'west'] })).toBeTruthy();
  });

  it('validates DRAGON_GIFTED message', () => {
    expect(serverMessageSchema.parse({ type: 'DRAGON_GIFTED', from: 'north', to: 'east' })).toBeTruthy();
  });

  it('validates PLAYER_FINISHED message', () => {
    expect(serverMessageSchema.parse({ type: 'PLAYER_FINISHED', seat: 'north', order: 1 })).toBeTruthy();
  });

  it('validates TURN_CHANGE message', () => {
    expect(serverMessageSchema.parse({ type: 'TURN_CHANGE', seat: 'east' })).toBeTruthy();
  });

  it('validates ROUND_SCORED message', () => {
    const msg = {
      type: 'ROUND_SCORED',
      roundNumber: 1,
      cardPoints: { northSouth: 60, eastWest: 40 },
      tichuBonuses: { northSouth: 100, eastWest: 0 },
      oneTwoBonus: null,
      total: { northSouth: 160, eastWest: 40 },
      cumulativeScores: { northSouth: 160, eastWest: 40 },
    };
    expect(serverMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates GAME_OVER message', () => {
    const msg = { type: 'GAME_OVER', winner: 'northSouth', finalScores: { northSouth: 1020, eastWest: 680 } };
    expect(serverMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates PLAYER_DISCONNECTED message', () => {
    expect(serverMessageSchema.parse({ type: 'PLAYER_DISCONNECTED', seat: 'east' })).toBeTruthy();
  });

  it('validates PLAYER_RECONNECTED message', () => {
    expect(serverMessageSchema.parse({ type: 'PLAYER_RECONNECTED', seat: 'east' })).toBeTruthy();
  });

  // REQ-F-ES04/ES17: Multi-disconnect support
  it('validates DISCONNECT_VOTE_REQUIRED message', () => {
    expect(serverMessageSchema.parse({ type: 'DISCONNECT_VOTE_REQUIRED', disconnectedSeats: ['west'] })).toBeTruthy();
    expect(serverMessageSchema.parse({ type: 'DISCONNECT_VOTE_REQUIRED', disconnectedSeats: ['north', 'east'] })).toBeTruthy();
  });

  // REQ-F-ES04: Vote status broadcast
  it('validates DISCONNECT_VOTE_UPDATE message', () => {
    expect(serverMessageSchema.parse({
      type: 'DISCONNECT_VOTE_UPDATE',
      votes: { north: null, east: 'wait', south: 'kick', west: null },
      disconnectedSeats: ['north'],
      timeoutMs: 45000,
    })).toBeTruthy();
  });

  it('validates CHAT_RECEIVED message', () => {
    expect(serverMessageSchema.parse({ type: 'CHAT_RECEIVED', from: 'north', text: 'Hello' })).toBeTruthy();
  });

  it('validates ERROR message', () => {
    const msg = { type: 'ERROR', code: 'INVALID_PLAY', message: 'Not your turn' };
    expect(serverMessageSchema.parse(msg)).toEqual(msg);
  });

  it('rejects invalid message type', () => {
    expect(() => serverMessageSchema.parse({ type: 'NOT_REAL' })).toThrow();
  });
});
