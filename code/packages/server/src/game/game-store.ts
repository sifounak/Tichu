// REQ-F-MP01: Any combination 0-4 humans + bots

import type { GameConfig } from '@tichu/shared';
import type { Broadcaster } from '../ws/broadcaster.js';
import { GameManager } from './game-manager.js';
import { DisconnectHandler } from './disconnect-handler.js';
import { VoteHandler } from './vote-handler.js';

/**
 * In-memory store of active games.
 *
 * Manages game lifecycle: creation, lookup, and destruction.
 * Each game is identified by a unique game ID and associated with a room code.
 */
export class GameStore {
  /** Active games by game ID */
  private readonly games = new Map<string, GameManager>();

  /** Reverse lookup: room code → game ID */
  private readonly roomToGame = new Map<string, string>();

  /** Shared disconnect handler for all games */
  readonly disconnectHandler: DisconnectHandler;

  /** REQ-F-PV22: Shared player vote handler for all games */
  readonly voteHandler: VoteHandler;

  constructor(
    private readonly broadcaster: Broadcaster,
    options?: { voteTimeoutMs?: number },
  ) {
    this.disconnectHandler = new DisconnectHandler(broadcaster, options);
    this.voteHandler = new VoteHandler(broadcaster, options);
  }

  /** Create a new game for a room */
  createGame(roomCode: string, config?: Partial<GameConfig>): GameManager {
    // Don't create duplicate games for the same room
    const existing = this.getGameByRoom(roomCode);
    if (existing) return existing;

    const gameId = generateGameId();
    const manager = new GameManager(
      gameId,
      roomCode,
      this.broadcaster,
      this.disconnectHandler,
      this.voteHandler,
      config,
    );

    this.games.set(gameId, manager);
    this.roomToGame.set(roomCode, gameId);

    return manager;
  }

  /** Get a game by its ID */
  getGame(gameId: string): GameManager | undefined {
    return this.games.get(gameId);
  }

  /** Get a game by its room code */
  getGameByRoom(roomCode: string): GameManager | undefined {
    const gameId = this.roomToGame.get(roomCode);
    if (!gameId) return undefined;
    return this.games.get(gameId);
  }

  /** Destroy a game and clean up */
  destroyGame(gameId: string): boolean {
    const manager = this.games.get(gameId);
    if (!manager) return false;

    const roomCode = manager.roomCode;
    manager.destroy();
    this.games.delete(gameId);
    this.roomToGame.delete(roomCode);
    this.disconnectHandler.cleanupRoom(roomCode);
    this.voteHandler.cleanupRoom(roomCode);

    return true;
  }

  /** Destroy a game by room code */
  destroyGameByRoom(roomCode: string): boolean {
    const gameId = this.roomToGame.get(roomCode);
    if (!gameId) return false;
    return this.destroyGame(gameId);
  }

  /** Get all active game IDs */
  get activeGameIds(): string[] {
    return Array.from(this.games.keys());
  }

  /** Get total number of active games */
  get size(): number {
    return this.games.size;
  }

  /** Clean up all games */
  dispose(): void {
    for (const [, manager] of this.games) {
      manager.destroy();
    }
    this.games.clear();
    this.roomToGame.clear();
    this.disconnectHandler.dispose();
    this.voteHandler.dispose();
  }
}

/** Generate a short unique game ID */
function generateGameId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `game_${timestamp}_${random}`;
}
