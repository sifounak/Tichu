import { z } from 'zod';

// REQ-F-UP01: Account preferences are presentation-only and independent of room rules.
export const UserPreferencesSchema = z.object({
  cardOrder: z.enum(['ascending', 'descending']),
  cardOverlap: z.enum(['leftOnTop', 'rightOnTop']),
  soundEnabled: z.boolean(),
  cardsAndWagersSound: z.boolean(),
  yourTurnSound: z.boolean(),
  timerWarningSound: z.boolean(),
  chatSound: z.boolean(),
}).strict();

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type CardOrder = UserPreferences['cardOrder'];
export type CardOverlap = UserPreferences['cardOverlap'];

export const DEFAULT_USER_PREFERENCES: Readonly<UserPreferences> = Object.freeze({
  cardOrder: 'descending',
  cardOverlap: 'rightOnTop',
  soundEnabled: true,
  cardsAndWagersSound: true,
  yourTurnSound: true,
  timerWarningSound: true,
  chatSound: true,
});
