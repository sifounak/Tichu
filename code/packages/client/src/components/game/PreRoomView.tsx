// REQ-F-CG09: Empty seats show bot controls (difficulty dropdown + Add Bot)
// REQ-F-CG11: All 4 players must confirm ready
// REQ-F-CG13: Room code visible for sharing
// REQ-F-CG14: Host can remove bots / kick players
// REQ-F-CG15: Host can change settings pre-game
// REQ-F-CG16: Start Game button in center of play area
// REQ-F-CG17: Only host sees bot controls
'use client';

import { useCallback, useState } from 'react';
import type { Seat, GameConfig, RoomPlayer } from '@tichu/shared';
import type { ClientGameView } from '@tichu/shared';
import { GameTable } from './GameTable';
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
}: PreRoomViewProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  // REQ-F-CG09: Per-seat bot difficulty state
  const [botDifficulty, setBotDifficulty] = useState<Record<Seat, 'hard' | 'expert'>>({
    north: 'expert',
    east: 'expert',
    south: 'expert',
    west: 'expert',
  });

  const isHost = mySeat === hostSeat;
  const amReady = mySeat ? readyPlayers.includes(mySeat) : false;
  const effectiveSeat = mySeat ?? 'south';

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

  // Seat renderer passed to GameTable via renderSeatOverride
  const renderSeatCard = useCallback((seat: Seat) => {
    const player = players.find((p) => p.seat === seat);
    const isMe = seat === mySeat;
    const isHostSeat = seat === hostSeat;
    const isReady = readyPlayers.includes(seat);

    const cardClasses = [
      styles.seatCard,
      isMe ? styles.seatCardMe : '',
      isReady ? styles.seatCardReady : '',
    ].filter(Boolean).join(' ');

    if (!player) {
      // Empty seat
      return (
        <div className={cardClasses}>
          {/* REQ-F-CG17: Only host sees bot controls */}
          {isHost ? (
            <div className={styles.botControls}>
              <span className={styles.botDiffLabel}>Difficulty</span>
              <select
                value={botDifficulty[seat]}
                onChange={(e) => setBotDifficulty((prev) => ({ ...prev, [seat]: e.target.value as 'hard' | 'expert' }))}
                className={styles.botDiffSelect}
              >
                <option value="hard">Normal</option>
                <option value="expert">Expert</option>
              </select>
              <button onClick={() => handleAddBot(seat)} className={styles.addBotBtn}>
                Add Bot
              </button>
            </div>
          ) : (
            <span className={styles.emptyLabel}>Waiting...</span>
          )}
        </div>
      );
    }

    // Occupied seat
    return (
      <div className={cardClasses}>
        <span className={styles.playerName}>{player.name}</span>
        {isHostSeat && <span className={styles.badge}>(Host)</span>}
        {isMe && !isHostSeat && <span className={styles.badge}>(You)</span>}
        {isReady && <span className={styles.readyLabel}>Ready</span>}

        {/* REQ-F-CG14: Host can remove bots and kick players */}
        {isHost && player.isBot && (
          <button onClick={() => handleRemoveBot(seat)} className={styles.removeBtn}>
            Remove
          </button>
        )}
        {isHost && !player.isBot && !isMe && (
          <button onClick={() => handleKickPlayer(seat)} className={styles.removeBtn}>
            Kick
          </button>
        )}
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, mySeat, hostSeat, readyPlayers, isHost, botDifficulty]);

  // REQ-F-CG16: Center content — Start Game / Ready button
  const centerContent = (
    <div className={styles.centerContent}>
      <div className={styles.readyCount}>
        {readyPlayers.length}/{players.length} Ready
        {players.length < 4 && ` — need ${4 - players.length} more`}
      </div>
      {!amReady && (
        <button onClick={handleReadyToStart} className={styles.startBtn}>
          Start Game
        </button>
      )}
      {amReady && (
        <button onClick={handleCancelReady} className={styles.readyBtn}>
          Ready — Waiting...
        </button>
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

      {/* Room code + Leave — reuse the same position as the in-game room code */}
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

      {/* Reuse GameTable with pre-room seat rendering and center content */}
      <GameTable
        view={dummyView}
        hideCenter={false}
        renderSeatOverride={renderSeatCard}
        centerContent={centerContent}
      />
    </>
  );
}
