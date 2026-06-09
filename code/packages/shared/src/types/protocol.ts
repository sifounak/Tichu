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
  spectatorsAllowed: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  spectatorChatEnabled: z.boolean().optional(),
});

// REQ-F-RAD01: Optional messageId for reliable action delivery (ACK/retry support)
const messageIdField = { messageId: z.string().optional() };

export const clientMessageSchema = z.discriminatedUnion('type', [
  // Room actions
  // REQ-F-CG06: CREATE_ROOM accepts optional config payload
  z.object({ type: z.literal('CREATE_ROOM'), playerName: z.string().min(1).max(30), roomName: z.string().max(30).optional(), config: roomConfigSchema.optional(), ...messageIdField }),
  // REQ-F-SP04: JOIN_ROOM supports optional asSpectator flag
  z.object({ type: z.literal('JOIN_ROOM'), roomCode: z.string().length(6), playerName: z.string().min(1).max(30), asSpectator: z.boolean().optional(), ...messageIdField }),
  z.object({ type: z.literal('LEAVE_ROOM'), ...messageIdField }),
  // REQ-F-MP04: Room configuration
  z.object({ type: z.literal('CONFIGURE_ROOM'), config: roomConfigSchema, ...messageIdField }),
  z.object({ type: z.literal('ADD_BOT'), seat: seatSchema, ...messageIdField }),
  z.object({ type: z.literal('REMOVE_BOT'), seat: seatSchema, ...messageIdField }),
  z.object({ type: z.literal('GET_LOBBY'), ...messageIdField }),
  z.object({ type: z.literal('START_GAME'), ...messageIdField }),
  // REQ-F-006: Seat swap
  z.object({ type: z.literal('SWAP_SEATS'), targetSeat: seatSchema, ...messageIdField }),
  z.object({ type: z.literal('KICK_PLAYER'), seat: seatSchema, ...messageIdField }),

  // REQ-F-SP18: Ready-to-start system (replaces host-only start)
  z.object({ type: z.literal('READY_TO_START'), ...messageIdField }),
  z.object({ type: z.literal('CANCEL_READY'), ...messageIdField }),

  // REQ-F-ES06: Spectator seat queue responses (seat optional for multi-vacancy picking)
  z.object({ type: z.literal('CLAIM_SEAT'), seat: seatSchema.optional(), ...messageIdField }),
  z.object({ type: z.literal('DECLINE_SEAT'), ...messageIdField }),

  // Game actions
  z.object({ type: z.literal('GRAND_TICHU_DECISION'), call: z.boolean(), partnerOverride: z.boolean().optional(), ...messageIdField }),
  z.object({ type: z.literal('TICHU_DECLARATION'), partnerOverride: z.boolean().optional(), ...messageIdField }),
  z.object({ type: z.literal('PASS_CARDS'), cards: z.record(seatSchema, gameCardSchema), ...messageIdField }),
  z.object({ type: z.literal('CANCEL_PASS_CARDS'), ...messageIdField }),
  z.object({ type: z.literal('PLAY_CARDS'), cardIds: z.array(z.number().int().min(0).max(55)).min(1), phoenixAs: rankSchema.optional(), wish: rankSchema.nullable().optional(), ...messageIdField }),
  z.object({ type: z.literal('PASS_TURN'), ...messageIdField }),
  z.object({ type: z.literal('DECLARE_WISH'), rank: rankSchema.nullable(), ...messageIdField }),
  z.object({ type: z.literal('GIFT_DRAGON'), to: seatSchema, ...messageIdField }),

  // Mid-game seat choice (when joining with 2+ vacated seats)
  z.object({ type: z.literal('CHOOSE_SEAT'), seat: seatSchema, ...messageIdField }),

  // REQ-F-KM02/KM03: Kick dialog response (any single 'kick' triggers immediate removal)
  z.object({ type: z.literal('KICK_DIALOG_RESPONSE'), response: z.enum(['kick', 'decline']), ...messageIdField }),

  // REQ-F-PV20: Player-initiated votes (kick player, restart game, restart round)
  z.object({ type: z.literal('START_KICK_VOTE'), targetSeat: seatSchema, ...messageIdField }),
  z.object({ type: z.literal('START_RESTART_GAME_VOTE'), ...messageIdField }),
  z.object({ type: z.literal('START_RESTART_ROUND_VOTE'), ...messageIdField }),
  z.object({ type: z.literal('PLAYER_VOTE'), voteId: z.string(), vote: z.boolean(), ...messageIdField }),

  // REQ-F-VI09: Pre-game kick vote (separate from in-game to avoid routing conflicts)
  z.object({ type: z.literal('PRE_GAME_KICK_VOTE'), targetSeat: seatSchema, ...messageIdField }),
  z.object({ type: z.literal('PRE_GAME_VOTE'), voteId: z.string(), vote: z.boolean(), ...messageIdField }),

  // REQ-F-GA35-37: Host force actions (bypass voting)
  z.object({ type: z.literal('FORCE_KICK'), targetSeat: seatSchema, ...messageIdField }),
  z.object({ type: z.literal('FORCE_RESTART_ROUND'), ...messageIdField }),
  z.object({ type: z.literal('FORCE_RESTART_GAME'), ...messageIdField }),

  // REQ-F-GA38: Host transfers host role to another human player
  z.object({ type: z.literal('TRANSFER_HOST'), targetSeat: seatSchema, ...messageIdField }),

  // REQ-F-GA51: Host or vote initiator cancels an active vote
  z.object({ type: z.literal('CANCEL_VOTE'), ...messageIdField }),

  // REQ-F-GA52: Host toggles whether non-host players can start votes
  z.object({ type: z.literal('TOGGLE_VOTING'), ...messageIdField }),

  // Chat
  z.object({ type: z.literal('CHAT_MESSAGE'), text: z.string().min(1).max(500), ...messageIdField }),

  // Heartbeat (application-level — requires JavaScript to respond, unlike protocol-level ping/pong)
  z.object({ type: z.literal('HEARTBEAT_PONG'), ...messageIdField }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

// --- Server → Client messages ---

export const serverMessageSchema = z.discriminatedUnion('type', [
  // Room events
  z.object({ type: z.literal('ROOM_CREATED'), roomCode: z.string() }),
  // REQ-F-SP04: seat is nullable — null indicates spectator
  z.object({ type: z.literal('ROOM_JOINED'), roomCode: z.string(), seat: seatSchema.nullable() }),
  // REQ-F-SP16: ROOM_UPDATE includes spectatorCount and readyPlayers
  // REQ-F-GA52: ROOM_UPDATE includes votingEnabled for non-host vote toggle
  z.object({ type: z.literal('ROOM_UPDATE'), roomName: z.string(), players: z.array(z.object({ seat: seatSchema, name: z.string(), isBot: z.boolean(), isConnected: z.boolean() })), hostSeat: seatSchema, config: z.any(), gameInProgress: z.boolean(), spectatorCount: z.number().int().min(0), spectatorNames: z.array(z.string()).optional(), readyPlayers: z.array(seatSchema), votingEnabled: z.boolean().optional() }),
  z.object({ type: z.literal('ROOM_LEFT') }),
  z.object({ type: z.literal('KICKED'), message: z.string() }),
  // REQ-F-ES05: LOBBY_LIST includes hasEmptySeats for "Join (In Progress)" button
  z.object({ type: z.literal('LOBBY_LIST'), rooms: z.array(z.object({ roomCode: z.string(), roomName: z.string(), hostName: z.string(), playerCount: z.number(), spectatorCount: z.number(), playerNames: z.array(z.string()), spectatorNames: z.array(z.string()), config: z.any(), gameInProgress: z.boolean(), hasEmptySeats: z.boolean() })) }),

  // REQ-F-ES06: Seat offered to deciding spectator (FIFO priority, array for multi-vacancy)
  z.object({ type: z.literal('SEAT_OFFERED'), seats: z.array(seatSchema), timeoutMs: z.number() }),
  // REQ-F-SP08b: Queue status for non-deciding spectators (position 0 = passed/timed out)
  z.object({ type: z.literal('QUEUE_STATUS'), decidingSpectator: z.string(), position: z.number().int().min(0), timeoutMs: z.number() }),
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

  // Disconnect handling
  z.object({ type: z.literal('PLAYER_DISCONNECTED'), seat: seatSchema }),
  z.object({ type: z.literal('PLAYER_RECONNECTED'), seat: seatSchema }),

  // REQ-F-KM01: Kick dialog messages (disconnected 2+ min, single player can trigger kick)
  z.object({ type: z.literal('KICK_DIALOG_SHOW'), targetSeat: seatSchema }),
  z.object({ type: z.literal('KICK_DIALOG_DISMISSED'), targetSeat: seatSchema, reason: z.enum(['kicked', 'declined', 'reconnected', 'vote_priority']) }),

  // REQ-F-PV21: Player-initiated vote messages (kick player or restart game)
  z.object({ type: z.literal('VOTE_STARTED'), voteId: z.string(), voteType: z.enum(['kick', 'restartGame', 'restartRound']), initiatorSeat: seatSchema, targetSeat: seatSchema.optional(), timeoutMs: z.number() }),
  z.object({ type: z.literal('VOTE_UPDATE'), voteId: z.string(), votes: z.record(seatSchema, z.boolean().nullable()), timeoutMs: z.number() }),
  z.object({ type: z.literal('VOTE_RESULT'), voteId: z.string(), voteType: z.enum(['kick', 'restartGame', 'restartRound']), passed: z.boolean(), targetSeat: seatSchema.optional(), message: z.string() }),

  // Chat
  z.object({ type: z.literal('CHAT_RECEIVED'), from: seatSchema.nullable(), text: z.string(), spectatorName: z.string().optional() }),
  z.object({ type: z.literal('CHAT_HISTORY'), messages: z.array(z.object({ from: seatSchema.nullable(), text: z.string(), timestamp: z.number(), spectatorName: z.string().optional() })) }),

  // Host role change notification
  z.object({ type: z.literal('HOST_TRANSFERRED'), oldHostName: z.string(), newHostName: z.string() }),

  // Heartbeat (application-level — requires JavaScript to respond, unlike protocol-level ping/pong)
  z.object({ type: z.literal('HEARTBEAT_PING') }),

  // Graceful restart notification
  z.object({ type: z.literal('SERVER_SHUTTING_DOWN') }),

  // REQ-F-SJ05, SJ06: Seat-claim rejection with client dialog payload
  z.object({
    type: z.literal('SEAT_CLAIM_REJECTED'),
    reason: z.string(),
    originalSeat: seatSchema,
    requestedSeat: seatSchema,
    currentOccupant: z.object({ displayName: z.string() }).nullable(),
    offerClaimOriginal: z.boolean(),
  }),

  // REQ-F-RAD03, REQ-F-RAD04: Reliable action delivery acknowledgment
  z.object({ type: z.literal('ACK'), messageId: z.string() }),
  z.object({ type: z.literal('NACK'), messageId: z.string(), code: z.string(), message: z.string() }),

  // Error
  z.object({ type: z.literal('ERROR'), code: z.string(), message: z.string() }),
]);

export type ServerMessage = z.infer<typeof serverMessageSchema>;
