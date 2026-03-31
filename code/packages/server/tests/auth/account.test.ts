// Verifies: REQ-F-AU10, REQ-F-AU11, REQ-F-AU12, REQ-F-AU13, REQ-F-AU14, REQ-F-AU16

import { describe, it, expect, vi } from 'vitest';
import { verifyToken, registerAccount, loginAccount, validateUsername } from '../../src/auth/account.js';
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

  // Verifies: REQ-F-AU11, REQ-F-AU12, REQ-F-AU13
  describe('validateUsername', () => {
    it('should accept valid usernames', () => {
      expect(validateUsername('Alice')).toEqual({ valid: true });
      expect(validateUsername('player_1')).toEqual({ valid: true });
      expect(validateUsername('a')).toEqual({ valid: true });
      expect(validateUsername('A name with spaces')).toEqual({ valid: true });
    });

    it('should reject empty username', () => {
      expect(validateUsername('')).toEqual({ valid: false, error: 'Username is required' });
      expect(validateUsername('   ')).toEqual({ valid: false, error: 'Username is required' });
    });

    it('should reject username over 30 chars', () => {
      const long = 'a'.repeat(31);
      expect(validateUsername(long).valid).toBe(false);
      expect(validateUsername(long).error).toContain('30 characters');
    });

    // REQ-F-AU13: No leading/trailing spaces
    it('should reject username with leading or trailing spaces', () => {
      expect(validateUsername(' Alice').valid).toBe(false);
      expect(validateUsername('Alice ').valid).toBe(false);
      expect(validateUsername(' Alice ').valid).toBe(false);
      expect(validateUsername(' Alice').error).toContain('leading or trailing spaces');
    });

    // REQ-F-AU12: Cannot be "bot" (case-insensitive)
    it('should reject "bot" in any case', () => {
      expect(validateUsername('bot').valid).toBe(false);
      expect(validateUsername('Bot').valid).toBe(false);
      expect(validateUsername('BOT').valid).toBe(false);
      expect(validateUsername('bot').error).toContain('reserved');
    });

    it('should accept usernames containing "bot" as substring', () => {
      expect(validateUsername('robot')).toEqual({ valid: true });
      expect(validateUsername('botman')).toEqual({ valid: true });
    });
  });

  // Verifies: REQ-F-AU10, REQ-F-AU16
  describe('registerAccount', () => {
    it('should register a new user with username', async () => {
      // username check -> empty, email check -> empty, userId check -> empty
      const mockDb = createMockDb([[], [], []]);

      const result = await registerAccount(mockDb, JWT_SECRET, {
        userId: 'new-user',
        username: 'Alice',
        email: 'alice@test.com',
        password: 'secret123',
      });

      expect(result.token).toBeDefined();
      expect(result.userId).toBe('new-user');
      const decoded = verifyToken(result.token, JWT_SECRET);
      expect(decoded!.userId).toBe('new-user');
      expect(decoded!.email).toBe('alice@test.com');
      expect(mockDb.db.insert).toHaveBeenCalled();
    });

    // REQ-F-AU11: Reject duplicate username
    it('should reject duplicate username', async () => {
      // username check -> returns a row
      const mockDb = createMockDb([[{ id: 'existing-user' }]]);

      await expect(registerAccount(mockDb, JWT_SECRET, {
        userId: 'new-user',
        username: 'Alice',
        email: 'newemail@test.com',
        password: 'secret123',
      })).rejects.toThrow('Username already taken');
    });

    it('should reject duplicate email', async () => {
      // username check -> empty, email check -> returns a row
      const mockDb = createMockDb([[], [{ id: 'existing-user' }]]);

      await expect(registerAccount(mockDb, JWT_SECRET, {
        userId: 'new-user',
        username: 'Alice',
        email: 'taken@test.com',
        password: 'secret123',
      })).rejects.toThrow('Email already registered');
    });

    it('should upgrade a guest account', async () => {
      // username check -> empty, email check -> empty, userId check -> guest user
      const mockDb = createMockDb([[], [], [{ id: 'guest_123', isGuest: true }]]);

      const result = await registerAccount(mockDb, JWT_SECRET, {
        userId: 'guest_123',
        username: 'Alice',
        email: 'alice@test.com',
        password: 'secret123',
      });

      expect(result.token).toBeDefined();
      expect(result.userId).toBe('guest_123');
      expect(mockDb.db.update).toHaveBeenCalled();
    });

    it('should reject non-guest upgrade', async () => {
      // username check -> empty, email check -> empty, userId check -> registered user
      const mockDb = createMockDb([[], [], [{ id: 'registered_user', isGuest: false }]]);

      await expect(registerAccount(mockDb, JWT_SECRET, {
        userId: 'registered_user',
        username: 'Alice',
        email: 'new@test.com',
        password: 'secret123',
      })).rejects.toThrow('Account already registered');
    });

    // REQ-F-AU12: Reject "bot" username
    it('should reject "bot" as username', async () => {
      const mockDb = createMockDb([]);

      await expect(registerAccount(mockDb, JWT_SECRET, {
        userId: 'new-user',
        username: 'Bot',
        email: 'alice@test.com',
        password: 'secret123',
      })).rejects.toThrow('reserved');
    });

    // REQ-F-AU13: Reject leading/trailing spaces
    it('should reject username with leading/trailing spaces', async () => {
      const mockDb = createMockDb([]);

      await expect(registerAccount(mockDb, JWT_SECRET, {
        userId: 'new-user',
        username: ' Alice ',
        email: 'alice@test.com',
        password: 'secret123',
      })).rejects.toThrow('leading or trailing spaces');
    });
  });

  // Verifies: REQ-F-AU14
  describe('loginAccount', () => {
    it('should login with email (contains @)', async () => {
      const hash = bcrypt.hashSync('secret123', 10);
      const mockDb = createMockDb([[{
        id: 'user1',
        username: 'Alice',
        displayName: 'Alice',
        email: 'alice@test.com',
        passwordHash: hash,
      }]]);

      const result = await loginAccount(mockDb, JWT_SECRET, 'alice@test.com', 'secret123');

      expect(result.token).toBeDefined();
      expect(result.userId).toBe('user1');
      expect(result.username).toBe('Alice');
      const decoded = verifyToken(result.token, JWT_SECRET);
      expect(decoded!.userId).toBe('user1');
      expect(mockDb.db.update).toHaveBeenCalled();
    });

    it('should login with username (no @)', async () => {
      const hash = bcrypt.hashSync('secret123', 10);
      const mockDb = createMockDb([[{
        id: 'user1',
        username: 'Alice',
        displayName: 'Alice',
        email: 'alice@test.com',
        passwordHash: hash,
      }]]);

      const result = await loginAccount(mockDb, JWT_SECRET, 'Alice', 'secret123');

      expect(result.token).toBeDefined();
      expect(result.userId).toBe('user1');
      expect(result.username).toBe('Alice');
    });

    it('should reject wrong password', async () => {
      const hash = bcrypt.hashSync('correct-password', 10);
      const mockDb = createMockDb([[{
        id: 'user1',
        username: 'Alice',
        displayName: 'Alice',
        email: 'alice@test.com',
        passwordHash: hash,
      }]]);

      await expect(
        loginAccount(mockDb, JWT_SECRET, 'alice@test.com', 'wrong-password'),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      const mockDb = createMockDb([[]]);

      await expect(
        loginAccount(mockDb, JWT_SECRET, 'nobody@test.com', 'secret123'),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject non-existent username', async () => {
      const mockDb = createMockDb([[]]);

      await expect(
        loginAccount(mockDb, JWT_SECRET, 'NonExistentUser', 'secret123'),
      ).rejects.toThrow('Invalid credentials');
    });
  });
});
