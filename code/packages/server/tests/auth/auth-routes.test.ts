// Verifies: REQ-F-AU01, REQ-F-AU02, REQ-F-AU03, REQ-F-AU04

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { registerAuthRoutes } from '../../src/auth/auth-routes.js';
import type { Database } from '../../src/db/connection.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = 'test-secret';

// ─── Mock database layer ─────────────────────────────────────────────

function fluentEmpty(result: any[] = []): any {
  const self: any = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    // Make chain thenable so `await db.select().from()...` resolves to result
    then: (resolve: (v: any) => void) => resolve(result),
  };
  // Each method returns self for chaining
  self.from.mockReturnValue(self);
  self.where.mockReturnValue(self);
  self.orderBy.mockReturnValue(self);
  self.limit.mockReturnValue(self);
  self.offset.mockReturnValue(self);
  return self;
}

function createMockDatabase(): Database {
  return {
    db: {
      select: vi.fn().mockImplementation(() => fluentEmpty([])),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'test-id', displayName: 'Test', isGuest: true }]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      all: vi.fn().mockReturnValue([]),
      execute: vi.fn().mockResolvedValue({ rows: [] }),
    } as any,
    client: {} as any,
    close: vi.fn(),
  } as unknown as Database;
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('auth-routes', () => {
  let fastify: FastifyInstance;
  let mockDb: Database;

  beforeEach(async () => {
    fastify = Fastify({ logger: false });
    mockDb = createMockDatabase();
    registerAuthRoutes(fastify, mockDb, JWT_SECRET);
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('POST /api/auth/guest', () => {
    it('should create guest user and return user data', async () => {
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/auth/guest',
        payload: { userId: 'guest_123', displayName: 'Alice' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.user).toBeDefined();
      expect(body.user.id).toBe('test-id');
    });

    it('should reject missing userId', async () => {
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/auth/guest',
        payload: { displayName: 'Alice' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject missing displayName', async () => {
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/auth/guest',
        payload: { userId: 'guest_123' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // Verifies: REQ-F-AU10
  describe('POST /api/auth/register', () => {
    it('should reject missing username', async () => {
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'alice@test.com', password: 'secret123' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject missing email', async () => {
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'Alice', password: 'secret123' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject missing password', async () => {
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'Alice', email: 'alice@test.com' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should register a new user and return token and userId', async () => {
      // username check -> empty, email check -> empty, userId check -> empty
      (mockDb.db.select as any).mockImplementation(() => fluentEmpty([]));
      (mockDb.db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'new-user-id', username: 'Alice', displayName: 'Alice', isGuest: false }]),
        }),
      });

      const res = await fastify.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { userId: 'new-user-id', username: 'Alice', email: 'alice@test.com', password: 'secret123' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.token).toBeDefined();
      expect(body.userId).toBeDefined();
    });
  });

  // Verifies: REQ-F-AU14
  describe('POST /api/auth/login', () => {
    it('should reject missing identifier', async () => {
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { password: 'secret123' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject missing password', async () => {
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: 'alice@test.com' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 401 for non-existent user', async () => {
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: 'nobody@test.com', password: 'secret123' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should login with email and return token, userId, username', async () => {
      const hash = bcrypt.hashSync('secret123', 10);
      (mockDb.db.select as any).mockImplementation(() =>
        fluentEmpty([{ id: 'user1', username: 'Alice', displayName: 'Alice', email: 'alice@test.com', passwordHash: hash }]),
      );

      const res = await fastify.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: 'alice@test.com', password: 'secret123' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.token).toBeDefined();
      expect(body.userId).toBe('user1');
      expect(body.username).toBe('Alice');
    });

    it('should login with username and return token', async () => {
      const hash = bcrypt.hashSync('secret123', 10);
      (mockDb.db.select as any).mockImplementation(() =>
        fluentEmpty([{ id: 'user1', username: 'Alice', displayName: 'Alice', email: 'alice@test.com', passwordHash: hash }]),
      );

      const res = await fastify.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: 'Alice', password: 'secret123' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.token).toBeDefined();
      expect(body.username).toBe('Alice');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should reject request without Authorization header', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.payload).error).toBe('No token provided');
    });

    it('should reject invalid token', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: 'Bearer invalid-token' },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.payload).error).toBe('Invalid token');
    });

    it('should return 404 if user not found in DB', async () => {
      const token = jwt.sign({ userId: 'unknown', email: 'x@test.com' }, JWT_SECRET);
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/players/:userId/profile', () => {
    it('should return null profile for unknown user', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/players/unknown/profile',
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).profile).toBeNull();
    });
  });

  describe('GET /api/players/:userId/games', () => {
    it('should return empty games for unknown user', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/players/unknown/games',
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).games).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/players/user1/games?limit=5',
      });

      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /api/games/:gameId/rounds', () => {
    it('should return empty rounds for non-existent game', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/games/999/rounds',
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).rounds).toEqual([]);
    });

    it('should return 400 for NaN gameId', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/games/abc/rounds',
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/leaderboard', () => {
    it('should return empty leaderboard', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/leaderboard',
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).leaderboard).toEqual([]);
    });

    it('should accept limit and minGames params', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/leaderboard?limit=10&minGames=3',
      });

      expect(res.statusCode).toBe(200);
    });

    it('should return 400 for NaN limit', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/leaderboard?limit=abc',
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/games/recent', () => {
    it('should return empty recent games', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/games/recent',
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).games).toEqual([]);
    });

    it('should accept limit param', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/games/recent?limit=5',
      });

      expect(res.statusCode).toBe(200);
    });
  });
});
