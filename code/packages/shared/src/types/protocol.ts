// REQ-NF-A03: All WebSocket messages validated with Zod schemas

import { z } from 'zod';

// --- Zod schemas for validation ---

// REQ-F-C01: Card schemas
const suitSchema = z.enum(['jade', 'pagoda', 'star', 'sword']);
const rankSchema = z.union([
  z.literal(2), z.literal(3), z.literal(4), z.literal(5),
  z.literal(6), z.literal(7), z.literal(8), z.literal(9),
  z.literal(10), z.literal(11), z.literal(12), z.literal(13), z.literal(14),
]);
const standardCardSchema = z.object({ kind: z.literal('standard'), suit: suitSchema, rank: rankSchema });
const dragonCardSchema = z.object({ kind: z.literal('dragon') });
const phoenixCardSchema = z.object({ kind: z.literal('phoenix') });
const mahjongCardSchema = z.object({ kind: z.literal('mahjong') });
const dogCardSchema = z.object({ kind: z.literal('dog') });
const cardSchema = z.discriminatedUnion('kind', [
  standardCardSchema, dragonCardSchema, phoenixCardSchema, mahjongCardSchema, dogCardSchema,
]);
const gameCardSchema = z.object({ id: z.number().int().min(0).max(55), card: cardSchema });

const seatSchema = z.enum(['north', 'east', 'south', 'west']);

// --- Client → Server messages ---

