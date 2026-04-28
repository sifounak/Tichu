// REQ-F-CG09: Empty seats show bot controls (Add Bot button)
// REQ-F-CG11: All 4 players must confirm ready
// REQ-F-CG13: Room code visible for sharing
// REQ-F-CG14: Host can remove bots / kick players
// REQ-F-CG15: Host can change settings pre-game
// REQ-F-CG16: Start Game button in center of play area
// REQ-F-CG17: Only host sees bot controls
// REQ-F-VI11: Pre-game "Start a Vote" button with Kick Player only
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Seat, GameConfig, RoomPlayer } from '@tichu/shared';
import type { ClientGameView } from '@tichu/shared';
import { GameTable } from './GameTable';
import { PlayerSeat } from './PlayerSeat';
import { VoteOverlay } from './VoteOverlay';
import { LeaveConfirmDialog } from './LeaveConfirmDialog';
import { SeatClaimRejectedDialog, type SeatClaimRejection } from './SeatClaimRejectedDialog';
import { useUiStore } from '@/stores/uiStore';
import styles from './PreRoomView.module.css';

interface PreRoomViewProps {
  roomCode: string;
  roomName: string | null;
  mySeat: Seat | null;
  players: RoomPlayer[];
  hostSeat: Seat | null;
  config: GameConfig | null;
  readyPlayers: Seat[];
  send: (msg: Record<string, unknown>) => boolean;
  onLeave: () => void;
  /** REQ-F-ES06: Seat offer for selecting spectator (countdown, multi-seat) */
  seatOffer?: { seats: Seat[]; timeoutMs: number } | null;
  /** REQ-F-SC03: Queue status for non-selecting spectators */
  queueStatus?: { decidingSpectator: string; position: number; timeoutMs: number } | null;
  /** REQ-F-SC04: Available seats for up-for-grabs phase */
  availableSeats?: Seat[];
  onClaimSeat?: () => void;
  onDeclineSeat?: () => void;
  /** Spectator count for display */
  spectatorCount?: number;
  /** Spectator names for tooltip */
  spectatorNames?: string[];
  /** REQ-F-SJ07: Active seat-claim rejection payload from server, if any */
  seatClaimRejection?: SeatClaimRejection | null;
  /** REQ-F-SJ07: Dismiss the rejection dialog (close / background click) */
  onDismissSeatClaimRejection?: () => void;
  /** REQ-F-SJ07: Claim the user's original seat instead (offerClaimOriginal path) */
  onClaimOriginalSeat?: (seat: Seat) => void;
  /** REQ-F-BB01: When true, opens leave dialog programmatically (from back/forward button) */
  backButtonDialogOpen?: boolean;
  /** REQ-F-BB01: Called when user cancels the back-button leave dialog */
  onCancelNavigation?: () => void;
}

/** Minimal ClientGameView stub so GameTable can calculate seat positions */
function makeDummyView(mySeat: Seat): ClientGameView {
  return {
    gameId: '',
    config: { targetScore: 1000, turnTimerSeconds: null, spectatorsAllowed: true, isPrivate: false },
    phase: 'playing' as any,
    scores: { northSouth: 0, eastWest: 0 },
    roundHistory: [],
    mySeat,
    myHand: [],
    myTichuCall: 'none',
    myHasPlayed: false,
    otherPlayers: [],
    currentTrick: null,
    currentTurn: null,
    mahjongWish: null,
    wishFulfilled: false,
    finishOrder: [],
    dragonGiftPending: false,
    dragonGiftedTo: null,
    receivedCards: { north: null, east: null, south: null, west: null },
    lastDogPlay: null,
    grandTichuDecided: [],
    cardPassConfirmed: [],
    vacatedSeats: [],
    choosingSeat: false,
    disconnectVotes: {},
    gameHalted: false,
    winner: null,
  };
}

