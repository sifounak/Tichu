'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, authReady, loadFromStorage } = useAuthStore();

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  useEffect(() => {
    if (authReady && !user) {
      router.replace('/');
    }
  }, [authReady, user, router]);

  if (!authReady) {
    return (
      <main className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--color-felt-green-dark)' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
