// REQ-F-AU01: Guest access — play without registration
// REQ-F-AU02: Optional account registration and login
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

type Mode = 'login' | 'register';

export default function AuthPage() {
  const router = useRouter();
  const { login, register, initGuest, loading, error } = useAuthStore();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      await login(email, password);
    } else {
      const userId = `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      await register({ userId, email, password, displayName });
    }
    // If successful (no error), redirect to lobby
    const currentError = useAuthStore.getState().error;
    if (!currentError) {
      router.push('/lobby');
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center p-6" style={{ background: 'var(--color-felt-green-dark)' }}>
      <div className="w-full max-w-md p-6 rounded-xl" style={{ background: 'var(--color-bg-panel)' }}>
        <h1 className="text-2xl font-bold text-center mb-6" style={{ color: 'var(--color-gold-accent)' }}>
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </h1>

        {error && (
          <div className="mb-4 text-center py-2 px-4 rounded-lg"
            style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-error)' }}
            role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <label className="block">
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Display Name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={30}
                className="mt-1 w-full px-4 py-2 rounded-lg"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                }}
                aria-label="Display name"
              />
            </label>
          )}

          <label className="block">
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full px-4 py-2 rounded-lg"
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
              aria-label="Email"
            />
          </label>

          <label className="block">
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 w-full px-4 py-2 rounded-lg"
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
              aria-label="Password"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: 'var(--color-gold-accent)', color: 'var(--color-felt-green-dark)' }}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); useAuthStore.setState({ error: null }); }}
            className="text-sm underline"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign In'}
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={async () => {
              const guestId = `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
              const guestName = `Guest_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
              await initGuest(guestId, guestName);
              const currentError = useAuthStore.getState().error;
              if (!currentError) router.push('/lobby');
            }}
            disabled={loading}
            className="text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {loading ? 'Please wait...' : 'Skip — play as guest'}
          </button>
        </div>
      </div>
    </main>
  );
}
