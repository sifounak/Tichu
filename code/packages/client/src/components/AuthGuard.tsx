'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { buildLoginRedirectUrl } from '@/lib/authRedirect';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, authReady, loadFromStorage } = useAuthStore();

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  useEffect(() => {
    if (authReady && !user) {
      const destination = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      router.replace(buildLoginRedirectUrl(destination));
    }
  }, [authReady, router, user]);

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
