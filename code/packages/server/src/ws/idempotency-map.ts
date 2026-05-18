// REQ-F-RAD06: Server-side idempotency map for reliable action delivery
// REQ-NF-RAD02: Bounded by TTL (60s) and max entries per room (1000)

export interface IdempotencyEntry {
  result: 'ack' | 'nack';
  nackCode?: string;
  nackMessage?: string;
  expiresAt: number;
}

const TTL_MS = 60_000;
const MAX_PER_ROOM = 1000;
const CLEANUP_INTERVAL_MS = 10_000;

/**
 * Per-room idempotency map that prevents duplicate message processing.
 * Entries expire after 60s and are capped at 1000 per room.
 */
export class IdempotencyMap {
  private readonly maps = new Map<string, Map<string, IdempotencyEntry>>();
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
  }

  /** Check if a messageId has already been processed for a given room context */
  get(roomKey: string, messageId: string): IdempotencyEntry | undefined {
    const roomMap = this.maps.get(roomKey);
    if (!roomMap) return undefined;
    const entry = roomMap.get(messageId);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      roomMap.delete(messageId);
      return undefined;
    }
    return entry;
  }

  /** Store the result of processing a message */
  set(roomKey: string, messageId: string, entry: Omit<IdempotencyEntry, 'expiresAt'>): void {
    let roomMap = this.maps.get(roomKey);
    if (!roomMap) {
      roomMap = new Map();
      this.maps.set(roomKey, roomMap);
    }

    // Evict oldest entries if at capacity
    if (roomMap.size >= MAX_PER_ROOM) {
      const iterator = roomMap.keys();
      const oldest = iterator.next().value;
      if (oldest !== undefined) {
        roomMap.delete(oldest);
      }
    }

    roomMap.set(messageId, { ...entry, expiresAt: Date.now() + TTL_MS });
  }

  /** Remove all entries for a room (called on room destruction) */
  removeRoom(roomKey: string): void {
    this.maps.delete(roomKey);
  }

  /** Evict expired entries across all rooms */
  cleanup(): void {
    const now = Date.now();
    for (const [roomKey, roomMap] of this.maps) {
      for (const [msgId, entry] of roomMap) {
        if (now > entry.expiresAt) {
          roomMap.delete(msgId);
        }
      }
      if (roomMap.size === 0) {
        this.maps.delete(roomKey);
      }
    }
  }

  /** Stop the cleanup timer (for graceful shutdown) */
  dispose(): void {
    clearInterval(this.cleanupTimer);
  }

  /** Get total entry count (for testing/monitoring) */
  get size(): number {
    let total = 0;
    for (const roomMap of this.maps.values()) {
      total += roomMap.size;
    }
    return total;
  }
}
