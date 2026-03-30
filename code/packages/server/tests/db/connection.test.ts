// Verifies: REQ-DP-03, REQ-DP-04

import { describe, it, expect, vi } from 'vitest';

// Mock better-sqlite3 and drizzle-orm modules
const mockClose = vi.fn();
const mockPragma = vi.fn();
const mockExec = vi.fn();
vi.mock('better-sqlite3', () => ({
  default: vi.fn(() => ({
    close: mockClose,
    pragma: mockPragma,
    exec: mockExec,
  })),
}));

vi.mock('drizzle-orm/better-sqlite3', () => ({
  drizzle: vi.fn(() => ({})),
}));

import { createDatabase } from '../../src/db/connection.js';

describe('createDatabase', () => {
  it('should return db, client, and close function', () => {
    const database = createDatabase('./test.sqlite');
    expect(database).toHaveProperty('db');
    expect(database).toHaveProperty('client');
    expect(typeof database.close).toBe('function');
  });

  it('should call client.close() when close is called', () => {
    const database = createDatabase('./test.sqlite');
    database.close();
    expect(mockClose).toHaveBeenCalled();
  });
});
