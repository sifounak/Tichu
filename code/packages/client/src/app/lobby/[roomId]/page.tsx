// REQ-F-MP02: Room waiting area with seat management, config, and game start
// REQ-F-MP04: Room configuration options
// REQ-F-MP05: Fixed seat partnerships
'use client';

import { useCallback, useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useRoomStore } from '@/stores/roomStore';
import type { ServerMessage, Seat, GameConfig } from '@tichu/shared';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001/ws';
const SEAT_LABELS: Record<Seat, string> = {
  north: 'Top',
  east: 'Right',
  south: 'Bottom',
  west: 'Left',
};
function getGuestId(): string {
  let id = sessionStorage.getItem('tichu_user_id');
  if (!id) {
    id = `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('tichu_user_id', id);
  }
  return id;
}

export default function RoomPage(props: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(props.params);
  const router = useRouter();
  const [error, setError] = useState('');
  const [userId] = useState(() => typeof window !== 'undefined' ? getGuestId() : '');
  const { roomCode, mySeat, players, hostSeat, config, gameInProgress, setRoom, updateRoom, leaveRoom } = useRoomStore();

  const onMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'ROOM_JOINED':
        setRoom(msg.roomCode, msg.seat);
        break;
      case 'ROOM_UPDATE':
        updateRoom(msg.players, msg.hostSeat, msg.config as GameConfig, msg.gameInProgress);
        break;
      case 'ROOM_LEFT':
        leaveRoom();
        router.push('/lobby');
        break;
      case 'GAME_STATE':
        // Game started — navigate to game page
        router.push(`/game/${roomId}`);
        break;
      case 'ERROR':
        setError(msg.message);
        break;
    }
  }, [setRoom, updateRoom, leaveRoom, router, roomId]);

  const playerName = typeof window !== 'undefined'
    ? (sessionStorage.getItem('tichu_player_name') ?? 'Guest')
    : 'Guest';

  const wsUrl = `${WS_BASE}?userId=${userId}&playerName=${encodeURIComponent(playerName)}`;

  const { send, status } = useWebSocket({
    url: wsUrl,
    onMessage,
    autoReconnect: true,
  });

  // REQ-F-004: Auto-join with delay to allow server reconnection to arrive first
  useEffect(() => {
    if (status !== 'connected' || !roomId) return;
    const timer = setTimeout(() => {
      if (!useRoomStore.getState().roomCode) {
        send({ type: 'JOIN_ROOM', roomCode: roomId, playerName });
      }
    }, 50); // REQ-NF-DL02: Reduced from 150ms to 50ms
    return () => clearTimeout(timer);
  }, [status, roomId, send, playerName]);

  const isHost = mySeat === hostSeat;

  const handleLeave = () => send({ type: 'LEAVE_ROOM' });

  const handleAddBot = (seat: Seat) => {
    send({ type: 'ADD_BOT', seat });
  };

  const handleRemoveBot = (seat: Seat) => {
    send({ type: 'REMOVE_BOT', seat });
  };

  const handleStartGame = () => {
    send({ type: 'START_GAME' });
  };

  // REQ-F-006: Seat swap
  const handleSwapSeat = (seat: Seat) => {
    send({ type: 'SWAP_SEATS', targetSeat: seat });
  };

  const handleConfigChange = (updates: Record<string, unknown>) => {
    send({ type: 'CONFIGURE_ROOM', config: updates } as any);
  };

  const canStart = players.length === 4 && !gameInProgress;

  function renderSeatCard(seat: Seat) {
    const player = players.find(p => p.seat === seat);
    const isMe = seat === mySeat;
    const isHostSeat = seat === hostSeat;

    // Determine display name and subtitle
    let displayName: string;
    let subtitle: string | null = null;
    if (player) {
      displayName = player.name;
      if (isHostSeat) subtitle = '(Host)';
      else if (isMe) subtitle = '(you)';
    } else {
      displayName = 'Empty';
    }

    return (
      <div
        className="p-3 rounded-lg"
        style={{
          background: isMe ? 'rgba(201, 168, 76, 0.15)' : 'rgba(255, 255, 255, 0.05)',
          border: isMe ? '1px solid var(--color-gold-accent)' : '1px solid var(--color-border)',
          width: '180px',
          height: '130px',
          padding: '20px 16px 28px',
          gap: '6px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column' as const,
          justifyContent: 'center',
        }}
      >
        {/* Player name */}
        <div style={{ color: player ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
          <div className="font-semibold text-base">{displayName}</div>
          {subtitle && (
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</div>
          )}
        </div>

        {/* Action buttons — stacked vertically, fixed height for uniform card size */}
        <div className="flex flex-col gap-1.5 items-stretch" style={{ width: '100px', margin: '0 auto' }}>
          {(!player && !isMe) && (
            <button
              onClick={() => handleSwapSeat(seat)}
              className="text-sm px-4 py-1.5 rounded transition-opacity hover:opacity-80"
              style={{
                background: 'var(--color-gold-accent)',
                color: 'var(--color-felt-green-dark)',
              }}
            >
              Sit Here
            </button>
          )}
          {(!player && isHost) && (
            <button
              onClick={() => handleAddBot(seat)}
              className="text-sm px-4 py-1.5 rounded transition-opacity hover:opacity-80"
              style={{
                background: 'var(--color-felt-green-light)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
            >
              Add Bot
            </button>
          )}
          {(player?.isBot && !isMe) && (
            <button
              onClick={() => handleSwapSeat(seat)}
              className="text-sm px-4 py-1.5 rounded transition-opacity hover:opacity-80"
              style={{
                background: 'var(--color-gold-accent)',
                color: 'var(--color-felt-green-dark)',
              }}
            >
              Sit Here
            </button>
          )}
          {(player?.isBot && isHost) && (
            <button
              onClick={() => handleRemoveBot(seat)}
              className="text-sm px-4 py-1.5 rounded transition-opacity hover:opacity-80"
              style={{ color: 'var(--color-error)', border: '1px solid var(--color-error)', borderRadius: '4px' }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <main className="p-6" style={{ background: 'var(--color-felt-green-dark)', height: '100dvh', overflowY: 'auto' }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-gold-accent)' }}>Room</h1>
          <p className="mt-1 font-mono text-2xl tracking-[0.3em] font-bold"
            style={{ color: 'var(--color-text-primary)' }}>
            {roomCode ?? roomId}
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Share this code with friends
          </p>
        </div>

        {error && (
          <div className="mb-4 text-center py-2 px-4 rounded-lg"
            style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-error)' }}
            role="alert">
            {error}
          </div>
        )}

        {/* Seats (D-pad cross layout matching game table) */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 text-center" style={{ color: 'var(--color-text-primary)' }}>
            Seats
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '180px 180px 180px',
            gridTemplateRows: 'auto auto auto',
            gap: '12px',
            justifyItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
          }}>
            {/* North — row 1, col 2 */}
            <div style={{ gridColumn: 2, gridRow: 1 }}>
              {renderSeatCard('north')}
            </div>
            {/* West — row 2, col 1 */}
            <div style={{ gridColumn: 1, gridRow: 2 }}>
              {renderSeatCard('west')}
            </div>
            {/* Center label — row 2, col 2 */}
            <div style={{
              gridColumn: 2, gridRow: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-text-muted)', fontSize: '52px', fontWeight: 600,
            }}>
              vs
            </div>
            {/* East — row 2, col 3 */}
            <div style={{ gridColumn: 3, gridRow: 2 }}>
              {renderSeatCard('east')}
            </div>
            {/* South — row 3, col 2 */}
            <div style={{ gridColumn: 2, gridRow: 3 }}>
              {renderSeatCard('south')}
            </div>
          </div>
        </div>

        {/* Room config (host only) */}
        {isHost && config && (
          <div className="mb-6 p-4 rounded-xl" style={{ background: 'var(--color-bg-panel)', maxWidth: '400px', margin: '0 auto' }}>
            <h2 className="text-lg font-semibold mb-3 text-center" style={{ color: 'var(--color-text-primary)' }}>
              Settings
            </h2>
            <div className="grid grid-cols-2 gap-4" style={{ margin: '0 auto' }}>
              {/* Target score */}
              <label className="block text-center">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Target Score</span>
                <input
                  type="number"
                  value={config.targetScore}
                  onChange={(e) => handleConfigChange({ targetScore: parseInt(e.target.value) || 1000 })}
                  min={100} max={10000} step={100}
                  className="mt-1 w-full px-3 py-1.5 rounded"
                  style={{
                    background: 'var(--color-felt-green-dark)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                    textAlign: 'center',
                  }}
                />
              </label>

              {/* Turn timer */}
              <label className="block text-center">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Turn Timer</span>
                <select
                  value={config.turnTimerSeconds ?? 'off'}
                  onChange={(e) => handleConfigChange({
                    turnTimerSeconds: e.target.value === 'off' ? null : parseInt(e.target.value) as 30 | 60 | 90,
                  })}
                  className="mt-1 w-full py-1.5 rounded"
                  style={{
                    background: 'var(--color-felt-green-dark)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                    textAlign: 'center',
                    paddingLeft: '24px',
                    paddingRight: '4px',
                  }}
                >
                  <option value="off">Off</option>
                  <option value="30">30s</option>
                  <option value="60">60s</option>
                  <option value="90">90s</option>
                  <option value="120">120s</option>
                </select>
              </label>

              {/* Bot difficulty */}
              <label className="block text-center">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Bot Difficulty</span>
                <select
                  value={config.botDifficulty}
                  onChange={(e) => handleConfigChange({ botDifficulty: e.target.value as 'easy' | 'medium' | 'hard' })}
                  className="mt-1 w-full py-1.5 rounded"
                  style={{
                    background: 'var(--color-felt-green-dark)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                    textAlign: 'center',
                    paddingLeft: '24px',
                    paddingRight: '4px',
                  }}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>

              {/* Animation speed */}
              <label className="block text-center">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Animation Speed</span>
                <select
                  value={config.animationSpeed}
                  onChange={(e) => handleConfigChange({ animationSpeed: e.target.value as 'slow' | 'normal' | 'fast' | 'off' })}
                  className="mt-1 w-full py-1.5 rounded"
                  style={{
                    background: 'var(--color-felt-green-dark)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                    textAlign: 'center',
                    paddingLeft: '24px',
                    paddingRight: '4px',
                  }}
                >
                  <option value="slow">Slow</option>
                  <option value="normal">Normal</option>
                  <option value="fast">Fast</option>
                  <option value="off">Off</option>
                </select>
              </label>

              {/* Private/Public toggle */}
              <label className="flex items-center justify-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.isPrivate}
                  onChange={(e) => handleConfigChange({ isPrivate: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Private Room</span>
              </label>

              {/* Spectators toggle */}
              <label className="flex items-center justify-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.spectatorsAllowed}
                  onChange={(e) => handleConfigChange({ spectatorsAllowed: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Allow Spectators</span>
              </label>
            </div>
          </div>
        )}

        {/* Settings summary (non-host) */}
        {!isHost && config && (
          <div className="mb-6 p-4 rounded-xl" style={{ background: 'var(--color-bg-panel)', maxWidth: '400px', margin: '0 auto' }}>
            <h2 className="text-lg font-semibold mb-2 text-center" style={{ color: 'var(--color-text-primary)' }}>Settings</h2>
            <div className="grid grid-cols-2 gap-2 text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
              <span>Target: {config.targetScore} pts</span>
              <span>Timer: {config.turnTimerSeconds ? `${config.turnTimerSeconds}s` : 'Off'}</span>
              <span>Bots: {config.botDifficulty}</span>
              <span>Speed: {config.animationSpeed}</span>
              <span>{config.isPrivate ? 'Private' : 'Public'}</span>
              <span>Spectators: {config.spectatorsAllowed ? 'Yes' : 'No'}</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-4 justify-center mt-8">
          <button
            onClick={handleLeave}
            className="px-5 py-2.5 rounded-lg font-semibold transition-opacity hover:opacity-80"
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
            }}
          >
            {isHost ? 'Cancel' : 'Leave Room'}
          </button>
          {isHost && (
            <button
              onClick={handleStartGame}
              disabled={!canStart}
              className="px-6 py-2.5 rounded-lg font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{
                background: canStart ? 'var(--color-gold-accent)' : 'var(--color-text-muted)',
                color: 'var(--color-felt-green-dark)',
              }}
            >
              {canStart ? 'Start Game' : `Need ${4 - players.length} more player${4 - players.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
