// Verifies: REQ-DP-03, REQ-DP-04, REQ-NF-SA05

import { describe, it, expect, vi } from 'vitest';

// Mock better-sqlite3 and drizzle-orm modules
const mockClose = vi.fn();
const mockPragma = vi.fn();
const mockExec = vi.fn();
let mockSqliteVersion = '3.42.0';
const mockPrepare = vi.fn(() => ({
  get: () => ({ v: mockSqliteVersion }),
  run: () => ({ changes: 0 }),
}));
vi.mock('better-sqlite3', () => ({
  default: vi.fn(() => ({
    close: mockClose,
    pragma: mockPragma,
    exec: mockExec,
    prepare: mockPrepare,
  })),
}));

vi.mock('drizzle-orm/better-sqlite3', () => ({
  drizzle: vi.fn(() => ({})),
}));

import { createDatabase } from '../../src/db/connection.js';

describe('createDatabase', () => {
  it('should return db, client, and close function', () => {
    mockSqliteVersion = '3.42.0';
    const database = createDatabase('./test.sqlite');
    expect(database).toHaveProperty('db');
    expect(database).toHaveProperty('client');
    expect(typeof database.close).toBe('function');
  });

  it('should call client.close() when close is called', () => {
    mockSqliteVersion = '3.42.0';
    const database = createDatabase('./test.sqlite');
    database.close();
    expect(mockClose).toHaveBeenCalled();
  });

  // Verifies: REQ-NF-SA05 — SQLite ≥ 3.15 required for row-value IN tuple syntax
  it('should throw when SQLite version is below 3.15', () => {
    mockSqliteVersion = '3.14.2';
    expect(() => createDatabase('./test.sqlite')).toThrow(/3\.14\.2.*3\.15/);
  });

  it('should throw when SQLite major version is below 3', () => {
    mockSqliteVersion = '2.8.17';
    expect(() => createDatabase('./test.sqlite')).toThrow(/2\.8\.17/);
  });

  it('should accept SQLite version exactly 3.15.0', () => {
    mockSqliteVersion = '3.15.0';
    expect(() => createDatabase('./test.sqlite')).not.toThrow();
  });
});