export const clientMessageSchema = z.discriminatedUnion('type', [
  // Room actions
  z.object({ type: z.literal('CREATE_ROOM'), playerName: z.string().min(1).max(30) }),
  z.object({ type: z.literal('JOIN_ROOM'), roomCode: z.string().length(6), playerName: z.string().min(1).max(30) }),
  z.object({ type: z.literal('LEAVE_ROOM') }),
  // REQ-F-MP04: Room configuration
  z.object({ type: z.literal('CONFIGURE_ROOM'), config: z.object({
    targetScore: z.number().int().min(100).max(10000).optional(),
    turnTimerSeconds: z.union([z.literal(null), z.literal(30), z.literal(60), z.literal(90)]).optional(),
    botDifficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    animationSpeed: z.enum(['slow', 'normal', 'fast', 'off']).optional(),
    spectatorsAllowed: z.boolean().optional(),
    isPrivate: z.boolean().optional(),
  }) }),
  z.object({ type: z.literal('ADD_BOT'), seat: seatSchema, difficulty: z.enum(['easy', 'medium', 'hard']).optional() }),
  z.object({ type: z.literal('REMOVE_BOT'), seat: seatSchema }),
  z.object({ type: z.literal('GET_LOBBY') }),
  z.object({ type: z.literal('START_GAME') }),
  // REQ-F-006: Seat swap
  z.object({ type: z.literal('SWAP_SEATS'), targetSeat: seatSchema }),

  // Game actions
  z.object({ type: z.literal('GRAND_TICHU_DECISION'), call: z.boolean() }),
  z.object({ type: z.literal('TICHU_DECLARATION') }),
  // REQ-F-RTP01: Regular Tichu pass (skip without calling)
  z.object({ type: z.literal('REGULAR_TICHU_PASS') }),
  z.object({ type: z.literal('PASS_CARDS'), cards: z.record(seatSchema, gameCardSchema) }),
  z.object({ type: z.literal('CANCEL_PASS_CARDS') }),
  z.object({ type: z.literal('PLAY_CARDS'), cardIds: z.array(z.number().int().min(0).max(55)).min(1), phoenixAs: rankSchema.optional() }),
  z.object({ type: z.literal('PASS_TURN') }),
  z.object({ type: z.literal('DECLARE_WISH'), rank: rankSchema.nullable() }),
  z.object({ type: z.literal('GIFT_DRAGON'), to: seatSchema }),

  // Disconnect vote
  z.object({ type: z.literal('DISCONNECT_VOTE'), vote: z.enum(['wait', 'bot', 'abandon']) }),

  // Chat
  z.object({ type: z.literal('CHAT_MESSAGE'), text: z.string().min(1).max(500) }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

// --- Server → Client messages ---

export const serverMessageSchema = z.discriminatedUnion('type', [
  // Room events
  z.object({ type: z.literal('ROOM_CREATED'), roomCode: z.string() }),
  z.object({ type: z.literal('ROOM_JOINED'), roomCode: z.string(), seat: seatSchema }),
  z.object({ type: z.literal('ROOM_UPDATE'), players: z.array(z.object({ seat: seatSchema, name: z.string(), isBot: z.boolean(), isConnected: z.boolean() })), hostSeat: seatSchema, config: z.any(), gameInProgress: z.boolean() }),
  z.object({ type: z.literal('ROOM_LEFT') }),
  z.object({ type: z.literal('LOBBY_LIST'), rooms: z.array(z.object({ roomCode: z.string(), hostName: z.string(), playerCount: z.number(), spectatorCount: z.number(), config: z.any(), gameInProgress: z.boolean() })) }),

  // Game state
  z.object({ type: z.literal('GAME_STATE'), state: z.any() }), // Full ClientGameView; validated separately
  z.object({ type: z.literal('DEAL_FIRST_8'), cards: z.array(gameCardSchema).length(8) }),
  z.object({ type: z.literal('DEAL_REMAINING_6'), cards: z.array(gameCardSchema).length(6) }),
  z.object({ type: z.literal('CARDS_PASSED'), received: z.array(gameCardSchema).length(3) }),

  // Game events
  z.object({ type: z.literal('TICHU_CALLED'), seat: seatSchema, level: z.enum(['tichu', 'grandTichu']) }),
  z.object({ type: z.literal('CARDS_PLAYED'), seat: seatSchema, cardIds: z.array(z.number()), combinationType: z.string() }),
  z.object({ type: z.literal('PLAYER_PASSED'), seat: seatSchema }),
  z.object({ type: z.literal('TRICK_WON'), seat: seatSchema }),
  z.object({ type: z.literal('WISH_DECLARED'), rank: rankSchema.nullable() }),
  z.object({ type: z.literal('WISH_FULFILLED') }),
  z.object({ type: z.literal('DRAGON_GIFT_REQUIRED'), options: z.array(seatSchema) }),
  z.object({ type: z.literal('DRAGON_GIFTED'), from: seatSchema, to: seatSchema }),
  z.object({ type: z.literal('PLAYER_FINISHED'), seat: seatSchema, order: z.number().int().min(1).max(4) }),
  z.object({ type: z.literal('TURN_CHANGE'), seat: seatSchema }),

  // Scoring & lifecycle
  z.object({
    type: z.literal('ROUND_SCORED'),
    roundNumber: z.number().int(),
    cardPoints: z.record(z.number()),
    tichuBonuses: z.record(z.number()),
    oneTwoBonus: z.string().nullable(),
    total: z.record(z.number()),
    cumulativeScores: z.record(z.number()),
  }),
  z.object({ type: z.literal('GAME_OVER'), winner: z.string(), finalScores: z.record(z.number()) }),

  // Disconnect handling
  z.object({ type: z.literal('PLAYER_DISCONNECTED'), seat: seatSchema }),
  z.object({ type: z.literal('PLAYER_RECONNECTED'), seat: seatSchema }),
  z.object({ type: z.literal('DISCONNECT_VOTE_REQUIRED'), disconnectedSeat: seatSchema }),

  // Chat
  z.object({ type: z.literal('CHAT_RECEIVED'), from: seatSchema, text: z.string() }),

  // Error
  z.object({ type: z.literal('ERROR'), code: z.string(), message: z.string() }),
]);

export type ServerMessage = z.infer<typeof serverMessageSchema>;
