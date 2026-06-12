import { pct, type PlayerProfile } from './stats-types';

export interface TichuCallStat {
  label: string;
  successes: number;
  calls: number;
}

export const TICHU_CALL_STATS_ASCENDING = [
  {
    label: 'Tichu',
    successesKey: 'tichuSuccesses',
    callsKey: 'tichuCalls',
  },
  {
    label: 'Grand Tichu',
    successesKey: 'grandTichuSuccesses',
    callsKey: 'grandTichuCalls',
  },
  {
    label: 'Blind Grand',
    successesKey: 'blindGrandTichuSuccesses',
    callsKey: 'blindGrandTichuCalls',
  },
] as const;

export function getTichuCallStats(profile: PlayerProfile): TichuCallStat[] {
  return TICHU_CALL_STATS_ASCENDING.map(({ label, successesKey, callsKey }) => ({
    label,
    successes: profile[successesKey],
    calls: profile[callsKey],
  }));
}

export function getTichuSuccessSubtitle(successes: number, calls: number): string | undefined {
  const successRate = pct(successes, calls);
  return successRate !== '-' ? successRate : undefined;
}
