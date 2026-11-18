'use client';

// REQ-F-PS07: One URL filter and request lifecycle for every statistics surface.
import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PARTICIPATION_VIEWS, parseParticipation, type ParticipationView, type ParticipationMetadata } from '@tichu/shared';
import { API_BASE, getUserId } from './stats-types';

export const PARTICIPATION_LABELS: Record<ParticipationView, string> = {
  all: 'All games', 'human-only': 'Human-only games', mixed: 'Humans and bots', solo: 'Solo games',
};

export function useParticipationView(defaultView: ParticipationView = 'all'): ParticipationView {
  const search = useSearchParams();
  const value = search.get('participation');
  return value === null ? defaultView : parseParticipation(value) ?? defaultView;
}

export function withParticipation(url: string, participation: ParticipationView): string {
  const [path, query = ''] = url.split('?');
  const params = new URLSearchParams(query);
  params.set('participation', participation);
  return `${path}?${params.toString()}`;
}

export function ParticipationSelector({ defaultView = 'all' }: { defaultView?: ParticipationView }) {
  const view = useParticipationView(defaultView);
  const search = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <label htmlFor="participation-filter" style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Games included</label>
      <select id="participation-filter" value={view} onChange={event => {
        const params = new URLSearchParams(search.toString());
        params.set('participation', event.target.value);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }} className="rounded-lg px-3 py-2" style={{ background: '#143b27', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
        {PARTICIPATION_VIEWS.map(option => <option key={option} value={option}>{PARTICIPATION_LABELS[option]}</option>)}
      </select>
    </div>
  );
}

export function ParticipationNotice({ metadata }: { metadata?: ParticipationMetadata }) {
  if (!metadata) return null;
  return <div className="mb-4" style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }} aria-live="polite">
    {metadata.totalGames === 0 && <p>No games match this view.</p>}
    {metadata.inferredGames > 0 && <p>
      Participation in {metadata.inferredGames} older {metadata.inferredGames === 1 ? 'game is' : 'games is'} inferred from saved records; brief replacements may be missing.
    </p>}
  </div>;
}

export function useStatsData<T extends { metadata?: ParticipationMetadata }>(endpoint: string | null, defaultView: ParticipationView = 'all') {
  const participation = useParticipationView(defaultView);
  const key = endpoint === null ? '' : withParticipation(endpoint, participation);
  const [state, setState] = useState<{ key: string; data: T | null; loading: boolean; error: string | null }>({
    key: '', data: null, loading: true, error: null,
  });
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    let active = true;
    setState({ key, data: null, loading: true, error: null });
    fetch(`${API_BASE}${key}`, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Statistics request failed');
        return response.json() as Promise<T>;
      })
      .then(data => { if (active) setState({ key, data, loading: false, error: null }); })
      .catch(() => { if (active) setState({ key, data: null, loading: false, error: 'Unable to load statistics. Please try again.' }); });
    return () => { active = false; controller.abort(); };
  }, [key]);
  const current = state.key === key ? state : { data: null, loading: true, error: null };
  return { ...current, participation, metadata: current.data?.metadata };
}

export function usePlayerStats<T extends { metadata?: ParticipationMetadata }>(resource: string, overrideUserId?: string | null) {
  const router = useRouter();
  const [storedUserId, setStoredUserId] = useState<string | null>(null);
  useEffect(() => {
    const id = getUserId();
    setStoredUserId(id);
    if (!overrideUserId && !id) router.push('/lobby');
  }, [router, overrideUserId]);
  const userId = overrideUserId ?? storedUserId;
  return { ...useStatsData<T>(userId ? `/api/players/${encodeURIComponent(userId)}/${resource}` : null), userId };
}
