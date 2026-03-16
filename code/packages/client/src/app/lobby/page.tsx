// REQ-F-MP03: Public lobby — browse rooms, create, join by code
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useRoomStore } from '@/stores/roomStore';
import type { ServerMessage } from '@tichu/shared';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001/ws';

function getGuestId(): string {
  let id = sessionStorage.getItem('tichu_user_id');
  if (!id) {
    id = `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('tichu_user_id', id);
  }
  return id;
}

export default function LobbyPage() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState(() =>
    typeof window !== 'undefined' ? (sessionStorage.getItem('tichu_player_name') ?? '') : '',
  );
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [userId] = useState(() => typeof window !== 'undefined' ? getGuestId() : '');
  const [kickedMessage, setKickedMessage] = useState<string | null>(null);

  // Check for kicked message on mount
  useEffect(() => {
    const msg = sessionStorage.getItem('tichu_kicked_message');
    if (msg) {
      setKickedMessage(msg);
      sessionStorage.removeItem('tichu_kicked_message');
    }
  }, []);
  const { lobbyRooms, setLobbyRooms, setRoom } = useRoomStore();

  const onMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'LOBBY_LIST':
        setLobbyRooms(msg.rooms as any);
        break;
      case 'ROOM_JOINED':
        setRoom(msg.roomCode, msg.seat);
        router.push(`/lobby/${msg.roomCode}`);
        break;
      case 'ERROR':
        setError(msg.message);
        break;
    }
  }, [setLobbyRooms, setRoom, router]);

  // Use stable 'Guest' in WS URL — real name is sent in CREATE_ROOM/JOIN_ROOM messages
  const wsUrl = `${WS_BASE}?userId=${userId}&playerName=Guest`;

  const { send, status } = useWebSocket({
    url: wsUrl,
    onMessage,
    autoReconnect: true,
  });

  // Fetch lobby list on connect and periodically
  useEffect(() => {
    if (status !== 'connected') return;
    send({ type: 'GET_LOBBY' });
    // REQ-NF-DL01: Reduced from 5000ms to 2000ms for snappier lobby updates
    const interval = setInterval(() => send({ type: 'GET_LOBBY' }), 2000);
    return () => clearInterval(interval);
  }, [status, send]);

  // REQ-F-003: Persist playerName across page navigation
  const handleCreate = () => {
    if (!playerName.trim()) { setError('Please enter a name'); return; }
    setError('');
    sessionStorage.setItem('tichu_player_name', playerName.trim());
    send({ type: 'CREATE_ROOM', playerName: playerName.trim() });
  };

  const handleJoinByCode = () => {
    if (!playerName.trim()) { setError('Please enter a name'); return; }
    if (joinCode.length !== 6) { setError('Room code must be 6 characters'); return; }
    setError('');
    sessionStorage.setItem('tichu_player_name', playerName.trim());
    send({ type: 'JOIN_ROOM', roomCode: joinCode.toUpperCase(), playerName: playerName.trim() });
  };

  const handleJoinRoom = (roomCode: string) => {
    if (!playerName.trim()) { setError('Please enter a name'); return; }
    setError('');
    sessionStorage.setItem('tichu_player_name', playerName.trim());
    send({ type: 'JOIN_ROOM', roomCode, playerName: playerName.trim() });
  };

  return (
    <main className="p-6" style={{ background: 'var(--color-felt-green-dark)', height: '100dvh', overflowY: 'auto' }}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold" style={{ color: 'var(--color-gold-accent)' }}>Tichu Lobby</h1>
          <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
            {status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </p>
        </div>

        {/* Kicked notification */}
        {kickedMessage && (
          <div className="mb-4 text-center py-3 px-4 rounded-lg"
            style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-error)' }}
            role="alert"
          >
            {kickedMessage}
            <button
              onClick={() => setKickedMessage(null)}
              className="ml-3 text-xs underline opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Player name */}
        <div className="mb-6 flex justify-center">
          <input
            type="text"
            placeholder="Your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={30}
            className="px-4 py-2 rounded-lg text-center font-semibold"
            style={{
              background: 'var(--color-bg-panel)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              width: '240px',
            }}
            aria-label="Player name"
          />
        </div>

        {error && (
          <div className="mb-4 text-center py-2 px-4 rounded-lg"
            style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-error)' }}
            role="alert">
            {error}
          </div>
        )}

        {/* Create + Join by code */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <button
            onClick={handleCreate}
            className="px-6 py-3 rounded-lg font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'var(--color-gold-accent)', color: 'var(--color-felt-green-dark)' }}
          >
            Create Room
          </button>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              maxLength={6}
              className="px-4 py-2 rounded-lg text-center uppercase tracking-widest font-mono"
              style={{
                background: 'var(--color-bg-panel)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                width: '140px',
              }}
              aria-label="Room code"
            />
            <button
              onClick={handleJoinByCode}
              className="px-4 py-2 rounded-lg font-semibold transition-opacity hover:opacity-80"
              style={{
                background: 'var(--color-felt-green-light)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
            >
              Join
            </button>
          </div>
        </div>

        {/* Public room list */}
        <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-panel)' }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Public Rooms
          </h2>
          {lobbyRooms.length === 0 ? (
            <p className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
              No public rooms available. Create one!
            </p>
          ) : (
            <div className="space-y-2" role="list" aria-label="Public rooms">
              {lobbyRooms.map((room) => (
                <div
                  key={room.roomCode}
                  role="listitem"
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                >
                  <div>
                    <span className="font-mono font-bold tracking-wider"
                      style={{ color: 'var(--color-gold-accent)' }}>
                      {room.roomCode}
                    </span>
                    <span className="ml-3" style={{ color: 'var(--color-text-secondary)' }}>
                      hosted by {room.hostName}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {room.playerCount}/4
                    </span>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {room.config.targetScore} pts
                    </span>
                    {room.gameInProgress ? (
                      <span className="px-3 py-1 rounded text-xs font-semibold"
                        style={{ background: 'var(--color-warning)', color: '#000' }}>
                        In Game
                      </span>
                    ) : room.playerCount < 4 ? (
                      <button
                        onClick={() => handleJoinRoom(room.roomCode)}
                        className="px-3 py-1 rounded text-xs font-semibold transition-opacity hover:opacity-80"
                        style={{ background: 'var(--color-success)', color: '#000' }}
                      >
                        Join
                      </button>
                    ) : (
                      <span className="px-3 py-1 rounded text-xs font-semibold"
                        style={{ background: 'var(--color-text-muted)', color: '#000' }}>
                        Full
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
