import type { FastifyInstance, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { DEFAULT_USER_PREFERENCES, UserPreferencesSchema } from '@tichu/shared';
import type { Database } from '../db/connection.js';
import { userPreferences } from '../db/schema.js';
import { getUserById } from './guest.js';
import { verifyToken } from './account.js';

// REQ-F-UP01: Identity comes exclusively from the verified account token.
export function registerPreferencesRoutes(app: FastifyInstance, database: Database, jwtSecret: string): void {
  async function accountId(request: FastifyRequest): Promise<string | null> {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? verifyToken(header.slice(7), jwtSecret) : null;
    if (!token) return null;
    const user = await getUserById(database, token.userId);
    return user && !user.isGuest ? user.id : null;
  }

  app.get('/api/users/me/preferences', async (request, reply) => {
    const userId = await accountId(request);
    if (!userId) return reply.status(401).send({ error: 'Sign in to manage preferences' });
    const [row] = await database.db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
    return { preferences: UserPreferencesSchema.parse({ ...DEFAULT_USER_PREFERENCES, ...row?.preferences }) };
  });

  app.put('/api/users/me/preferences', async (request, reply) => {
    const userId = await accountId(request);
    if (!userId) return reply.status(401).send({ error: 'Sign in to manage preferences' });
    const parsed = UserPreferencesSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid preferences' });
    await database.db.insert(userPreferences).values({ userId, preferences: parsed.data })
      .onConflictDoUpdate({ target: userPreferences.userId, set: { preferences: parsed.data } });
    return { preferences: parsed.data };
  });
}
