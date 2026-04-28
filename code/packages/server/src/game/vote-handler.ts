// REQ-F-PV22: Server-authoritative player-initiated vote logic
// REQ-F-PV13: Kick vote — unanimous from all humans except target
// REQ-F-PV14: Restart vote — unanimous from all humans
// REQ-F-PV15: Vote timeout (30s auto-fail)
// REQ-NF-PV04: Standalone class, independent of XState game state machine

import type { Seat } from '@tichu/shared';
import type { Broadcaster } from '../ws/broadcaster.js';

/** REQ-F-PV22: Vote types */
export type PlayerVoteType = 'kick' | 'restartGame' | 'restartRound';

/** State for an active player-initiated vote session */
interface PlayerVoteSession {
  voteId: string;
  voteType: PlayerVoteType;
  initiatorSeat: Seat;
  targetSeat?: Seat;
  /** Human seats eligible to vote */
  eligibleVoters: Seat[];
  /** Per-voter seat → approve (true) / reject (false) */
  votes: Map<Seat, boolean>;
  timeoutHandle: ReturnType<typeof setTimeout>;
  startedAt: number;
  timeoutMs: number;
}

/**
 * REQ-F-PV22: Manages player-initiated votes (kick player, restart game).
 *
 * Modeled after DisconnectHandler — standalone class operating independently
 * of the XState game state machine.
 *
 * Flow:
 * 1. A human player initiates a vote (kick or restart)
 * 2. Server broadcasts VOTE_STARTED to all players
 * 3. Eligible human players cast votes; each vote broadcasts VOTE_UPDATE
 * 4. Vote resolves when all eligible voters have voted, or on 30s timeout
 * 5. VOTE_RESULT broadcast with outcome; onVoteResult callback fires
 */
export class VoteHandler {
  /** Active vote sessions by room code (one per room) */
  private readonly sessions = new Map<string, PlayerVoteSession>();

  /** REQ-F-PV15: Default vote timeout in ms (30 seconds) */
  private readonly voteTimeoutMs: number;

  /** Callback when vote concludes */
  onVoteResult: ((roomCode: string, voteType: PlayerVoteType, passed: boolean, targetSeat?: Seat) => void) | null = null;

  constructor(
    private readonly broadcaster: Broadcaster,
    options?: { voteTimeoutMs?: number },
  ) {
    this.voteTimeoutMs = options?.voteTimeoutMs ?? 30_000;
  }

  /**
   * REQ-F-PV03: Start a kick vote.
   * Eligible voters: all human seats except the target.
   */
  startKickVote(roomCode: string, initiatorSeat: Seat, targetSeat: Seat, humanSeats: Seat[]): boolean {
    if (this.sessions.has(roomCode)) return false;

    const eligibleVoters = humanSeats.filter(s => s !== targetSeat);
    const session = this.createSession('kick', initiatorSeat, eligibleVoters, targetSeat);
    this.sessions.set(roomCode, session);

    // REQ-F-PV21: Broadcast VOTE_STARTED to all players
    this.broadcaster.broadcastToRoom(roomCode, {
      type: 'VOTE_STARTED',
      voteId: session.voteId,
      voteType: 'kick',
      initiatorSeat,
      targetSeat,
      timeoutMs: session.timeoutMs,
    });

    // REQ-F-PV24: If only one eligible voter, auto-pass (sole human voter)
    if (eligibleVoters.length <= 1) {
      // The initiator is the only eligible voter — auto-approve
      if (eligibleVoters.length === 1) {
        session.votes.set(eligibleVoters[0], true);
        this.broadcastVoteUpdate(roomCode);
      }
      this.resolveVote(roomCode);
      return true;
    }

    // REQ-F-PV15: Start timeout
    session.timeoutHandle = setTimeout(() => {
      this.resolveVote(roomCode);
    }, this.voteTimeoutMs);

    return true;
  }

