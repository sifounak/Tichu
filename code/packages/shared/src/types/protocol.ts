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

// REQ-F-CG06: Shared room config schema (reused by CREATE_ROOM and CONFIGURE_ROOM)
const roomConfigSchema = z.object({
  targetScore: z.number().int().min(100).max(10000).optional(),
  turnTimerSeconds: z.union([z.literal(null), z.literal(30), z.literal(60), z.literal(90)]).optional(),
  botDifficulty: z.enum(['regular', 'hard', 'expert']).optional(),
  animationSpeed: z.enum(['slow', 'normal', 'fast', 'off']).optional(),
  spectatorsAllowed: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  // Room actions
  // REQ-F-CG06: CREATE_ROOM accepts optional config payload
  z.object({ type: z.literal('CREATE_ROOM'), playerName: z.string().min(1).max(30), roomName: z.string().max(30).optional(), config: roomConfigSchema.optional() }),
  // REQ-F-SP04: JOIN_ROOM supports optional asSpectator flag
  z.object({ type: z.literal('JOIN_ROOM'), roomCode: z.string().length(6), playerName: z.string().min(1).max(30), asSpectator: z.boolean().optional() }),
  z.object({ type: z.literal('LEAVE_ROOM') }),
  // REQ-F-MP04: Room configuration
  z.object({ type: z.literal('CONFIGURE_ROOM'), config: roomConfigSchema }),
  z.object({ type: z.literal('ADD_BOT'), seat: seatSchema, difficulty: z.enum(['regular', 'hard', 'expert']).optional() }),
  z.object({ type: z.literal('REMOVE_BOT'), seat: seatSchema }),
  z.object({ type: z.literal('GET_LOBBY') }),
  z.object({ type: z.literal('START_GAME') }),
  // REQ-F-006: Seat swap
  z.object({ type: z.literal('SWAP_SEATS'), targetSeat: seatSchema }),
  z.object({ type: z.literal('KICK_PLAYER'), seat: seatSchema }),

  // REQ-F-SP18: Ready-to-start system (replaces host-only start)
  z.object({ type: z.literal('READY_TO_START') }),
  z.object({ type: z.literal('CANCEL_READY') }),

  // REQ-F-ES06: Spectator seat queue responses (seat optional for multi-vacancy picking)
  z.object({ type: z.literal('CLAIM_SEAT'), seat: seatSchema.optional() }),
  z.object({ type: z.literal('DECLINE_SEAT') }),

  // Game actions
  z.object({ type: z.literal('GRAND_TICHU_DECISION'), call: z.boolean() }),
  z.object({ type: z.literal('TICHU_DECLARATION') }),
  // REQ-F-RTP01: Regular Tichu pass (skip without calling)
  z.object({ type: z.literal('REGULAR_TICHU_PASS') }),
  z.object({ type: z.literal('PASS_CARDS'), cards: z.record(seatSchema, gameCardSchema) }),
  z.object({ type: z.literal('CANCEL_PASS_CARDS') }),
  z.object({ type: z.literal('PLAY_CARDS'), cardIds: z.array(z.number().int().min(0).max(55)).min(1), phoenixAs: rankSchema.optional(), wish: rankSchema.nullable().optional() }),
  z.object({ type: z.literal('PASS_TURN') }),
  z.object({ type: z.literal('DECLARE_WISH'), rank: rankSchema.nullable() }),
  z.object({ type: z.literal('GIFT_DRAGON'), to: seatSchema }),

  // Mid-game seat choice (when joining with 2+ vacated seats)
  z.object({ type: z.literal('CHOOSE_SEAT'), seat: seatSchema }),

  // REQ-F-ES04: Disconnect vote (Wait to keep seat reserved, Kick to vacate)
  z.object({ type: z.literal('DISCONNECT_VOTE'), vote: z.enum(['wait', 'kick']) }),

  // Chat
  z.object({ type: z.literal('CHAT_MESSAGE'), text: z.string().min(1).max(500) }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

// --- Server → Client messages ---

export const serverMessageSchema = z.discriminatedUnion('type', [
  // Room events
  z.object({ type: z.literal('ROOM_CREATED'), roomCode: z.string() }),
  // REQ-F-SP04: seat is nullable — null indicates spectator
  z.object({ type: z.literal('ROOM_JOINED'), roomCode: z.string(), seat: seatSchema.nullable() }),
  // REQ-F-SP16: ROOM_UPDATE includes spectatorCount and readyPlayers
  z.object({ type: z.literal('ROOM_UPDATE'), roomName: z.string(), players: z.array(z.object({ seat: seatSchema, name: z.string(), isBot: z.boolean(), isConnected: z.boolean() })), hostSeat: seatSchema, config: z.any(), gameInProgress: z.boolean(), spectatorCount: z.number().int().min(0), readyPlayers: z.array(seatSchema) }),
  z.object({ type: z.literal('ROOM_LEFT') }),
  z.object({ type: z.literal('KICKED'), message: z.string() }),
  // REQ-F-ES05: LOBBY_LIST includes hasEmptySeats for "Join (In Progress)" button
  z.object({ type: z.literal('LOBBY_LIST'), rooms: z.array(z.object({ roomCode: z.string(), roomName: z.string(), hostName: z.string(), playerCount: z.number(), spectatorCount: z.number(), config: z.any(), gameInProgress: z.boolean(), hasEmptySeats: z.boolean() })) }),

  // REQ-F-ES06: Seat offered to deciding spectator (FIFO priority, array for multi-vacancy)
  z.object({ type: z.literal('SEAT_OFFERED'), seats: z.array(seatSchema), timeoutMs: z.number() }),
  // REQ-F-SP08b: Queue status for non-deciding spectators
  z.object({ type: z.literal('QUEUE_STATUS'), decidingSpectator: z.string(), position: z.number().int().min(1), timeoutMs: z.number() }),
  // REQ-F-SP08c: All spectators declined — seats up for grabs
  z.object({ type: z.literal('SEATS_AVAILABLE'), seats: z.array(seatSchema) }),
  // REQ-F-SP15: Room closed while spectator connected
  z.object({ type: z.literal('ROOM_CLOSED'), message: z.string() }),

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

  // REQ-F-ES04: Disconnect handling (multi-disconnect support)
  z.object({ type: z.literal('PLAYER_DISCONNECTED'), seat: seatSchema }),
  z.object({ type: z.literal('PLAYER_RECONNECTED'), seat: seatSchema }),
  z.object({ type: z.literal('DISCONNECT_VOTE_REQUIRED'), disconnectedSeats: z.array(seatSchema) }),
  // REQ-F-ES04: Per-seat vote status broadcast for vote UI on player info boxes
  z.object({ type: z.literal('DISCONNECT_VOTE_UPDATE'), votes: z.record(seatSchema, z.enum(['wait', 'kick']).nullable()), disconnectedSeats: z.array(seatSchema), timeoutMs: z.number() }),

  // Chat
  z.object({ type: z.literal('CHAT_RECEIVED'), from: seatSchema, text: z.string() }),

  // Error
  z.object({ type: z.literal('ERROR'), code: z.string(), message: z.string() }),
]);

export type ServerMessage = z.infer<typeof serverMessageSchema>;
