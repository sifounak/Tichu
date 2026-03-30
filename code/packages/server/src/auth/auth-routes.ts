// REQ-F-AU01: Guest access routes
// REQ-F-AU02: Account registration and login routes
// REQ-F-AU03: Game history routes
// REQ-F-AU04: Leaderboard routes

import type { FastifyInstance } from 'fastify';
import type { Database } from '../db/connection.js';
import { ensureGuestUser, getUserById } from './guest.js';
import { registerAccount, loginAccount, verifyToken } from './account.js';
import { getPlayerGameHistory, getGameRounds } from '../db/game-persistence.js';
import { getLeaderboard, getRecentGames, getPlayerProfile, getPlayerPartners, getPlayerOpponents } from '../db/queries.js';

export function registerAuthRoutes(fastify: FastifyInstance, database: Database, jwtSecret: string): void {
  // ─── Guest session ──────────────────────────────────────────────────

  fastify.post('/api/auth/guest', async (request, reply) => {
    const body = request.body as { userId: string; displayName: string };
    if (!body.userId || !body.displayName) {
      return reply.status(400).send({ error: 'userId and displayName are required' });
    }
    const user = await ensureGuestUser(database, body.userId, body.displayName);
    return { user };
  });

  // ─── Account registration ────────────────────────────────────────────

  fastify.post('/api/auth/register', async (request, reply) => {
    const body = request.body as { userId: string; email: string; password: string; displayName: string };
    if (!body.email || !body.password || !body.displayName) {
      return reply.status(400).send({ error: 'email, password, and displayName are required' });
    }
    try {
      const result = await registerAccount(database, jwtSecret, {
        userId: body.userId || `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        email: body.email,
        password: body.password,
        displayName: body.displayName,
      });
      return { token: result.token, userId: result.userId };
    } catch (err: any) {
      return reply.status(409).send({ error: err.message });
    }
  });

  // ─── Login ────────────────────────────────────────────────────────────

  fastify.post('/api/auth/login', async (request, reply) => {
    const body = request.body as { email: string; password: string };
    if (!body.email || !body.password) {
      return reply.status(400).send({ error: 'email and password are required' });
    }
    try {
      const result = await loginAccount(database, jwtSecret, body.email, body.password);
      return { token: result.token, userId: result.userId, displayName: result.displayName };
    } catch (err: any) {
      return reply.status(401).send({ error: err.message });
    }
  });

  // ─── Current user profile ────────────────────────────────────────────

  fastify.get('/api/auth/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'No token provided' });
    }
    const payload = verifyToken(authHeader.slice(7), jwtSecret);
    if (!payload) {
      return reply.status(401).send({ error: 'Invalid token' });
    }
    const user = await getUserById(database, payload.userId);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }
    return { user };
  });

  // ─── Player profile stats ────────────────────────────────────────────

  fastify.get('/api/players/:userId/profile', async (request) => {
    const { userId } = request.params as { userId: string };
    const profile = await getPlayerProfile(database, userId);
    return { profile: profile ?? null };
  });

  // ─── REQ-F-API02: Partner stats ──────────────────────────────────────

  fastify.get('/api/players/:userId/partners', async (request) => {
    const { userId } = request.params as { userId: string };
    const partners = getPlayerPartners(database, userId);
    return { partners };
  });

  // ─── REQ-F-API03: Opponent stats ────────────────────────────────────

  fastify.get('/api/players/:userId/opponents', async (request) => {
    const { userId } = request.params as { userId: string };
    const opponents = getPlayerOpponents(database, userId);
    return { opponents };
  });

  // ─── Game history ────────────────────────────────────────────────────

  fastify.get('/api/players/:userId/games', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(parseInt(query.limit ?? '20', 10), 50);
    const offset = parseInt(query.offset ?? '0', 10);
    if (isNaN(limit) || isNaN(offset)) {
      return reply.status(400).send({ error: 'limit and offset must be numbers' });
    }
    const games = await getPlayerGameHistory(database, userId, limit, offset);
    return { games };
  });

  // ─── Game round details ──────────────────────────────────────────────

  fastify.get('/api/games/:gameId/rounds', async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const parsedId = parseInt(gameId, 10);
    if (isNaN(parsedId)) {
      return reply.status(400).send({ error: 'gameId must be a number' });
    }
    const rounds = await getGameRounds(database, parsedId);
    return { rounds };
  });

  // ─── Leaderboard ─────────────────────────────────────────────────────

  fastify.get('/api/leaderboard', async (request, reply) => {
    const query = request.query as { limit?: string; minGames?: string };
    const limit = Math.min(parseInt(query.limit ?? '20', 10), 100);
    const minGames = parseInt(query.minGames ?? '5', 10);
    if (isNaN(limit) || isNaN(minGames)) {
      return reply.status(400).send({ error: 'limit and minGames must be numbers' });
    }
    const leaderboard = await getLeaderboard(database, limit, minGames);
    return { leaderboard };
  });

  // ─── Recent games ────────────────────────────────────────────────────

  fastify.get('/api/games/recent', async (request, reply) => {
    const query = request.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit ?? '10', 10), 50);
    if (isNaN(limit)) {
      return reply.status(400).send({ error: 'limit must be a number' });
    }
    const recentGames = await getRecentGames(database, limit);
    return { games: recentGames };
  });
}
