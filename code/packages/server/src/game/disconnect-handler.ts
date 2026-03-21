// REQ-F-ES04: Disconnect handling with Wait/Kick vote
// REQ-F-ES14: Reconnect after Wait vote
// REQ-F-ES17: Multi-player disconnect vote

import type { Seat } from '@tichu/shared';
import type { Broadcaster } from '../ws/broadcaster.js';

/** REQ-F-ES04: Vote options — Wait to keep seat reserved, Kick to vacate */
export type DisconnectVote = 'wait' | 'kick';

/** REQ-F-ES04: Result of the vote */
export type VoteOutcome = 'waiting' | 'kick' | 'pending';

/** State for a disconnect vote session (supports multi-disconnect) */
interface VoteSession {
  /** REQ-F-ES17: All disconnected seats in this session */
  disconnectedSeats: Set<Seat>;
  /** Per-voter seat → vote choice (voters can change their vote) */
  votes: Map<Seat, DisconnectVote>;
  /** Auto-kick timeout handle */
  timeoutHandle: ReturnType<typeof setTimeout>;
  /** When the vote started (for remaining time calculation) */
  startedAt: number;
}

/**
 * REQ-F-ES04: Manages player disconnection, voting, and reconnection.
 *
 * When a player disconnects during a game:
 * 1. Remaining players are notified
 * 2. A vote is initiated: Wait (keep seat reserved) or Kick (vacate seat)
 * 3. 2/3 majority required (ceil(voters/2), min 2); on 45s timeout → auto-kick
 * 4. Players can switch their vote at will; each change broadcasts DISCONNECT_VOTE_UPDATE
 * 5. REQ-F-ES17: Multiple disconnects merge into one session
 * 6. REQ-F-ES14: On reconnect with "wait" result, player auto-restores to seat
 */
export class DisconnectHandler {
  /** Active vote sessions by room code */
  private readonly sessions = new Map<string, VoteSession>();

  /** Disconnected players: roomCode → Set of seats */
  private readonly disconnected = new Map<string, Set<Seat>>();

  /** REQ-F-ES04: Default vote timeout in ms (45 seconds) */
  private readonly voteTimeoutMs: number;

  /** Callback when vote concludes — called once per session with all affected seats */
  onVoteResult: ((roomCode: string, outcome: VoteOutcome, seats: Seat[]) => void) | null = null;

  constructor(
    private readonly broadcaster: Broadcaster,
    options?: { voteTimeoutMs?: number },
  ) {
    this.voteTimeoutMs = options?.voteTimeoutMs ?? 45_000;
  }

  /** REQ-F-ES04, REQ-F-ES17: Record a player disconnection and start/extend the vote process */
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

