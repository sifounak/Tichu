// REQ-F-SP17: Deprecated — spectators now use /game/[gameId] with spectator detection
'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';

export default function SpectatePage(props: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(props.params);
  return (
    <AuthGuard>
      <RedirectToGame gameId={gameId} />
    </AuthGuard>
  );
}

function RedirectToGame({ gameId }: { gameId: string }) {
  const router = useRouter();
  useEffect(() => { router.replace(`/game/${gameId}`); }, [router, gameId]);
  return null;
}