  /**
   * REQ-F-PV04: Start a restart-game vote.
   * Eligible voters: all human seats.
   */
  startRestartGameVote(roomCode: string, initiatorSeat: Seat, humanSeats: Seat[]): boolean {
    if (this.sessions.has(roomCode)) return false;

    const eligibleVoters = [...humanSeats];
    const session = this.createSession('restartGame', initiatorSeat, eligibleVoters);
    this.sessions.set(roomCode, session);

    // REQ-F-PV21: Broadcast VOTE_STARTED
    this.broadcaster.broadcastToRoom(roomCode, {
      type: 'VOTE_STARTED',
      voteId: session.voteId,
      voteType: 'restartGame',
      initiatorSeat,
      timeoutMs: session.timeoutMs,
    });

    // REQ-F-PV24: If only one eligible voter, auto-pass
    if (eligibleVoters.length <= 1) {
      if (eligibleVoters.length === 1) {
        session.votes.set(eligibleVoters[0], true);
        this.broadcastVoteUpdate(roomCode);
      }
      this.resolveVote(roomCode);
      return true;
    }

    // REQ-F-PV15: Start timeout
    session.timeoutHandle = setTimeout(() => {
      this.resolveVote(roomCode);
    }, this.voteTimeoutMs);

    return true;
  }

  /**
   * Start a restart-round vote.
   * Same semantics as restart-game: unanimous approval from all human seats.
   */
  startRestartRoundVote(roomCode: string, initiatorSeat: Seat, humanSeats: Seat[]): boolean {
    if (this.sessions.has(roomCode)) return false;

    const eligibleVoters = [...humanSeats];
    const session = this.createSession('restartRound', initiatorSeat, eligibleVoters);
    this.sessions.set(roomCode, session);

    this.broadcaster.broadcastToRoom(roomCode, {
      type: 'VOTE_STARTED',
      voteId: session.voteId,
      voteType: 'restartRound',
      initiatorSeat,
      timeoutMs: session.timeoutMs,
    });

    if (eligibleVoters.length <= 1) {
      if (eligibleVoters.length === 1) {
        session.votes.set(eligibleVoters[0], true);
        this.broadcastVoteUpdate(roomCode);
      }
      this.resolveVote(roomCode);
      return true;
    }

    session.timeoutHandle = setTimeout(() => {
      this.resolveVote(roomCode);
    }, this.voteTimeoutMs);

    return true;
  }

  /**
   * REQ-F-PV08: Handle a vote from a player.
   * REQ-NF-PV01: Broadcasts VOTE_UPDATE after each vote for real-time feedback.
   */
  handleVote(roomCode: string, voterSeat: Seat, voteId: string, vote: boolean): void {
    const session = this.sessions.get(roomCode);
    if (!session) return;
    if (session.voteId !== voteId) return;

    // Only eligible voters can vote
    if (!session.eligibleVoters.includes(voterSeat)) return;

    session.votes.set(voterSeat, vote);

    // Broadcast update after each vote
    this.broadcastVoteUpdate(roomCode);

    // Check if all eligible voters have voted
    if (session.votes.size >= session.eligibleVoters.length) {
      this.resolveVote(roomCode);
    }
  }

  /** REQ-F-PV25: Check if a vote session is active for a room */
  hasActiveVote(roomCode: string): boolean {
    return this.sessions.has(roomCode);
  }

  /** REQ-F-PV23: Get active vote status for state projection */
  getActiveVote(roomCode: string): {
    voteId: string;
    voteType: PlayerVoteType;
    initiatorSeat: Seat;
    targetSeat?: Seat;
    votes: Record<string, boolean | null>;
    timeoutMs: number;
  } | null {
    const session = this.sessions.get(roomCode);
    if (!session) return null;

    const votes: Record<string, boolean | null> = {};
    for (const seat of session.eligibleVoters) {
      votes[seat] = session.votes.get(seat) ?? null;
    }

    const elapsed = Date.now() - session.startedAt;
    const remaining = Math.max(0, session.timeoutMs - elapsed);

    return {
      voteId: session.voteId,
      voteType: session.voteType,
      initiatorSeat: session.initiatorSeat,
      targetSeat: session.targetSeat,
      votes,
      timeoutMs: remaining,
    };
  }

