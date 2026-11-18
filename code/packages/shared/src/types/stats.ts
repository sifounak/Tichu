// REQ-F-PS04: Participation views shared by clients, APIs and materialized caches.
export const PARTICIPATION_VIEWS = ['all', 'human-only', 'mixed', 'solo'] as const;
export type ParticipationView = typeof PARTICIPATION_VIEWS[number];

export interface ParticipationRecord {
  humanUserIds: string[];
  hadBot: boolean;
  inferred: boolean;
}

export interface ParticipationMetadata {
  participation: ParticipationView;
  inferredGames: number;
  totalGames: number;
}

export function classifyParticipation(record: ParticipationRecord): Exclude<ParticipationView, 'all'> {
  if (!record.hadBot) return 'human-only';
  return new Set(record.humanUserIds).size === 1 ? 'solo' : 'mixed';
}

export function parseParticipation(value: unknown): ParticipationView | undefined {
  return value === undefined ? 'all' : PARTICIPATION_VIEWS.find(view => view === value);
}
