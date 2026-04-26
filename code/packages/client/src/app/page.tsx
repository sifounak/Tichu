'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

type Mode = 'login' | 'register';

export default function Home() {
  const router = useRouter();
  const { user, authReady, login, register, loading, error, loadFromStorage } = useAuthStore();
  const [mode, setMode] = useState<Mode>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  // Auto-redirect to lobby if already logged in
  useEffect(() => {
    if (authReady && user) {
      router.replace('/lobby');
    }
  }, [authReady, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      await login(identifier, password);
    } else {
      const userId = `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      await register({ userId, username, email, password });
    }
    const currentError = useAuthStore.getState().error;
    if (!currentError) {
      router.push('/lobby');
    }
  };

  // Show loading while checking auth
  if (!authReady) {
    return (
      <main className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--color-felt-green-dark)' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
      </main>
    );
  }

  // If logged in, show nothing while redirect happens
  if (user) {
    return null;
  }

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
          {mode === 'register' ? (
            <>
              <label className="block">
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Username</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  maxLength={30}
                  className="mt-1 w-full px-4 py-2 rounded-lg"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                  }}
                  aria-label="Username"
                />
              </label>

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
            </>
          ) : (
            <label className="block">
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Username or Email</span>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="mt-1 w-full px-4 py-2 rounded-lg"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                }}
                aria-label="Username or email"
              />
            </label>
          )}

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

        {/* Guest access hidden — code preserved in authStore.initGuest() for future use */}
      </div>
    </main>
  );
}
