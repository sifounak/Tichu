// Verifies: REQ-F-AU02

import { describe, it, expect, vi } from 'vitest';
import { verifyToken, registerAccount, loginAccount } from '../../src/auth/account.js';
import type { Database } from '../../src/db/connection.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = 'test-secret-key';

// ─── Mock helpers ────────────────────────────────────────────────────

function fluentChain(result: any[] = []): any {
  const self: any = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    then: (resolve: (v: any) => void) => resolve(result),
  };
  self.from.mockReturnValue(self);
  self.where.mockReturnValue(self);
  self.orderBy.mockReturnValue(self);
  self.limit.mockReturnValue(self);
  self.offset.mockReturnValue(self);
  return self;
}

function createMockDb(selectResults: any[][] = [[]]): Database {
  let selectCallIndex = 0;
  return {
    db: {
      select: vi.fn().mockImplementation(() => {
        const result = selectResults[selectCallIndex] ?? [];
        selectCallIndex++;
        return fluentChain(result);
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      execute: vi.fn().mockResolvedValue({ rows: [] }),
    } as any,
    client: {} as any,
    close: vi.fn(),
  } as unknown as Database;
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('account auth', () => {
  describe('verifyToken', () => {
    it('should verify a valid JWT token', () => {
      const token = jwt.sign({ userId: 'user1', email: 'test@example.com' }, JWT_SECRET, { expiresIn: '1h' });
      const payload = verifyToken(token, JWT_SECRET);
      expect(payload).not.toBeNull();
      expect(payload!.userId).toBe('user1');
      expect(payload!.email).toBe('test@example.com');
    });

    it('should return null for invalid token', () => {
      const payload = verifyToken('invalid-token', JWT_SECRET);
      expect(payload).toBeNull();
    });

    it('should return null for expired token', () => {
      const token = jwt.sign({ userId: 'user1', email: 'test@example.com' }, JWT_SECRET, { expiresIn: '0s' });
      // Token expires immediately
      const payload = verifyToken(token, JWT_SECRET);
      expect(payload).toBeNull();
    });

    it('should return null for token signed with wrong secret', () => {
      const token = jwt.sign({ userId: 'user1', email: 'test@example.com' }, 'wrong-secret');
      const payload = verifyToken(token, JWT_SECRET);
      expect(payload).toBeNull();
    });

    it('should return null for empty string', () => {
      const payload = verifyToken('', JWT_SECRET);
      expect(payload).toBeNull();
    });
  });

  describe('registerAccount', () => {
    it('should register a new user when email and userId are available', async () => {
      // email check -> empty, userId check -> empty
      const mockDb = createMockDb([[], []]);

      const result = await registerAccount(mockDb, JWT_SECRET, {
        userId: 'new-user',
        email: 'alice@test.com',
        password: 'secret123',
        displayName: 'Alice',
      });

      expect(result.token).toBeDefined();
      expect(result.userId).toBe('new-user');
      // Verify the token is valid
      const decoded = verifyToken(result.token, JWT_SECRET);
      expect(decoded!.userId).toBe('new-user');
      expect(decoded!.email).toBe('alice@test.com');
      expect(mockDb.db.insert).toHaveBeenCalled();
    });

    it('should reject duplicate email', async () => {
      // email check -> returns a row
      const mockDb = createMockDb([[{ id: 'existing-user' }]]);

      await expect(registerAccount(mockDb, JWT_SECRET, {
        userId: 'new-user',
        email: 'taken@test.com',
        password: 'secret123',
        displayName: 'Alice',
      })).rejects.toThrow('Email already registered');
    });

    it('should upgrade a guest account', async () => {
      // email check -> empty, userId check -> guest user
      const mockDb = createMockDb([[], [{ id: 'guest_123', isGuest: true }]]);

      const result = await registerAccount(mockDb, JWT_SECRET, {
        userId: 'guest_123',
        email: 'alice@test.com',
        password: 'secret123',
        displayName: 'Alice',
      });

      expect(result.token).toBeDefined();
      expect(result.userId).toBe('guest_123');
      expect(mockDb.db.update).toHaveBeenCalled();
    });

    it('should reject non-guest upgrade', async () => {
      // email check -> empty, userId check -> registered (non-guest) user
      const mockDb = createMockDb([[], [{ id: 'registered_user', isGuest: false }]]);

      await expect(registerAccount(mockDb, JWT_SECRET, {
        userId: 'registered_user',
        email: 'new@test.com',
        password: 'secret123',
        displayName: 'Alice',
      })).rejects.toThrow('Account already registered');
    });
  });

  describe('loginAccount', () => {
    it('should login with correct password', async () => {
      const hash = bcrypt.hashSync('secret123', 10);
      // select returns user with bcrypt hash
      const mockDb = createMockDb([[{
        id: 'user1',
        displayName: 'Alice',
        email: 'alice@test.com',
        passwordHash: hash,
      }]]);

      const result = await loginAccount(mockDb, JWT_SECRET, 'alice@test.com', 'secret123');

      expect(result.token).toBeDefined();
      expect(result.userId).toBe('user1');
      expect(result.displayName).toBe('Alice');
      // Verify the token
      const decoded = verifyToken(result.token, JWT_SECRET);
      expect(decoded!.userId).toBe('user1');
      // Verify update was called (lastSeenAt)
      expect(mockDb.db.update).toHaveBeenCalled();
    });

    it('should reject wrong password', async () => {
      const hash = bcrypt.hashSync('correct-password', 10);
      const mockDb = createMockDb([[{
        id: 'user1',
        displayName: 'Alice',
        email: 'alice@test.com',
        passwordHash: hash,
      }]]);

      await expect(
        loginAccount(mockDb, JWT_SECRET, 'alice@test.com', 'wrong-password'),
      ).rejects.toThrow('Invalid email or password');
    });

    it('should reject non-existent email', async () => {
      // select returns empty
      const mockDb = createMockDb([[]]);

      await expect(
        loginAccount(mockDb, JWT_SECRET, 'nobody@test.com', 'secret123'),
      ).rejects.toThrow('Invalid email or password');
    });
  });
});
