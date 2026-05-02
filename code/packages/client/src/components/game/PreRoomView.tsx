// REQ-F-CG09: Empty seats show bot controls (Add Bot button)
// REQ-F-CG11: All 4 players must confirm ready
// REQ-F-CG14: Host can remove bots / kick players
// REQ-F-CG15: Host can change settings pre-game
// REQ-F-CG16: Start Game button in center of play area
// REQ-F-CG17: Only host sees bot controls
// REQ-F-GA01-06: Room name click copies URL, spectators display
// REQ-F-GA07-10: Kebab menu replaces Start a Vote + Settings
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Seat, GameConfig, RoomPlayer } from '@tichu/shared';
import type { ClientGameView } from '@tichu/shared';
import type { LayoutTier } from '@/hooks/useLayoutTier';
import { GameTable } from './GameTable';
import { GameSettingsForm } from '@/components/ui/GameSettingsForm';
import { PlayerSeat } from './PlayerSeat';
import { VoteOverlay } from './VoteOverlay';
import { LeaveConfirmDialog } from './LeaveConfirmDialog';
import { SeatClaimRejectedDialog, type SeatClaimRejection } from './SeatClaimRejectedDialog';
import { GameActionsMenu, type MenuAction } from './GameActionsMenu';
import { GameActionsDrawer } from './GameActionsDrawer';
import { ActionConfirmDialog, type ConfirmDialogAction } from './ActionConfirmDialog';
import { useUiStore, isOnCooldown, getCooldownRemaining } from '@/stores/uiStore';
import { useRoomStore } from '@/stores/roomStore';
import styles from './PreRoomView.module.css';

// REQ-F-GA49: Allow self-kick (set to false to disallow)
const ALLOW_SELF_KICK = true;

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
  /** Current layout tier for responsive behavior */
  layoutTier?: LayoutTier;
}

