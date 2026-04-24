// REQ-F-MP03: Public lobby — browse rooms, create, join by code
// REQ-F-LU01: Hide name input when logged in
// REQ-F-LU02: Show user icon + username in header when logged in
// REQ-F-ID01: WebSocket connects with auth identity
// REQ-F-ID02: CREATE_ROOM/JOIN_ROOM use username as playerName
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useRoomStore } from '@/stores/roomStore';
import { useAuthStore } from '@/stores/authStore';
import { CreateGamePopup } from '@/components/lobby/CreateGamePopup';
import { UserMenu } from '@/components/lobby/UserMenu';
import type { CreateGameConfig } from '@/components/lobby/CreateGamePopup';
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
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<'roomName' | 'hostName' | 'goal' | 'players'>('roomName');
  const [sortAsc, setSortAsc] = useState(true);
  const [error, setError] = useState('');
  const [guestId] = useState(() => typeof window !== 'undefined' ? getGuestId() : '');
  const [kickedMessage, setKickedMessage] = useState<string | null>(null);
  // REQ-F-CG01: Popup state for game creation settings
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [creatingGame, setCreatingGame] = useState(false);
  const [joiningGame, setJoiningGame] = useState(false);

  // REQ-F-LU07: Load auth state on mount
  const { user, authReady, loadFromStorage, logout } = useAuthStore();
  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  // Derive identity from auth state
  const isLoggedIn = user !== null && !user.isGuest;
  // REQ-F-ID01: Use auth userId and username when logged in
  const effectiveUserId = user?.userId ?? guestId;
  // REQ-F-ID02: Use username as playerName when logged in
  const effectivePlayerName = isLoggedIn ? user!.username : playerName;

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
        // REQ-F-CG07: All players and spectators go directly to game page
        router.push(`/game/${msg.roomCode}`);
        break;
      case 'ERROR':
        setCreatingGame(false);
        setJoiningGame(false);
        setError(msg.message);
        break;
    }
  }, [setLobbyRooms, setRoom, router]);

  // Use effective identity in WS URL
  const wsUrl = `${WS_BASE}?userId=${effectiveUserId}&playerName=${encodeURIComponent(effectivePlayerName || 'Guest')}`;

  const { send, status } = useWebSocket({
    url: wsUrl,
    onMessage,
    autoReconnect: true,
    enabled: authReady,
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
  const [roomNameError, setRoomNameError] = useState(false);

  // REQ-F-CG01: Open settings popup instead of immediately creating room
  const handleCreate = () => {
    const name = effectivePlayerName.trim();
    if (!name) { setError('Please enter a name'); return; }
    if (!roomName.trim()) { setRoomNameError(true); return; }
    setRoomNameError(false);
    setError('');
    requestAnimationFrame(() => setShowCreatePopup(true));
  };

  // REQ-F-CG05: Create room with config from popup
  const handleCreateConfirm = (config: CreateGameConfig) => {
    const name = effectivePlayerName.trim();
    setShowCreatePopup(false);
    setCreatingGame(true);
    sessionStorage.setItem('tichu_player_name', name);
    send({ type: 'CREATE_ROOM', playerName: name, roomName: roomName.trim(), config });
  };

  const handleJoinByCode = () => {
    const name = effectivePlayerName.trim();
    if (!name) { setError('Please enter a name'); return; }
    if (joinCode.length !== 6) { setError('Room code must be 6 characters'); return; }
    setError('');
    setJoiningGame(true);
    sessionStorage.setItem('tichu_player_name', name);
    send({ type: 'JOIN_ROOM', roomCode: joinCode.toUpperCase(), playerName: name });
  };

  const handleJoinRoom = (roomCode: string) => {
    const name = effectivePlayerName.trim();
    if (!name) { setError('Please enter a name'); return; }
    setError('');
    setJoiningGame(true);
    sessionStorage.setItem('tichu_player_name', name);
    send({ type: 'JOIN_ROOM', roomCode, playerName: name });
  };

  // REQ-F-SP01: Join room as spectator
  const handleJoinAsSpectator = (roomCode: string) => {
    const name = effectivePlayerName.trim();
    if (!name) { setError('Please enter a name'); return; }
    setError('');
    setJoiningGame(true);
    sessionStorage.setItem('tichu_player_name', name);
    send({ type: 'JOIN_ROOM', roomCode, playerName: name, asSpectator: true });
  };

  // REQ-F-LU05: Logout handler — redirect to auth page
  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const filteredRooms = useMemo(() => {
    const q = search.toLowerCase();
    let rooms = lobbyRooms.filter((r) => {
      const rName = (r.roomName ?? '').toLowerCase();
      return rName.includes(q) || r.hostName.toLowerCase().includes(q);
    });
    rooms = [...rooms].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'roomName': {
          const aName = a.roomName ?? '';
          const bName = b.roomName ?? '';
          cmp = aName.localeCompare(bName);
          break;
        }
        case 'hostName': cmp = a.hostName.localeCompare(b.hostName); break;
        case 'goal': cmp = a.config.targetScore - b.config.targetScore; break;
        case 'players': cmp = a.playerCount - b.playerCount; break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return rooms;
  }, [lobbyRooms, search, sortCol, sortAsc]);

  const sortIndicator = (col: typeof sortCol) =>
    sortCol === col ? (sortAsc ? ' \u25B2' : ' \u25BC') : '';

  return (
    <main className="p-6" style={{ background: 'var(--color-felt-green-dark)', height: '100dvh', overflowY: 'auto' }}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8 relative">
          <h1 className="text-4xl font-bold" style={{ color: 'var(--color-gold-accent)' }}>Tichu Lobby</h1>
          <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
            {status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </p>

          {/* REQ-F-LU02: Top-right — user menu (logged in) or sign-in button (guest) */}
          <div className="absolute top-0 right-0">
            {isLoggedIn ? (
              <UserMenu user={user!} onLogout={handleLogout} />
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-lg text-sm font-semibold"
                style={{
                  background: 'var(--color-gold-accent)',
                  color: 'var(--color-felt-green-dark)',
                }}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>

        {/* Kicked notification */}
        {kickedMessage && (
          <div className="mb-4 text-center py-3 px-4 rounded-lg"
            style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-error)', position: 'relative' }}
            role="alert"
          >
            {kickedMessage}
            <button
              onClick={() => setKickedMessage(null)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--color-error)',
                fontSize: '18px',
                cursor: 'pointer',
                opacity: 0.7,
                lineHeight: 1,
                padding: '4px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* REQ-F-LU01: Hide name input when logged in */}
        {!isLoggedIn && (
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
        )}

        {error && (
          <div className="mb-4 text-center py-2 px-4 rounded-lg"
            style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-error)' }}
            role="alert">
            {error}
          </div>
        )}

        {/* Create room + Join by code — right-aligned buttons */}
        <div className="mb-8" style={{ maxWidth: '500px', margin: '0 auto 32px' }}>
          {/* Create room row */}
          <div className="flex gap-2 mb-3" style={{ justifyContent: 'flex-end' }}>
            <input
              type="text"
              placeholder="ROOM NAME"
              value={roomName}
              onChange={(e) => { setRoomName(e.target.value); setRoomNameError(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              maxLength={30}
              className="px-4 py-2 rounded-lg text-center font-semibold flex-1"
              style={{
                background: 'var(--color-bg-panel)',
                color: 'var(--color-text-primary)',
                border: roomNameError ? '1px solid var(--color-error)' : '1px solid var(--color-border)',
              }}
              aria-label="Room name"
            />
            <button
              onClick={handleCreate}
              className="px-6 py-2 rounded-lg font-semibold transition-opacity hover:opacity-80 whitespace-nowrap"
              style={{ background: 'var(--color-gold-accent)', color: 'var(--color-felt-green-dark)', width: '135px' }}
            >
              Create Game
            </button>
          </div>

          {/* Join by code row — right-aligned with button */}
          <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
            <input
              type="text"
              placeholder="ROOM CODE"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleJoinByCode(); }}
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
              className="px-6 py-2 rounded-lg font-semibold transition-opacity hover:opacity-80 whitespace-nowrap"
              style={{
                background: 'var(--color-felt-green-light)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                width: '135px',
              }}
            >
              Join Game
            </button>
          </div>
        </div>

        {/* Public room list */}
        <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-panel)' }}>
          <h2 className="text-xl font-bold mb-4 text-center" style={{ color: 'var(--color-text-primary)' }}>
            Public Rooms
          </h2>

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by room name or host..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 rounded-lg"
              style={{
                background: 'var(--color-felt-green-dark)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                fontSize: '15px',
              }}
              aria-label="Search rooms"
            />
          </div>

          {filteredRooms.length === 0 ? (
            <p className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
              {lobbyRooms.length === 0 ? 'No public rooms available. Create one!' : 'No rooms match your search.'}
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '35%' }} />
                  <col />
                  <col style={{ width: '80px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '85px' }} />
                  <col style={{ width: '120px' }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                    {([
                      ['roomName', 'Room Name', 'left'],
                      ['hostName', 'Host', 'left'],
                      ['goal', 'Goal', 'right'],
                    ] as const).map(([col, label, align]) => (
                      <th
                        key={col}
                        onClick={() => handleSort(col)}
                        style={{
                          padding: '10px 12px',
                          textAlign: align as 'center' | 'left',
                          color: 'var(--color-text-muted)',
                          fontWeight: 600,
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          cursor: 'pointer',
                          userSelect: 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {label}{sortIndicator(col)}
                      </th>
                    ))}
                    <th style={{
                      padding: '10px 12px',
                      textAlign: 'center',
                      color: 'var(--color-text-muted)',
                      fontWeight: 600,
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      whiteSpace: 'nowrap',
                    }}>
                      Spectators
                    </th>
                    <th
                      onClick={() => handleSort('players')}
                      style={{
                        padding: '10px 12px',
                        textAlign: 'center',
                        color: 'var(--color-text-muted)',
                        fontWeight: 600,
                        fontSize: '13px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Players{sortIndicator('players')}
                    </th>
                    <th style={{
                      padding: '10px 12px',
                      textAlign: 'center',
                      color: 'var(--color-text-muted)',
                      fontWeight: 600,
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      Join
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRooms.map((room) => (
                    <tr
                      key={room.roomCode}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <td style={{ padding: '12px', color: 'var(--color-text-primary)', fontWeight: 700 }}>
                        {room.roomName}
                      </td>
                      <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>
                        {room.hostName}
                      </td>
                      <td style={{ padding: '12px', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                        {room.config.targetScore}
                      </td>
                      <td style={{ padding: '12px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                        {room.spectatorCount}
                      </td>
                      <td style={{ padding: '12px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                        {room.playerCount}/4
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {/* REQ-F-ES05: "Join (In Progress)" for mid-game rooms with empty seats */}
                        {room.hasEmptySeats ? (
                          <button
                            onClick={() => handleJoinRoom(room.roomCode)}
                            className="px-4 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-80"
                            style={{ background: 'var(--color-success)', color: '#000' }}
                          >
                            Join (In Progress)
                          </button>
                        ) : room.playerCount < 4 ? (
                          <button
                            onClick={() => handleJoinRoom(room.roomCode)}
                            className="px-5 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-80"
                            style={{ background: 'var(--color-success)', color: '#000' }}
                          >
                            Join
                          </button>
                        ) : room.config.spectatorsAllowed ? (
                          /* REQ-F-SP01: "Spectate" button when room is full + spectators allowed */
                          <button
                            onClick={() => handleJoinAsSpectator(room.roomCode)}
                            className="px-4 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-80"
                            style={{ background: 'var(--color-gold-accent)', color: 'var(--color-felt-green-dark)' }}
                          >
                            Spectate
                          </button>
                        ) : (
                          <span className="px-4 py-1.5 rounded text-sm font-semibold inline-block"
                            style={{ background: 'var(--color-text-muted)', color: '#000' }}>
                            Full
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* REQ-F-CG01: Game creation settings popup */}
      {showCreatePopup && (
        <CreateGamePopup
          onCancel={() => setShowCreatePopup(false)}
          onCreate={handleCreateConfirm}
        />
      )}

      {/* Loading overlay while creating or joining game */}
      {(creatingGame || joiningGame) && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)',
        }}>
          <div style={{
            background: 'rgb(0,0,0)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--space-3)',
            padding: 'var(--space-6) var(--space-8)',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 'var(--font-2xl)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {joiningGame ? 'Joining game...' : 'Creating game...'}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
