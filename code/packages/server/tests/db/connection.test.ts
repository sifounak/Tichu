// Verifies: REQ-F-AU03

import { describe, it, expect, vi } from 'vitest';

// Mock the postgres and drizzle-orm modules
vi.mock('postgres', () => ({
  default: vi.fn(() => {
    const mockClient = { end: vi.fn().mockResolvedValue(undefined) };
    return mockClient;
  }),
}));

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(() => ({})),
}));

import { createDatabase } from '../../src/db/connection.js';

describe('createDatabase', () => {
  it('should return db, client, and close function', () => {
    const database = createDatabase('postgresql://test:test@localhost/test');
    expect(database).toHaveProperty('db');
    expect(database).toHaveProperty('client');
    expect(typeof database.close).toBe('function');
  });

  it('should call client.end() when close is called', async () => {
    const database = createDatabase('postgresql://test:test@localhost/test');
    await database.close();
    expect(database.client.end).toHaveBeenCalled();
  });
});
