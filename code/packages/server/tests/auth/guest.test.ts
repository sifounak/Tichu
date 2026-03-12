// Verifies: REQ-F-AU01

import { describe, it, expect, vi } from 'vitest';
import { ensureGuestUser, getUserById } from '../../src/auth/guest.js';
import type { Database } from '../../src/db/connection.js';

function createMockDb(): Database {
  return {
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              // Return empty array by default (user not found)
              return [];
            }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => {
            return [{ id: 'guest_123', displayName: 'TestGuest', isGuest: true, email: null }];
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    } as any,
    client: {} as any,
    close: vi.fn(),
  } as unknown as Database;
}

describe('guest auth', () => {
  describe('ensureGuestUser', () => {
    it('should create a new guest user when not found', async () => {
      const mockDb = createMockDb();
      const result = await ensureGuestUser(mockDb, 'guest_123', 'Alice');

      expect(result.id).toBe('guest_123');
      expect(result.displayName).toBe('TestGuest');
      expect(result.isGuest).toBe(true);
      expect(mockDb.db.insert).toHaveBeenCalled();
    });

    it('should update existing user and return passed-in displayName', async () => {
      const mockDb = createMockDb();
      // Override select to return an existing user
      (mockDb.db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue([
              { id: 'guest_123', displayName: 'OldName', isGuest: true },
            ]),
          }),
        }),
      });

      const result = await ensureGuestUser(mockDb, 'guest_123', 'Alice');

      expect(result.id).toBe('guest_123');
      // After fix, ensureGuestUser returns the passed-in displayName, not existing[0].displayName
      expect(result.displayName).toBe('Alice');
      expect(result.isGuest).toBe(true);
      expect(mockDb.db.update).toHaveBeenCalled();
    });

    it('should call db.update with the correct displayName when updating', async () => {
      const mockDb = createMockDb();
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      (mockDb.db.update as any).mockReturnValue({ set: mockSet });
      (mockDb.db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue([
              { id: 'guest_123', displayName: 'OldName', isGuest: true },
            ]),
          }),
        }),
      });

      await ensureGuestUser(mockDb, 'guest_123', 'NewName');

      expect(mockDb.db.update).toHaveBeenCalled();
      // Verify set was called with displayName included
      const setArg = mockSet.mock.calls[0][0];
      expect(setArg.displayName).toBe('NewName');
    });

    it('should call db.insert when user does not exist', async () => {
      const mockDb = createMockDb();
      // select returns empty (default behavior)

      await ensureGuestUser(mockDb, 'new_guest', 'Bob');

      expect(mockDb.db.insert).toHaveBeenCalled();
      const insertResult = (mockDb.db.insert as any).mock.results[0].value;
      expect(insertResult.values).toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('should return undefined for non-existent user', async () => {
      const mockDb = createMockDb();
      const result = await getUserById(mockDb, 'nonexistent');
      expect(result).toBeUndefined();
    });

    it('should return user data for existing user', async () => {
      const mockDb = createMockDb();
      (mockDb.db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue([
              { id: 'guest_123', displayName: 'Alice', email: null, isGuest: true },
            ]),
          }),
        }),
      });

      const result = await getUserById(mockDb, 'guest_123');
      expect(result).toBeDefined();
      expect(result!.id).toBe('guest_123');
      expect(result!.email).toBeNull();
    });
  });
});
