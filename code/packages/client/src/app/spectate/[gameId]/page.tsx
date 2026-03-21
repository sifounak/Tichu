// REQ-F-SP17: Deprecated — spectators now use /game/[gameId] with spectator detection
'use client';

import { redirect } from 'next/navigation';
import { use } from 'react';

export default function SpectatePage(props: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(props.params);
  redirect(`/game/${gameId}`);
}
