// Verifies: REQ-F-RAD06, REQ-NF-RAD02

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdempotencyMap } from '../../src/ws/idempotency-map.js';

describe('IdempotencyMap', () => {
  let map: IdempotencyMap;

  beforeEach(() => {
    vi.useFakeTimers();
    map = new IdempotencyMap();
  });

  afterEach(() => {
    map.dispose();
    vi.useRealTimers();
  });

  it('returns undefined for unknown messageId', () => {
    expect(map.get('room1', 'msg-1')).toBeUndefined();
  });

  it('stores and retrieves an ACK entry', () => {
    map.set('room1', 'msg-1', { result: 'ack' });
    const entry = map.get('room1', 'msg-1');
    expect(entry).toBeDefined();
    expect(entry!.result).toBe('ack');
  });

  it('stores and retrieves a NACK entry', () => {
    map.set('room1', 'msg-2', { result: 'nack', nackCode: 'ERR', nackMessage: 'failed' });
    const entry = map.get('room1', 'msg-2');
    expect(entry).toBeDefined();
    expect(entry!.result).toBe('nack');
    expect(entry!.nackCode).toBe('ERR');
    expect(entry!.nackMessage).toBe('failed');
  });

  it('isolates entries by room', () => {
    map.set('room1', 'msg-1', { result: 'ack' });
    expect(map.get('room2', 'msg-1')).toBeUndefined();
  });

  it('expires entries after TTL (60s)', () => {
    map.set('room1', 'msg-1', { result: 'ack' });
    expect(map.get('room1', 'msg-1')).toBeDefined();

    vi.advanceTimersByTime(61_000);
    expect(map.get('room1', 'msg-1')).toBeUndefined();
  });

  it('cleanup removes expired entries', () => {
    map.set('room1', 'msg-1', { result: 'ack' });
    map.set('room1', 'msg-2', { result: 'ack' });
    expect(map.size).toBe(2);

    vi.advanceTimersByTime(61_000);
    map.cleanup();
    expect(map.size).toBe(0);
  });

  it('evicts oldest entry when at max capacity (1000 per room)', () => {
    for (let i = 0; i < 1000; i++) {
      map.set('room1', `msg-${i}`, { result: 'ack' });
    }
    expect(map.size).toBe(1000);

    // Adding one more should evict the oldest (msg-0)
    map.set('room1', 'msg-new', { result: 'ack' });
    expect(map.size).toBe(1000);
    expect(map.get('room1', 'msg-0')).toBeUndefined();
    expect(map.get('room1', 'msg-new')).toBeDefined();
  });

  it('removeRoom clears all entries for that room', () => {
    map.set('room1', 'msg-1', { result: 'ack' });
    map.set('room1', 'msg-2', { result: 'ack' });
    map.set('room2', 'msg-3', { result: 'ack' });

    map.removeRoom('room1');
    expect(map.get('room1', 'msg-1')).toBeUndefined();
    expect(map.get('room1', 'msg-2')).toBeUndefined();
    expect(map.get('room2', 'msg-3')).toBeDefined();
  });

  it('periodic cleanup runs automatically', () => {
    map.set('room1', 'msg-1', { result: 'ack' });

    // Advance past TTL then past cleanup interval
    vi.advanceTimersByTime(70_000);
    // Cleanup should have run at 10s intervals, clearing expired entries
    expect(map.get('room1', 'msg-1')).toBeUndefined();
  });
});
