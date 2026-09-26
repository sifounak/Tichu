'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/api\/?$/, '');

interface ActiveRoom {
  roomCode: string;
  roomName: string;
  seat: string;
  gameInProgress: boolean;
}

function shouldHide(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/game/') || pathname.startsWith('/spectate/');
}

export function ActiveGameBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, authReady, loadFromStorage } = useAuthStore();
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  const refreshActiveRoom = useCallback(() => {
    if (!authReady || shouldHide(pathname)) {
      setActiveRoom(null);
      return;
    }

    const headers: Record<string, string> = {};
    const params = new URLSearchParams();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else if (user?.userId) {
      params.set('userId', user.userId);
    } else {
      setActiveRoom(null);
      return;
    }

    const query = params.toString();
    fetch(`${API_BASE}/api/active-room${query ? `?${query}` : ''}`, { headers })
      .then((res) => res.ok ? res.json() : { activeRoom: null })
      .then((data) => setActiveRoom(data.activeRoom ?? null))
      .catch(() => setActiveRoom(null));
  }, [authReady, pathname, token, user?.userId]);

  useEffect(() => {
    refreshActiveRoom();
  }, [refreshActiveRoom]);

  useEffect(() => {
    const handleFocus = () => refreshActiveRoom();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [refreshActiveRoom]);

  if (!activeRoom || shouldHide(pathname)) return null;

  return (
    <div
      role="status"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '10px 16px',
        background: 'var(--color-bg-panel)',
        borderBottom: '1px solid var(--color-border)',
        color: 'var(--color-text-primary)',
        fontSize: '14px',
      }}
    >
      <span>
        Currently playing in <strong>{activeRoom.roomName}</strong>
      </span>
      <button
        type="button"
        onClick={() => router.push(`/game/${activeRoom.roomCode}`)}
        style={{
          border: 'none',
          borderRadius: '6px',
          background: 'var(--color-gold-accent)',
          color: 'var(--color-felt-green-dark)',
          cursor: 'pointer',
          fontWeight: 700,
          padding: '6px 12px',
        }}
      >
        Rejoin
      </button>
    </div>
  );
}