/** Minimal ClientGameView stub so GameTable can calculate seat positions */
function makeDummyView(mySeat: Seat): ClientGameView {
  return {
    gameId: '',
    config: { targetScore: 1000, turnTimerSeconds: null, spectatorsAllowed: true, isPrivate: false, spectatorChatEnabled: false },
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
  roomCode: _roomCode,
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
  layoutTier = 'full',
}: PreRoomViewProps) {
  const [showSettings, setShowSettings] = useState(false);
  // REQ-F-GA01: URL copy toast state
  const [urlCopied, setUrlCopied] = useState(false);
  const [preGameKickTargetMode, setPreGameKickTargetMode] = useState(false);
  // REQ-F-GA25: Transfer host target mode
  const [transferHostTargetMode, setTransferHostTargetMode] = useState(false);
  // REQ-F-GA09: Mobile drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<ConfirmDialogAction | null>(null);
  const [confirmTargetSeat, setConfirmTargetSeat] = useState<Seat | null>(null);
  const uiStore = useUiStore();
  const votingEnabled = useRoomStore((s) => s.votingEnabled);

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
  const isMobileLayout = layoutTier !== 'full';

  // REQ-F-GA01: Copy game URL to clipboard
  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
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

  // REQ-F-GA13: Pre-game kick target selection — show confirmation dialog
  const handlePreGameKickTarget = (seat: Seat) => {
    if (!ALLOW_SELF_KICK && seat === mySeat) return;
    setPreGameKickTargetMode(false);
    const targetName = getPlayerName(seat) ?? seat;
    setConfirmTargetSeat(seat);
    setConfirmAction({ type: 'kick', targetName });
  };

  // REQ-F-GA25: Transfer host target selection — show confirmation dialog
  const handleTransferHostTarget = (seat: Seat) => {
    const player = players.find(p => p.seat === seat);
    if (!player || player.isBot || seat === mySeat) return;
    setTransferHostTargetMode(false);
    const targetName = player.name;
    setConfirmTargetSeat(seat);
    setConfirmAction({ type: 'transferHost', targetName });
  };

  // Escape cancels kick/transfer target mode
  useEffect(() => {
    if (!preGameKickTargetMode && !transferHostTargetMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreGameKickTargetMode(false);
        setTransferHostTargetMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [preGameKickTargetMode, transferHostTargetMode]);

  // REQ-F-GA07-10: Menu action handler
  const handleMenuAction = useCallback((action: MenuAction) => {
    // REQ-F-GA42: Opening menu cancels target selection
    setPreGameKickTargetMode(false);
    setTransferHostTargetMode(false);

    switch (action.type) {
      case 'kickPlayer':
        setPreGameKickTargetMode(true);
        break;
      case 'transferHost':
        setTransferHostTargetMode(true);
        break;
      case 'gameSettings':
        setShowSettings(true);
        break;
      case 'toggleVoting':
        send({ type: 'TOGGLE_VOTING' });
        break;
      case 'cancelVote':
        send({ type: 'CANCEL_VOTE' });
        break;
    }
  }, [send]);

  // Confirmation dialog callbacks
  const handleConfirmStartVote = useCallback(() => {
    if (!confirmTargetSeat || !confirmAction) return;
    if (confirmAction.type === 'kick') {
      send({ type: 'PRE_GAME_KICK_VOTE', targetSeat: confirmTargetSeat });
    }
    setConfirmAction(null);
    setConfirmTargetSeat(null);
  }, [confirmTargetSeat, confirmAction, send]);

  const handleConfirmForceAction = useCallback(() => {
    if (!confirmAction) return;
    if (confirmAction.type === 'kick' && confirmTargetSeat) {
      send({ type: 'FORCE_KICK', targetSeat: confirmTargetSeat });
    } else if (confirmAction.type === 'transferHost' && confirmTargetSeat) {
      send({ type: 'TRANSFER_HOST', targetSeat: confirmTargetSeat });
    }
    setConfirmAction(null);
    setConfirmTargetSeat(null);
  }, [confirmAction, confirmTargetSeat, send]);

  const handleConfirmCancel = useCallback(() => {
    setConfirmAction(null);
    setConfirmTargetSeat(null);
  }, []);

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

    // Determine if seat should be clickable (kick target or transfer host target mode)
    const isTargetMode = preGameKickTargetMode || transferHostTargetMode;
    const handleSeatClick = isTargetMode ? () => {
      if (preGameKickTargetMode) handlePreGameKickTarget(seat);
      else if (transferHostTargetMode) handleTransferHostTarget(seat);
    } : undefined;

    // Human player — host sees name + kick button; non-host sees name + avatar
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
          kickVoteTarget={isTargetMode}
          onSeatClick={handleSeatClick}
          customContent={isHost ? (
            <div className={styles.botSeatContent}>
              <span className={styles.botName}>{player.name}</span>
              <button onClick={() => handleKickPlayer(seat)} className={styles.removeBtn}>
                Kick
              </button>
            </div>
          ) : (
            <div className={styles.botSeatContent}>
              <span className={styles.botName}>{player.name}</span>
              <div className={styles.seatAvatar}>
                {player.name[0].toUpperCase()}
              </div>
            </div>
          )}
        />
      );
    }

    // Bot — host sees name + remove button; non-host sees name + avatar
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
          kickVoteTarget={isTargetMode}
          onSeatClick={handleSeatClick}
          customContent={
            <div className={styles.botSeatContent}>
              <span className={styles.botName}>{player.name}</span>
              {isHost ? (
                <button onClick={() => handleRemoveBot(seat)} className={styles.removeBtn}>
                  Remove Bot
                </button>
              ) : (
                <div className={styles.seatAvatar}>
                  {player.name[0].toUpperCase()}
                </div>
              )}
            </div>
          }
        />
      );
    }

    // Empty seat — host sees "Empty Seat" + Sit Here/Add Bot buttons;
    // non-host sees "Empty Seat" + blank avatar + Sit Here button
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
            <div className={styles.emptySeatButtons}>
              {isSpectator ? (
                (seatOffer?.seats.includes(seat) || availableSeats?.includes(seat)) ? (
                  <button onClick={() => send({ type: 'CLAIM_SEAT' })} className={styles.sitHereBtn}>
                    Claim<br />Seat
                  </button>
                ) : null
              ) : (
                <button onClick={() => handleSwapSeat(seat)} className={styles.sitHereBtn}>
                  Sit<br />Here
                </button>
              )}
              {isHost && (
                <button onClick={() => handleAddBot(seat)} className={styles.addBotBtn}>
                  Add<br />Bot
                </button>
              )}
            </div>
          </div>
        }
      />
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, mySeat, hostSeat, readyPlayers, isHost, seatOffer, availableSeats, preGameKickTargetMode, transferHostTargetMode]);

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
      {/* Desktop top-left chrome: Room Name, Spectating badge, Spectators, Kebab menu, Leave Room */}
      <div style={{
        position: 'fixed',
        top: 'calc(120px * var(--scale))',
        left: 'calc(148px * var(--scale))',
        transform: 'translate(-50%, -50%)',
        zIndex: 30,
        display: isMobileLayout ? 'none' : 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-1)',
      }}>
        {/* REQ-F-GA01: Room name — click to copy URL */}
        <button
          onClick={handleCopyUrl}
          className={styles.roomName}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'none',
            transition: 'text-decoration 0.15s',
            position: 'relative',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
          onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
          aria-label="Copy game link"
          title="Click to copy game link"
        >
          {roomName ?? 'Room'}
        </button>

        {/* REQ-F-GA02: "Link copied!" toast */}
        {urlCopied && (
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
            Link copied!
          </div>
        )}

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

        {/* REQ-F-GA05, GA06: Spectator count with tooltip */}
        <div
          style={{ position: 'relative' }}
          onMouseEnter={(e) => {
            const tip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement;
            if (tip) tip.style.display = 'block';
          }}
          onMouseLeave={(e) => {
            const tip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement;
            if (tip) tip.style.display = 'none';
          }}
        >
          <span style={{
            fontSize: 'var(--font-xl)',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            padding: 'var(--space-1) var(--space-3)',
          }}>
            Spectators: <span style={{ color: 'var(--color-gold-accent)', fontWeight: 900 }}>{spectatorCount}</span>
          </span>
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

        {/* REQ-F-GA07: Kebab menu (desktop popover) */}
        <GameActionsMenu
          isHost={isHost}
          isSpectator={isSpectator}
          isPreGame={true}
          votingEnabled={votingEnabled}
          activeVote={uiStore.activeVote}
          mySeat={mySeat}
          onAction={handleMenuAction}
          isOnCooldown={isOnCooldown}
          getCooldownRemaining={getCooldownRemaining}
        />

        {/* Target mode cancel hints */}
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
        {transferHostTargetMode && (
          <div style={{
            fontSize: 'var(--font-sm)',
            color: 'var(--color-gold-accent)',
            fontWeight: 600,
            textAlign: 'center',
          }}>
            Click a player to transfer host (Esc to cancel)
          </div>
        )}

        {/* REQ-F-GA33: Leave Game standalone button */}
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
      </div>

      {/* REQ-F-CG15: Settings panel (opened via menu) */}
      {showSettings && config && (
        <div
          className={styles.settingsBackdrop}
          onClick={() => setShowSettings(false)}
        >
          <div className={styles.settingsPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.settingsTitle}>Game Settings</div>
            <GameSettingsForm
              config={config}
              onChange={handleConfigChange}
              readOnly={!isHost}
            />
          </div>
        </div>
      )}

      {/* Mobile top-left chrome: [Spectating] [Room Name] [# watching] / [⋮ kebab] / [Leave Game] */}
      {isMobileLayout && (
        <div style={{
          position: 'fixed',
          top: 'var(--space-1)',
          left: 'var(--space-2)',
          zIndex: 30,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 'var(--space-1)',
        }}>
          {/* Row 1: [Spectating] [Room Name] [# watching] */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {isSpectator && (
              <span style={{
                background: 'var(--color-gold-accent)',
                color: 'var(--color-felt-green-dark)',
                padding: '2px var(--space-2)',
                borderRadius: 'var(--card-border-radius)',
                fontSize: 'var(--font-sm)',
                fontWeight: 700,
              }}>
                Spectating
              </span>
            )}
            {/* REQ-F-GA01: Room name — click to copy URL */}
            <button
              onClick={handleCopyUrl}
              style={{
                fontSize: 'var(--font-sm)',
                fontWeight: 700,
                color: urlCopied ? 'var(--color-text-primary)' : 'var(--color-gold-accent)',
                background: 'var(--color-bg-panel)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--card-border-radius)',
                padding: '2px var(--space-2)',
                cursor: 'pointer',
              }}
              aria-label="Copy game link"
            >
              {urlCopied ? 'Link copied!' : (roomName ?? 'Room')}
            </button>
            <span style={{
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
            }}>
              {spectatorCount} watching
            </span>
          </div>

          {/* Row 2: Kebab menu button (opens drawer) or Cancel Vote */}
          {uiStore.activeVote && (isHost || (mySeat && uiStore.activeVote.initiatorSeat === mySeat)) ? (
            <button
              onClick={() => send({ type: 'CANCEL_VOTE' })}
              style={{
                fontSize: 'var(--font-sm)',
                fontWeight: 600,
                color: '#dc2626',
                background: 'var(--color-bg-panel)',
                border: '1px solid #dc2626',
                borderRadius: 'var(--card-border-radius)',
                padding: '2px var(--space-2)',
                cursor: 'pointer',
              }}
            >
              Cancel Vote
            </button>
          ) : (
            <button
              onClick={() => {
                // REQ-F-GA42: Opening menu cancels target selection
                setPreGameKickTargetMode(false);
                setTransferHostTargetMode(false);
                setDrawerOpen(true);
              }}
              style={{
                fontSize: 'var(--font-sm)',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                background: 'var(--color-bg-panel)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--card-border-radius)',
                padding: '2px var(--space-2)',
                cursor: 'pointer',
                lineHeight: 1,
              }}
              title="Game Actions"
            >
              &#x22EE;
            </button>
          )}

          {/* Target mode hints */}
          {preGameKickTargetMode && (
            <div style={{
              fontSize: 'var(--font-sm)',
              color: 'var(--color-gold-accent)',
              fontWeight: 600,
            }}>
              Click a player to kick (Esc to cancel)
            </div>
          )}
          {transferHostTargetMode && (
            <div style={{
              fontSize: 'var(--font-sm)',
              color: 'var(--color-gold-accent)',
              fontWeight: 600,
            }}>
              Click a player to transfer host (Esc to cancel)
            </div>
          )}

          {/* Row 3: Leave Game */}
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
                  fontSize: 'var(--font-sm)',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  background: 'var(--color-bg-panel)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--card-border-radius)',
                  padding: '2px var(--space-2)',
                  cursor: 'pointer',
                }}
                aria-label="Leave room"
              >
                Leave Game
              </button>
            )}
          </LeaveConfirmDialog>
        </div>
      )}

      {/* REQ-F-GA09: Mobile drawer */}
      <GameActionsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        isHost={isHost}
        isSpectator={isSpectator}
        isPreGame={true}
        votingEnabled={votingEnabled}
        onAction={(action) => {
          setDrawerOpen(false);
          handleMenuAction(action);
        }}
        activeVote={uiStore.activeVote}
        mySeat={mySeat}
        isOnCooldown={isOnCooldown}
        getCooldownRemaining={getCooldownRemaining}
      />

      <GameTable
        view={dummyView}
        hideCenter={false}
        compassLayout={isSpectator}
        renderSeatOverride={renderSeat}
        centerContent={centerContent}
        bottomContent={isSpectator ? renderSeat('south') : undefined}
        layoutTier={layoutTier}
      />

      {/* Bottom panel — player's own seat.
           Full layout: above where the card hand would be.
           Compact/mobile: centered where the card hand would be (lower). */}
      {mySeat && (
        <div style={{
          position: 'fixed',
          bottom: isMobileLayout ? 'calc(34px * var(--scale))' : 'calc(200px * var(--scale))',
          left: 0,
          right: 0,
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
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
            isMe={isMobileLayout ? false : true}
            passConfirmed={amReady}
            passConfirmedLabel="Ready to Play"
            customContent={isMobileLayout ? (
              <div className={styles.botSeatContent}>
                <span className={styles.botName}>{getPlayerName(effectiveSeat) ?? effectiveSeat}</span>
                <div className={styles.seatAvatar}>
                  {(getPlayerName(effectiveSeat) ?? effectiveSeat)[0].toUpperCase()}
                </div>
              </div>
            ) : undefined}
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

      {/* REQ-F-GA18, GA20, GA26: Confirmation dialog for kick/transfer actions */}
      {confirmAction && (
        <ActionConfirmDialog
          action={confirmAction}
          isHost={isHost}
          onCancel={handleConfirmCancel}
          onStartVote={confirmAction.type === 'kick' ? handleConfirmStartVote : undefined}
          onForceAction={handleConfirmForceAction}
        />
      )}
    </>
  );
}
