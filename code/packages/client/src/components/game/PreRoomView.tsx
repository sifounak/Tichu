// REQ-F-CG09: Empty seats show bot controls (difficulty dropdown + Add Bot)
// REQ-F-CG11: All 4 players must confirm ready
// REQ-F-CG13: Room code visible for sharing
// REQ-F-CG14: Host can remove bots / kick players
// REQ-F-CG15: Host can change settings pre-game
// REQ-F-CG16: Start Game button in center of play area
// REQ-F-CG17: Only host sees bot controls
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Seat, GameConfig, RoomPlayer } from '@tichu/shared';
import type { ClientGameView } from '@tichu/shared';
import { GameTable } from './GameTable';
import { PlayerSeat } from './PlayerSeat';
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
}

/** Minimal ClientGameView stub so GameTable can calculate seat positions */
function makeDummyView(mySeat: Seat): ClientGameView {
  return {
    gameId: '',
    config: { targetScore: 1000, turnTimerSeconds: null, botDifficulty: 'expert', animationSpeed: 'normal', spectatorsAllowed: true, isPrivate: false },
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
}: PreRoomViewProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState<Record<Seat, 'hard' | 'expert'>>({
    north: 'expert',
    east: 'expert',
    south: 'expert',
    west: 'expert',
  });

  // REQ-F-SC02: Countdown timer for seat offer / queue status
  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    const timeoutMs = seatOffer?.timeoutMs ?? queueStatus?.timeoutMs;
    if (!timeoutMs) { setCountdown(0); return; }
    setCountdown(Math.ceil(timeoutMs / 1000));
    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [seatOffer, queueStatus]);

  const isSpectator = mySeat === null;
  const isHost = mySeat === hostSeat;
  const amReady = mySeat ? readyPlayers.includes(mySeat) : false;
  // Spectators see from host's POV (host is always south)
  const effectiveSeat = mySeat ?? hostSeat ?? 'south';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleAddBot = (seat: Seat) => {
    send({ type: 'ADD_BOT', seat, difficulty: botDifficulty[seat] });
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

    // Human player — standard PlayerSeat with 0 cards
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
              <button onClick={() => send({ type: 'CLAIM_SEAT' })} className={styles.sitHereBtn}>
                Claim Seat
              </button>
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
  }, [players, mySeat, hostSeat, readyPlayers, isHost, botDifficulty]);

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
      {/* REQ-F-CG13: Room name header */}
      <div className={styles.header}>
        <div className={styles.roomName}>{roomName ?? 'Room'}</div>
      </div>

      {/* Room code + Leave — same position as in-game */}
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
        <div style={{ position: 'relative' }}>
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
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              const tooltip = e.currentTarget.nextElementSibling as HTMLElement;
              if (tooltip) tooltip.style.display = 'block';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.background = 'transparent';
              const tooltip = e.currentTarget.nextElementSibling as HTMLElement;
              if (tooltip) tooltip.style.display = 'none';
            }}
          >
            Spectators: <span style={{ color: 'var(--color-gold-accent)', fontWeight: 900 }}>{spectatorCount}</span>
          </button>
          {spectatorNames.length > 0 && (
            <div style={{
              display: 'none',
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: '4px',
              background: 'var(--color-bg-panel)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--card-border-radius)',
              padding: 'var(--space-2) var(--space-3)',
              fontSize: 'var(--font-md)',
              color: 'var(--color-text-primary)',
              whiteSpace: 'nowrap',
              zIndex: 40,
            }}>
              {spectatorNames.map((name, i) => (
                <div key={i}>{name}</div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onLeave}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--card-border-radius)',
            color: 'var(--color-text-secondary)',
            padding: 'var(--space-1) var(--space-3)',
            fontSize: 'var(--font-xl)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          aria-label="Leave room"
        >
          Leave Room
        </button>

        {codeCopied && (
          <div style={{
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
              <label className={styles.settingsField}>
                <span className={styles.settingsLabel}>Animation Speed</span>
                <select
                  value={config.animationSpeed}
                  onChange={(e) => handleConfigChange({ animationSpeed: e.target.value })}
                  className={styles.settingsSelect}
                >
                  <option value="slow">Slow</option>
                  <option value="normal">Normal</option>
                  <option value="fast">Fast</option>
                  <option value="off">Off</option>
                </select>
              </label>
              <div />
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
              <span>Speed: {config.animationSpeed}</span>
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
        renderSeatOverride={renderSeat}
        centerContent={centerContent}
        bottomContent={isSpectator ? (() => {
          const hostPlayer = players.find((p) => p.seat === hostSeat);
          if (!hostPlayer) return undefined;
          const hostReady = hostSeat ? readyPlayers.includes(hostSeat) : false;
          return (
            <PlayerSeat
              seat={hostSeat ?? 'south'}
              displayName={hostPlayer.name}
              cardCount={0}
              tichuCall={'none'}
              hasPlayed={false}
              hasPassed={false}
              finishOrder={null}
              isCurrentTurn={false}
              isTrickLeader={false}
              isMe={false}
              passConfirmed={hostReady}
              passConfirmedLabel="Ready to Play"
            />
          );
        })() : undefined}
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
    </>
  );
}
