// REQ-F-ID03: Auth-aware home page
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { user, loadFromStorage } = useAuthStore();

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  const isLoggedIn = user !== null && !user.isGuest;

  const handlePlayNow = () => {
    setLoading(true);
    router.push('/lobby');
  };

  return (
    <main className="flex min-h-dvh items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold tracking-tight">Tichu</h1>
        <p className="mt-4 text-lg" style={{ color: 'var(--color-text-secondary)' }}>
          A beautiful card game for four players
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={handlePlayNow}
            disabled={loading}
            className="px-6 py-3 rounded-lg font-semibold text-sm transition-colors"
            style={{
              background: 'var(--color-gold-accent)',
              color: 'var(--color-felt-green-dark)',
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            Play Now
          </button>
          <div className="flex gap-4">
            {isLoggedIn ? (
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Welcome, {user!.username}
              </span>
            ) : (
              <Link href="/login" className="text-sm underline" style={{ color: 'var(--color-text-secondary)' }}>
                Sign In / Register
              </Link>
            )}
            <Link href="/leaderboard" className="text-sm underline" style={{ color: 'var(--color-text-secondary)' }}>
              Leaderboard
            </Link>
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
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
              Entering lobby...
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