    // REQ-F-ES17: If session already exists, add seat to it; otherwise start new
    const existingSession = this.sessions.get(roomCode);
    if (existingSession) {
      existingSession.disconnectedSeats.add(seat);
      // Remove any vote this seat may have cast (they're now disconnected)
      existingSession.votes.delete(seat);
      // Broadcast updated vote state
      this.broadcastVoteUpdate(roomCode);
    } else {
      this.startVote(roomCode, seat);
    }
  }

  /** REQ-F-ES14: Handle a player reconnecting */
  handleReconnect(roomCode: string, seat: Seat): void {
    const disconnectedSeats = this.disconnected.get(roomCode);
    if (disconnectedSeats) {
      disconnectedSeats.delete(seat);
      if (disconnectedSeats.size === 0) {
        this.disconnected.delete(roomCode);
      }
    }

    // Notify remaining players
    this.broadcaster.broadcastToRoom(roomCode, {
      type: 'PLAYER_RECONNECTED',
      seat,
    });

    // REQ-F-ES14: Cancel vote only if ALL disconnected players have reconnected
    const session = this.sessions.get(roomCode);
    if (session) {
      session.disconnectedSeats.delete(seat);
      if (session.disconnectedSeats.size === 0) {
        // All disconnected players reconnected — cancel the vote
        clearTimeout(session.timeoutHandle);
        this.sessions.delete(roomCode);
        // Broadcast that vote is resolved (implicitly by no longer sending updates)
      } else {
        // Still have disconnected players — update vote display
        this.broadcastVoteUpdate(roomCode);
      }
    }
  }

  /** REQ-F-ES04: Record a vote from a connected player. Players can switch votes freely. */
  handleVote(roomCode: string, voterSeat: Seat, vote: DisconnectVote): VoteOutcome {
    const session = this.sessions.get(roomCode);
    if (!session) return 'pending';

    // Can't vote if you're one of the disconnected players
    if (session.disconnectedSeats.has(voterSeat)) return 'pending';

    session.votes.set(voterSeat, vote);

    // Broadcast vote update after each vote change
    this.broadcastVoteUpdate(roomCode);

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

  /** Get current vote status for a room (for state projection) */
  getVoteStatus(roomCode: string): { votes: Record<string, 'wait' | 'kick' | null>; disconnectedSeats: Seat[]; timeoutMs: number } | null {
    const session = this.sessions.get(roomCode);
    if (!session) return null;

    const votes: Record<string, 'wait' | 'kick' | null> = {};
    const allSeats: Seat[] = ['north', 'east', 'south', 'west'];
    for (const seat of allSeats) {
      if (session.disconnectedSeats.has(seat)) {
        votes[seat] = null; // Disconnected players don't vote
      } else {
        votes[seat] = session.votes.get(seat) ?? null;
      }
    }

    const elapsed = Date.now() - session.startedAt;
    const remaining = Math.max(0, this.voteTimeoutMs - elapsed);

    return {
      votes,
      disconnectedSeats: Array.from(session.disconnectedSeats),
      timeoutMs: remaining,
    };
  }

  /** Check if a vote session is active for a room */
  hasActiveVote(roomCode: string): boolean {
    return this.sessions.has(roomCode);
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
    // REQ-F-ES04: Auto-kick after 45s if no 2/3 majority
    const timeoutHandle = setTimeout(() => {
      this.resolveVote(roomCode, 'kick');
    }, this.voteTimeoutMs);

    const session: VoteSession = {
      disconnectedSeats: new Set([disconnectedSeat]),
      votes: new Map(),
      timeoutHandle,
      startedAt: Date.now(),
    };

    this.sessions.set(roomCode, session);

    // REQ-F-ES04: Notify players that a vote is needed
    this.broadcaster.broadcastToRoom(roomCode, {
      type: 'DISCONNECT_VOTE_REQUIRED',
      disconnectedSeats: [disconnectedSeat],
    });

    // Also send initial vote update with empty votes
    this.broadcastVoteUpdate(roomCode);
  }

  /** REQ-F-ES04: Evaluate the current votes and resolve if majority reached */
  private evaluateVotes(roomCode: string): VoteOutcome {
    const session = this.sessions.get(roomCode);
    if (!session) return 'pending';

    // REQ-F-ES17: Dynamic voter count based on connected players
    const totalPlayers = 4;
    const voterCount = totalPlayers - session.disconnectedSeats.size;

    // Majority = ceil(voters / 2) but at least 2
    const majorityThreshold = Math.max(2, Math.ceil(voterCount / 2));

    // Count votes
    let waitVotes = 0;
    let kickVotes = 0;
    for (const [, vote] of session.votes) {
      if (vote === 'wait') waitVotes++;
      if (vote === 'kick') kickVotes++;
    }

    // Check for majority
    if (kickVotes >= majorityThreshold) {
      return this.resolveVote(roomCode, 'kick');
    }
    if (waitVotes >= majorityThreshold) {
      return this.resolveVote(roomCode, 'waiting');
    }

    // All voted but no majority → default to kick
    if (session.votes.size >= voterCount) {
      return this.resolveVote(roomCode, 'kick');
    }

    return 'pending';
  }

  /** Finalize a vote and notify via callback */
  private resolveVote(roomCode: string, outcome: VoteOutcome): VoteOutcome {
    const session = this.sessions.get(roomCode);
    if (!session) return outcome;

    clearTimeout(session.timeoutHandle);
    const seats = Array.from(session.disconnectedSeats);
    this.sessions.delete(roomCode);

    this.onVoteResult?.(roomCode, outcome, seats);
    return outcome;
  }

  /** REQ-F-ES04: Broadcast DISCONNECT_VOTE_UPDATE with per-seat votes and remaining time */
  private broadcastVoteUpdate(roomCode: string): void {
    const status = this.getVoteStatus(roomCode);
    if (!status) return;

    this.broadcaster.broadcastToRoom(roomCode, {
      type: 'DISCONNECT_VOTE_UPDATE',
      votes: status.votes,
      disconnectedSeats: status.disconnectedSeats,
      timeoutMs: status.timeoutMs,
    });
  }
}