  /** REQ-F-PV26: Cancel an active vote (e.g., initiator disconnected) */
  cancelVote(roomCode: string): void {
    const session = this.sessions.get(roomCode);
    if (!session) return;

    clearTimeout(session.timeoutHandle);

    // Broadcast failed result
    this.broadcaster.broadcastToRoom(roomCode, {
      type: 'VOTE_RESULT',
      voteId: session.voteId,
      voteType: session.voteType,
      passed: false,
      targetSeat: session.targetSeat,
      message: 'Vote cancelled!',
    });

    this.sessions.delete(roomCode);
    this.onVoteResult?.(roomCode, session.voteType, false, session.targetSeat);
  }

  /** Clean up all state for a room */
  cleanupRoom(roomCode: string): void {
    const session = this.sessions.get(roomCode);
    if (session) {
      clearTimeout(session.timeoutHandle);
      this.sessions.delete(roomCode);
    }
  }

  /** Clean up all state */
  dispose(): void {
    for (const [, session] of this.sessions) {
      clearTimeout(session.timeoutHandle);
    }
    this.sessions.clear();
  }

  /** Create a new vote session */
  private createSession(
    voteType: PlayerVoteType,
    initiatorSeat: Seat,
    eligibleVoters: Seat[],
    targetSeat?: Seat,
  ): PlayerVoteSession {
    return {
      voteId: generateVoteId(),
      voteType,
      initiatorSeat,
      targetSeat,
      eligibleVoters,
      votes: new Map(),
      // Placeholder — overwritten by startKickVote/startRestartVote if needed
      timeoutHandle: null as unknown as ReturnType<typeof setTimeout>,
      startedAt: Date.now(),
      timeoutMs: this.voteTimeoutMs,
    };
  }

  /**
   * REQ-F-PV13, REQ-F-PV14: Resolve a vote.
   * Passes only if ALL eligible voters approved (unanimous).
   */
  private resolveVote(roomCode: string): void {
    const session = this.sessions.get(roomCode);
    if (!session) return;

    clearTimeout(session.timeoutHandle);

    // REQ-F-PV13/PV14: Unanimous — all eligible voters must approve
    const allApproved = session.eligibleVoters.every(seat => session.votes.get(seat) === true);
    const passed = allApproved;

    // Build result message
    let message: string;
    if (session.voteType === 'kick') {
      message = passed ? '' : 'Vote Failed!'; // Kick success message set by GameManager (needs player name)
    } else if (session.voteType === 'restartRound') {
      message = passed ? 'Restarting round!' : 'Restart round vote failed!';
    } else {
      message = passed ? 'Restarting game!' : 'Restart game vote failed!';
    }

    // REQ-F-PV21: Broadcast VOTE_RESULT
    this.broadcaster.broadcastToRoom(roomCode, {
      type: 'VOTE_RESULT',
      voteId: session.voteId,
      voteType: session.voteType,
      passed,
      targetSeat: session.targetSeat,
      message,
    });

    this.sessions.delete(roomCode);
    this.onVoteResult?.(roomCode, session.voteType, passed, session.targetSeat);
  }

  /** REQ-NF-PV01: Broadcast VOTE_UPDATE with per-seat votes and remaining time */
  private broadcastVoteUpdate(roomCode: string): void {
    const status = this.getActiveVote(roomCode);
    if (!status) return;

    this.broadcaster.broadcastToRoom(roomCode, {
      type: 'VOTE_UPDATE',
      voteId: status.voteId,
      votes: status.votes,
      timeoutMs: status.timeoutMs,
    });
  }
}

/** Generate a short unique vote ID */
function generateVoteId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `vote_${timestamp}_${random}`;
}
