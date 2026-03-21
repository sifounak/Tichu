// REQ-F-CG09: Empty seats show bot controls (difficulty dropdown + Add Bot)
// REQ-F-CG11: All 4 players must confirm ready
// REQ-F-CG13: Room code visible for sharing
// REQ-F-CG14: Host can remove bots / kick players
// REQ-F-CG15: Host can change settings pre-game
// REQ-F-CG16: Start Game button in center of play area
// REQ-F-CG17: Only host sees bot controls
'use client';

import { useState } from 'react';
import type { Seat, GameConfig, RoomPlayer } from '@tichu/shared';
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

function getSeatPositions(mySeat: Seat): Record<'top' | 'left' | 'right' | 'bottom', Seat> {
  const order: Seat[] = ['north', 'east', 'south', 'west'];
  const myIdx = order.indexOf(mySeat);
  return {
    bottom: order[myIdx],
    right: order[(myIdx + 1) % 4],
    top: order[(myIdx + 2) % 4],
    left: order[(myIdx + 3) % 4],
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
  const canStart = players.length === 4;
  const amReady = mySeat ? readyPlayers.includes(mySeat) : false;
  const seatPositions = mySeat ? getSeatPositions(mySeat) : { top: 'north' as Seat, left: 'west' as Seat, right: 'east' as Seat, bottom: 'south' as Seat };

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

  function renderSeatCard(seat: Seat) {
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
                onChange={(e) => setBotDifficulty({ ...botDifficulty, [seat]: e.target.value as 'hard' | 'expert' })}
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
  }

  return (
    <div className={styles.container}>
      {/* REQ-F-CG13: Room name and code header */}
      <div className={styles.header}>
        <div className={styles.roomName}>{roomName ?? 'Room'}</div>
        <div className={styles.roomCodeRow}>
          <span className={styles.roomCode}>{roomCode}</span>
          <button onClick={handleCopyCode} className={styles.copyBtn}>
            {codeCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* REQ-F-CG15: Settings toggle (host: editable, non-host: read-only) */}
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

      {/* Seat layout */}
      <div className={styles.seatGrid}>
        <div className={styles.top}>{renderSeatCard(seatPositions.top)}</div>
        <div className={styles.left}>{renderSeatCard(seatPositions.left)}</div>
        <div className={styles.right}>{renderSeatCard(seatPositions.right)}</div>
        <div className={styles.bottom}>{renderSeatCard(seatPositions.bottom)}</div>
      </div>

      {/* REQ-F-CG16: Center area — Start Game / Ready button for all players */}
      <div className={styles.center}>
        <div className={styles.readyCount}>
          {readyPlayers.length}/{players.length} Ready
        </div>
        {canStart && !amReady && (
          <button onClick={handleReadyToStart} className={styles.startBtn}>
            Start Game
          </button>
        )}
        {canStart && amReady && (
          <button onClick={handleCancelReady} className={styles.readyBtn}>
            Ready — Waiting...
          </button>
        )}
        {!canStart && (
          <button disabled className={styles.disabledBtn}>
            Need {4 - players.length} more player{4 - players.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Leave button */}
      <button onClick={onLeave} className={styles.leaveBtn}>
        Leave
      </button>
    </div>
  );
}