export function PreRoomView({
  roomCode,
  roomName,
  mySeat,
  players,
  hostSeat,
  config,
  readyPlayers,
  send,
  onLeave,
  seatOffer,
  queueStatus,
  availableSeats,
  onClaimSeat,
  onDeclineSeat,
  spectatorCount = 0,
  spectatorNames = [],
  seatClaimRejection = null,
  onDismissSeatClaimRejection,
  onClaimOriginalSeat,
  backButtonDialogOpen,
  onCancelNavigation,
}: PreRoomViewProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  // REQ-F-VI11: Pre-game vote state
  const [showVoteDropdown, setShowVoteDropdown] = useState(false);
  const voteDropdownRef = useRef<HTMLDivElement>(null);
  const [preGameKickTargetMode, setPreGameKickTargetMode] = useState(false);
  const uiStore = useUiStore();

  // REQ-F-SC02: Countdown timer for seat offer / queue status
  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    const timeoutMs = seatOffer?.timeoutMs ?? queueStatus?.timeoutMs;
    if (!timeoutMs) { setCountdown(0); return; }
    setCountdown(Math.ceil(timeoutMs / 1000));
    const interval = setInterval(() => {
      setCountdown((prev) => {
        const next = Math.max(0, prev - 1);
        // Auto-dismiss seat offer when countdown expires (treat as timeout)
        if (next === 0 && seatOffer && onDeclineSeat) {
          onDeclineSeat();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [seatOffer, queueStatus, onDeclineSeat]);

  const isSpectator = mySeat === null;
  const isHost = mySeat === hostSeat;
  const amReady = mySeat ? readyPlayers.includes(mySeat) : false;
  // Spectators always see compass layout (N top, S bottom, W left, E right)
  const effectiveSeat = mySeat ?? 'south';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleAddBot = (seat: Seat) => {
    send({ type: 'ADD_BOT', seat });
  };

  const handleRemoveBot = (seat: Seat) => {
    send({ type: 'REMOVE_BOT', seat });
  };

  const handleKickPlayer = (seat: Seat) => {
    send({ type: 'KICK_PLAYER', seat });
  };

  const handleReadyToStart = () => {
    send({ type: 'READY_TO_START' });
  };

  const handleCancelReady = () => {
    send({ type: 'CANCEL_READY' });
  };

  // REQ-F-VI12: Pre-game kick target selection — send PRE_GAME_KICK_VOTE
  const handlePreGameKickTarget = (seat: Seat) => {
    if (seat === mySeat) return; // Cannot kick self
    setPreGameKickTargetMode(false);
    send({ type: 'PRE_GAME_KICK_VOTE', targetSeat: seat });
  };

  // REQ-F-VI12: Escape cancels kick target mode
  useEffect(() => {
    if (!preGameKickTargetMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreGameKickTargetMode(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [preGameKickTargetMode]);

  // Click outside vote dropdown to dismiss
  useEffect(() => {
    if (!showVoteDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (voteDropdownRef.current && !voteDropdownRef.current.contains(e.target as Node)) {
        setShowVoteDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showVoteDropdown]);

  // Build seat→name mapping for VoteOverlay
  const SEAT_LABELS: Record<string, string> = { north: 'North', east: 'East', south: 'South', west: 'West' };
  const seatNames = {
    north: players.find(p => p.seat === 'north')?.name ?? SEAT_LABELS.north,
    east: players.find(p => p.seat === 'east')?.name ?? SEAT_LABELS.east,
    south: players.find(p => p.seat === 'south')?.name ?? SEAT_LABELS.south,
    west: players.find(p => p.seat === 'west')?.name ?? SEAT_LABELS.west,
  } as Record<Seat, string>;

  const handleConfigChange = (updates: Record<string, unknown>) => {
    send({ type: 'CONFIGURE_ROOM', config: updates });
  };

  // Find player name for a given seat
  const getPlayerName = (seat: Seat) => {
    return players.find((p) => p.seat === seat)?.name;
  };

  const handleSwapSeat = (seat: Seat) => {
    send({ type: 'SWAP_SEATS', targetSeat: seat });
  };

  // Seat renderer: all seats use PlayerSeat — customContent for empty/bot seats
  const renderSeat = useCallback((seat: Seat) => {
    const player = players.find((p) => p.seat === seat);
    const isReady = readyPlayers.includes(seat);

    // Player's own seat — rendered in the bottom panel, not here
    if (seat === mySeat) return null;

    // Human player — standard PlayerSeat with kick button for host
    if (player && !player.isBot) {
      return (
        <PlayerSeat
          seat={seat}
          displayName={player.name}
          cardCount={0}
          tichuCall={'none'}
          hasPlayed={false}
          hasPassed={false}
          finishOrder={null}
          isCurrentTurn={false}
          isTrickLeader={false}
          isMe={false}
          passConfirmed={isReady}
          passConfirmedLabel="Ready to Play"
          kickVoteTarget={preGameKickTargetMode}
          onSeatClick={preGameKickTargetMode ? () => handlePreGameKickTarget(seat) : undefined}
          customContent={isHost ? (
            <div className={styles.botSeatContent}>
              <span className={styles.botName}>{player.name}</span>
              <button onClick={() => handleKickPlayer(seat)} className={styles.removeBtn}>
                Kick
              </button>
            </div>
          ) : undefined}
        />
      );
    }

    // Bot — PlayerSeat with custom content: bot name + remove button
    if (player?.isBot) {
      return (
        <PlayerSeat
          seat={seat}
          displayName={player.name}
          cardCount={0}
          tichuCall={'none'}
          hasPlayed={false}
          hasPassed={false}
          finishOrder={null}
          isCurrentTurn={false}
          isTrickLeader={false}
          isMe={false}
          passConfirmed={isReady}
          passConfirmedLabel="Ready to Play"
          kickVoteTarget={preGameKickTargetMode}
          onSeatClick={preGameKickTargetMode ? () => handlePreGameKickTarget(seat) : undefined}
          customContent={
            <div className={styles.botSeatContent}>
              <span className={styles.botName}>{player.name}</span>
              {isHost && (
                <button onClick={() => handleRemoveBot(seat)} className={styles.removeBtn}>
                  Remove Bot
                </button>
              )}
            </div>
          }
        />
      );
    }

    // Empty seat — PlayerSeat with custom content: Empty Seat + Claim/Sit Here + Add Bot
    // REQ-F-SC01: Spectators see "Claim Seat" that sends CLAIM_SEAT; players see "Sit Here" that sends SWAP_SEATS
    return (
      <PlayerSeat
        seat={seat}
        cardCount={0}
        tichuCall={'none'}
        hasPlayed={false}
        hasPassed={false}
        finishOrder={null}
        isCurrentTurn={false}
        isTrickLeader={false}
        isMe={false}
        customContent={
          <div className={styles.emptySeatContent}>
            <span className={styles.emptyTitle}>Empty Seat</span>
            {isSpectator ? (
              (seatOffer?.seats.includes(seat) || availableSeats?.includes(seat)) ? (
                <button onClick={() => send({ type: 'CLAIM_SEAT' })} className={styles.sitHereBtn}>
                  Claim Seat
                </button>
              ) : null
            ) : (
              <button onClick={() => handleSwapSeat(seat)} className={styles.sitHereBtn}>
                Sit Here
              </button>
            )}
            {isHost && (
              <button onClick={() => handleAddBot(seat)} className={styles.addBotBtn}>
                Add Bot
              </button>
            )}
          </div>
        }
      />
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, mySeat, hostSeat, readyPlayers, isHost, seatOffer, availableSeats, preGameKickTargetMode]);

  // Helper for ordinal suffixes (1st, 2nd, 3rd, 4th, ...)
  const ordinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // Center content: spectators see seat claim dialog / queue status / up-for-grabs; players see Start Game / Ready + Cancel
  const centerContent = (
    <div className={styles.centerContent}>
      {isSpectator ? (
        // REQ-F-SC02: Selecting spectator sees dialog with Pass / Claim Seat + countdown
        seatOffer ? (
          <div style={{
            background: 'var(--color-bg-panel)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--space-3)',
            padding: 'var(--space-5) var(--space-6)',
            textAlign: 'center' as const,
          }}>
            <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-4)', color: 'var(--color-text-primary)' }}>
              A seat has opened up!
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
              <button
                onClick={onDeclineSeat}
                style={{
                  padding: 'var(--space-2) var(--space-5)',
                  borderRadius: 'var(--space-2)',
                  border: '1px solid var(--color-border)',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-md)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Pass
              </button>
              <button
                onClick={onClaimSeat}
                style={{
                  padding: 'var(--space-2) var(--space-5)',
                  borderRadius: 'var(--space-2)',
                  border: 'none',
                  background: 'var(--color-gold-accent)',
                  color: 'var(--color-felt-green-dark)',
                  fontSize: 'var(--font-md)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Claim Seat
              </button>
            </div>
            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>
              {countdown} seconds to decide
            </div>
          </div>
        ) : queueStatus ? (
          // REQ-F-SC03: Non-selecting spectators see queue position + countdown (position 0 = passed)
          <div style={{ textAlign: 'center' as const }}>
            {queueStatus.position === 0 ? (
              <div style={{ fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                Waiting for other spectators to claim a seat...
              </div>
            ) : (
              <>
                <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--color-gold-accent)', marginBottom: 'var(--space-1)' }}>
                  A seat has opened up!
                </div>
                <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--color-gold-accent)', marginBottom: 'var(--space-2)' }}>
                  You are {ordinal(queueStatus.position)} in line
                </div>
                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>
                  Moving to next spectator in {countdown} seconds...
                </div>
              </>
            )}
          </div>
        ) : (availableSeats && availableSeats.length > 0) ? (
          // REQ-F-SC04: Up-for-grabs — all spectators declined, first come first served
          <div style={{
            background: 'var(--color-bg-panel)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--space-3)',
            padding: 'var(--space-5) var(--space-6)',
            textAlign: 'center' as const,
          }}>
            <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-2)', color: 'var(--color-text-primary)' }}>
              Seats Up for Grabs!
            </div>
            <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', fontSize: 'var(--font-md)' }}>
              First come, first served
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
              <button
                onClick={onClaimSeat}
                style={{
                  padding: 'var(--space-2) var(--space-5)',
                  borderRadius: 'var(--space-2)',
                  border: 'none',
                  background: 'var(--color-gold-accent)',
                  color: 'var(--color-felt-green-dark)',
                  fontSize: 'var(--font-md)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Claim Seat
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.waitingText}>Waiting for game to start...</div>
        )
      ) : (
        <>
          {!amReady && (
            <button onClick={handleReadyToStart} className={styles.startBtn}>
              Start Game
            </button>
          )}
          {amReady && (
            <>
              <div className={styles.readyWaiting}>Ready — Waiting...</div>
              <button onClick={handleCancelReady} className={styles.cancelBtn}>
                Cancel
              </button>
            </>
          )}
        </>
      )}
    </div>
  );

  const dummyView = makeDummyView(effectiveSeat);

  return (
    <>
      {/* Room code + Spectators + Leave — same position as in-game */}
      <div style={{
        position: 'fixed',
        top: 'calc(120px * var(--scale))',
        left: 'calc(148px * var(--scale))',
        transform: 'translate(-50%, -50%)',
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-1)',
      }}>
        {/* REQ-F-CG13: Room name */}
        <div className={styles.roomName}>{roomName ?? 'Room'}</div>

        {/* Spectating badge */}
        {isSpectator && (
          <div style={{
            background: 'var(--color-gold-accent)',
            color: 'var(--color-felt-green-dark)',
            padding: 'var(--space-1) var(--space-3)',
            borderRadius: 'var(--card-border-radius)',
            fontSize: 'calc(26px * var(--scale))',
            fontWeight: 700,
            textAlign: 'center' as const,
            width: '100%',
          }}>
            Spectating
          </div>
        )}

        <button
          onClick={handleCopyCode}
          style={{
            fontSize: 'var(--font-xl)',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            textAlign: 'center' as const,
            background: 'transparent',
            border: '1px solid transparent',
            borderRadius: 'var(--card-border-radius)',
            padding: 'var(--space-1) var(--space-3)',
            cursor: 'pointer',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
          aria-label="Copy room code"
        >
          Room Code: <span style={{ fontFamily: 'monospace', fontWeight: 900, letterSpacing: '0.15em', color: 'var(--color-gold-accent)' }}>{roomCode}</span>
        </button>

        {/* Spectator count button with tooltip */}
        <div
          style={{ position: 'relative' }}
          onMouseEnter={(e) => {
            const btn = e.currentTarget.querySelector('button') as HTMLElement;
            const tip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement;
            if (btn) { btn.style.borderColor = 'var(--color-border)'; btn.style.background = 'rgba(255,255,255,0.1)'; }
            if (tip) tip.style.display = 'block';
          }}
          onMouseLeave={(e) => {
            const btn = e.currentTarget.querySelector('button') as HTMLElement;
            const tip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement;
            if (btn) { btn.style.borderColor = 'transparent'; btn.style.background = 'transparent'; }
            if (tip) tip.style.display = 'none';
          }}
        >
          <button
            style={{
              fontSize: 'var(--font-xl)',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              textAlign: 'center' as const,
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: 'var(--card-border-radius)',
              padding: 'var(--space-1) var(--space-3)',
              cursor: 'default',
              transition: 'border-color 0.2s',
            }}
          >
            Spectators: <span style={{ color: 'var(--color-gold-accent)', fontWeight: 900 }}>{spectatorCount}</span>
          </button>
          {spectatorNames.length > 0 && (
            <div data-tooltip style={{
              display: 'none',
              position: 'absolute',
              top: 0,
              left: '100%',
              marginLeft: 'var(--space-1)',
              minWidth: '100%',
              background: 'rgb(0,0,0)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--card-border-radius)',
              padding: 'var(--space-2) var(--space-3)',
              fontSize: 'var(--font-xl)',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              whiteSpace: 'nowrap',
              zIndex: 40,
              boxSizing: 'border-box',
            }}>
              {spectatorNames.map((name, i) => (
                <div key={i}>{name}</div>
              ))}
            </div>
          )}
        </div>

        {/* REQ-F-VI11: Pre-game "Start a Vote" button — only Kick Player option */}
        {!isSpectator && mySeat && players.length >= 2 && !uiStore.activeVote && (
          <div ref={voteDropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowVoteDropdown(!showVoteDropdown); setPreGameKickTargetMode(false); }}
              style={{
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: 'var(--card-border-radius)',
                color: 'var(--color-text-secondary)',
                padding: 'var(--space-1) var(--space-3)',
                fontSize: 'var(--font-xl)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
              aria-label="Start a vote"
            >
              Start a Vote
            </button>
            {showVoteDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '100%',
                  marginLeft: 'var(--space-1)',
                  background: 'rgb(0,0,0)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--card-border-radius)',
                  padding: 'var(--space-1) 0',
                  zIndex: 50,
                  minWidth: '100%',
                  whiteSpace: 'nowrap',
                }}
              >
                <button
                  onClick={() => { setShowVoteDropdown(false); setPreGameKickTargetMode(true); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-primary)',
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: 'var(--font-base)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Kick Player
                </button>
              </div>
            )}
          </div>
        )}

        {/* REQ-F-VI12: Kick target mode cancel hint */}
        {preGameKickTargetMode && (
          <div style={{
            fontSize: 'var(--font-sm)',
            color: 'var(--color-gold-accent)',
            fontWeight: 600,
            textAlign: 'center',
          }}>
            Click a player to kick (Esc to cancel)
          </div>
        )}

        {/* REQ-F-LRC01: Confirmation dialog before leaving room in pre-game */}
        <LeaveConfirmDialog
          title="Leave Room?"
          subtitle=""
          onConfirm={onLeave}
          externalOpen={backButtonDialogOpen}
          onClose={onCancelNavigation}
        >
          {(openDialog) => (
            <button
              onClick={openDialog}
              style={{
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: 'var(--card-border-radius)',
                color: 'var(--color-text-secondary)',
                padding: 'var(--space-1) var(--space-3)',
                fontSize: 'var(--font-xl)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
              aria-label="Leave room"
            >
              Leave Room
            </button>
          )}
        </LeaveConfirmDialog>

        {/* Copy toast — positioned to the right so it doesn't shift buttons */}
        {codeCopied && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: '100%',
            marginLeft: 'var(--space-2)',
            background: 'var(--color-bg-panel)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--card-border-radius)',
            padding: 'var(--space-1) var(--space-3)',
            fontSize: 'var(--font-md)',
            color: 'var(--color-text-primary)',
            whiteSpace: 'nowrap',
          }}>
            Room code copied to clipboard
          </div>
        )}
      </div>

      {/* REQ-F-CG15: Settings toggle */}
      <button onClick={() => setShowSettings(!showSettings)} className={styles.settingsToggle}>
        Settings
      </button>

      {showSettings && config && (
        <div className={styles.settingsPanel}>
          <div className={styles.settingsTitle}>Game Settings</div>
          {isHost ? (
            <div className={styles.settingsGrid}>
              <label className={styles.settingsField}>
                <span className={styles.settingsLabel}>Target Score</span>
                <input
                  type="number"
                  value={config.targetScore}
                  onChange={(e) => handleConfigChange({ targetScore: parseInt(e.target.value) || 1000 })}
                  min={100} max={10000} step={100}
                  className={styles.settingsInput}
                />
              </label>
              <label className={styles.settingsField}>
                <span className={styles.settingsLabel}>Turn Timer</span>
                <select
                  value={config.turnTimerSeconds ?? 'off'}
                  onChange={(e) => handleConfigChange({
                    turnTimerSeconds: e.target.value === 'off' ? null : parseInt(e.target.value),
                  })}
                  className={styles.settingsSelect}
                >
                  <option value="off">Off</option>
                  <option value="30">30s</option>
                  <option value="60">60s</option>
                  <option value="90">90s</option>
                </select>
              </label>
              <label className={styles.settingsCheckRow}>
                <input
                  type="checkbox"
                  checked={config.isPrivate}
                  onChange={(e) => handleConfigChange({ isPrivate: e.target.checked })}
                />
                <span className={styles.settingsCheckLabel}>Private</span>
              </label>
              <label className={styles.settingsCheckRow}>
                <input
                  type="checkbox"
                  checked={config.spectatorsAllowed}
                  onChange={(e) => handleConfigChange({ spectatorsAllowed: e.target.checked })}
                />
                <span className={styles.settingsCheckLabel}>Spectators</span>
              </label>
            </div>
          ) : (
            <div className={styles.summaryGrid}>
              <span>Target: {config.targetScore} pts</span>
              <span>Timer: {config.turnTimerSeconds ? `${config.turnTimerSeconds}s` : 'Off'}</span>
              <span>{config.isPrivate ? 'Private' : 'Public'}</span>
              <span>Spectators: {config.spectatorsAllowed ? 'Yes' : 'No'}</span>
            </div>
          )}
        </div>
      )}

      {/* Game table with pre-room seat rendering and center content */}
      <GameTable
        view={dummyView}
        hideCenter={false}
        compassLayout={isSpectator}
        renderSeatOverride={renderSeat}
        centerContent={centerContent}
        bottomContent={isSpectator ? renderSeat('south') : undefined}
      />

      {/* Bottom panel — player's own seat, positioned where it sits during gameplay
           (above where the card hand would be) */}
      {mySeat && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(200px * var(--scale))',
          left: 0,
          right: 0,
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <PlayerSeat
            seat={effectiveSeat}
            displayName={getPlayerName(effectiveSeat)}
            cardCount={0}
            tichuCall={'none'}
            hasPlayed={false}
            hasPassed={false}
            finishOrder={null}
            isCurrentTurn={false}
            isTrickLeader={false}
            isMe={true}
            passConfirmed={amReady}
            passConfirmedLabel="Ready to Play"
          />
        </div>
      )}
      {/* REQ-F-VI13: Pre-game vote overlay */}
      {uiStore.activeVote && (
        <VoteOverlay
          activeVote={uiStore.activeVote}
          mySeat={mySeat ?? 'south'}
          countdownSeconds={uiStore.voteCountdown}
          seatNames={seatNames}
          onVote={(voteId, vote) => send({ type: 'PRE_GAME_VOTE', voteId, vote })}
          readOnly={isSpectator}
        />
      )}

      {/* REQ-F-SJ07: Seat-claim rejection dialog with optional reclaim-original action */}
      <SeatClaimRejectedDialog
        rejection={seatClaimRejection}
        onClose={onDismissSeatClaimRejection ?? (() => {})}
        onClaimOriginal={onClaimOriginalSeat ?? (() => {})}
      />

      {/* REQ-F-VI13: Pre-game vote result center status */}
      {uiStore.voteResult && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 100,
          background: 'rgb(0,0,0)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--space-3)',
          padding: 'var(--space-4) var(--space-6)',
          fontSize: 'var(--font-lg)',
          fontWeight: 700,
          color: uiStore.voteResult.passed ? 'var(--color-gold-accent)' : '#e74c3c',
          textAlign: 'center',
        }}>
          {uiStore.voteResult.message}
        </div>
      )}
    </>
  );
}
