// REQ-F-MP08: Disconnect handling with vote

import type { Seat } from '@tichu/shared';
import type { Broadcaster } from '../ws/broadcaster.js';

/** Vote options for handling a disconnected player */
export type DisconnectVote = 'wait' | 'bot' | 'abandon';

/** Result of the vote */
export type VoteOutcome = 'waiting' | 'replace_with_bot' | 'game_abandoned' | 'pending';

/** State for a single disconnect vote session */
interface VoteSession {
  disconnectedSeat: Seat;
  votes: Map<Seat, DisconnectVote>;
  timeoutHandle: ReturnType<typeof setTimeout>;
  startedAt: number;
}

/**
 * REQ-F-MP08: Manages player disconnection, voting, and reconnection.
 *
 * When a player disconnects during a game:
 * 1. Remaining players are notified
 * 2. A vote is initiated: wait (with timeout), replace with bot, or abandon
 * 3. Majority decides; on timeout → replace with bot
 * 4. On reconnect: restore player's seat, send full game state
 */
export class DisconnectHandler {
  /** Active vote sessions by room code */
  private readonly sessions = new Map<string, VoteSession>();

  /** Disconnected players: roomCode → Set of seats */
  private readonly disconnected = new Map<string, Set<Seat>>();

  /** Default vote timeout in ms (60 seconds) */
  private readonly voteTimeoutMs: number;

  /** Callback when vote concludes */
  onVoteResult: ((roomCode: string, outcome: VoteOutcome, seat: Seat) => void) | null = null;

  constructor(
    private readonly broadcaster: Broadcaster,
    options?: { voteTimeoutMs?: number },
  ) {
    this.voteTimeoutMs = options?.voteTimeoutMs ?? 60_000;
  }

  /** Record a player disconnection and start the vote process */
  handleDisconnect(roomCode: string, seat: Seat): void {
    // Track disconnection
    if (!this.disconnected.has(roomCode)) {
      this.disconnected.set(roomCode, new Set());
    }
    this.disconnected.get(roomCode)!.add(seat);

    // Notify remaining players
    this.broadcaster.broadcastToRoom(roomCode, {
      type: 'PLAYER_DISCONNECTED',
      seat,
    });

    // Start vote if no vote session is active for this room
    if (!this.sessions.has(roomCode)) {
      this.startVote(roomCode, seat);
    }
  }

  /** Handle a player reconnecting */
  handleReconnect(roomCode: string, seat: Seat): void {
    const disconnectedSeats = this.disconnected.get(roomCode);
    if (disconnectedSeats) {
      disconnectedSeats.delete(seat);
      if (disconnectedSeats.size === 0) {
        this.disconnected.delete(roomCode);
      }
    }

    // Cancel active vote for this seat
    const session = this.sessions.get(roomCode);
    if (session && session.disconnectedSeat === seat) {
      clearTimeout(session.timeoutHandle);
      this.sessions.delete(roomCode);
    }

    // Notify remaining players
    this.broadcaster.broadcastToRoom(roomCode, {
      type: 'PLAYER_RECONNECTED',
      seat,
    });
  }

  /** Record a vote from a connected player */
  handleVote(roomCode: string, voterSeat: Seat, vote: DisconnectVote): VoteOutcome {
    const session = this.sessions.get(roomCode);
    if (!session) return 'pending';

    // Can't vote if you're the disconnected player
    if (voterSeat === session.disconnectedSeat) return 'pending';

    session.votes.set(voterSeat, vote);
    return this.evaluateVotes(roomCode);
  }

  /** Check if a seat is disconnected in a room */
  isDisconnected(roomCode: string, seat: Seat): boolean {
    return this.disconnected.get(roomCode)?.has(seat) ?? false;
  }

  /** Get all disconnected seats in a room */
  getDisconnectedSeats(roomCode: string): Seat[] {
    return Array.from(this.disconnected.get(roomCode) ?? []);
  }

  /** Clean up all state for a room */
  cleanupRoom(roomCode: string): void {
    const session = this.sessions.get(roomCode);
    if (session) {
      clearTimeout(session.timeoutHandle);
      this.sessions.delete(roomCode);
    }
    this.disconnected.delete(roomCode);
  }

  /** Clean up all state */
  dispose(): void {
    for (const [, session] of this.sessions) {
      clearTimeout(session.timeoutHandle);
    }
    this.sessions.clear();
    this.disconnected.clear();
  }

  /** Start a vote session for a disconnected player */
  private startVote(roomCode: string, disconnectedSeat: Seat): void {
    const timeoutHandle = setTimeout(() => {
      this.resolveVote(roomCode, 'replace_with_bot');
    }, this.voteTimeoutMs);

    const session: VoteSession = {
      disconnectedSeat,
      votes: new Map(),
      timeoutHandle,
      startedAt: Date.now(),
    };

    this.sessions.set(roomCode, session);

    // Notify players that a vote is needed
    this.broadcaster.broadcastToRoom(roomCode, {
      type: 'DISCONNECT_VOTE_REQUIRED',
      disconnectedSeat,
    });
  }

  /** Evaluate the current votes and resolve if majority reached */
  private evaluateVotes(roomCode: string): VoteOutcome {
    const session = this.sessions.get(roomCode);
    if (!session) return 'pending';

    // Count votes (need majority of 3 connected players)
    const voteCounts: Record<DisconnectVote, number> = { wait: 0, bot: 0, abandon: 0 };
    for (const [, vote] of session.votes) {
      voteCounts[vote]++;
    }

    const totalVoters = 3; // 4 players minus the disconnected one
    const majorityThreshold = 2;

    // Check for majority
    if (voteCounts.abandon >= majorityThreshold) {
      return this.resolveVote(roomCode, 'game_abandoned');
    }
    if (voteCounts.bot >= majorityThreshold) {
      return this.resolveVote(roomCode, 'replace_with_bot');
    }
    if (voteCounts.wait >= majorityThreshold) {
      return this.resolveVote(roomCode, 'waiting');
    }

    // All voted but no majority → default to replace with bot
    if (session.votes.size >= totalVoters) {
      return this.resolveVote(roomCode, 'replace_with_bot');
    }

    return 'pending';
  }

  /** Finalize a vote and notify via callback */
  private resolveVote(roomCode: string, outcome: VoteOutcome): VoteOutcome {
    const session = this.sessions.get(roomCode);
    if (!session) return outcome;

    clearTimeout(session.timeoutHandle);
    const seat = session.disconnectedSeat;
    this.sessions.delete(roomCode);

    this.onVoteResult?.(roomCode, outcome, seat);
    return outcome;
  }
}
