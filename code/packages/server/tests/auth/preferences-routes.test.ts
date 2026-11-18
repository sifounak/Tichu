// Verifies: REQ-F-UP01
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_USER_PREFERENCES } from '@tichu/shared';
import { createDatabase, type Database } from '../../src/db/connection.js';
import { users } from '../../src/db/schema.js';
import { registerPreferencesRoutes } from '../../src/auth/preferences-routes.js';
import { createApp } from '../../src/app.js';

const secret = 'preferences-test';
const headers = (id = 'alice') => ({ authorization: `Bearer ${jwt.sign({ userId: id, email: `${id}@test.com` }, secret)}` });

describe('account preferences API', () => {
  let app: FastifyInstance;
  let database: Database;
  beforeEach(async () => {
    database = createDatabase(':memory:');
    await database.db.insert(users).values([
      { id: 'alice', displayName: 'Alice', isGuest: false },
      { id: 'bob', displayName: 'Bob', isGuest: false },
      { id: 'guest', displayName: 'Guest', isGuest: true },
    ]);
    app = Fastify();
    registerPreferencesRoutes(app, database, secret);
  });
  afterEach(async () => { await app.close(); database.close(); });

  it('returns defaults and persists independent account preferences', async () => {
    const url = '/api/users/me/preferences';
    expect((await app.inject({ url, headers: headers() })).json().preferences).toEqual(DEFAULT_USER_PREFERENCES);
    const preferences = { ...DEFAULT_USER_PREFERENCES, cardOrder: 'ascending', cardOverlap: 'leftOnTop', chatSound: false };
    expect((await app.inject({ method: 'PUT', url, headers: headers(), payload: preferences })).json().preferences).toEqual(preferences);
    expect((await app.inject({ url, headers: headers() })).json().preferences).toEqual(preferences);
    expect((await app.inject({ url, headers: headers('bob') })).json().preferences).toEqual(DEFAULT_USER_PREFERENCES);
    preferences.cardOrder = 'descending';
    await app.inject({ method: 'PUT', url, headers: headers(), payload: preferences });
    expect((await app.inject({ url, headers: headers() })).json().preferences).toEqual(preferences);
  });

  it.each([undefined, { authorization: 'Bearer invalid' }, headers('guest'), headers('missing')])('rejects unauthenticated/guest/missing accounts', async (auth) => {
    for (const method of ['GET', 'PUT'] as const) {
      const res = await app.inject({ method, url: '/api/users/me/preferences', headers: auth, ...(method === 'PUT' ? { payload: DEFAULT_USER_PREFERENCES } : {}) });
      expect(res.statusCode).toBe(401);
    }
  });

  it.each([{ cardOrder: 'up' }, { soundEnabled: 'false' }, { userId: 'bob' }, { cardOverlap: 'sideways' }])('rejects invalid or extra fields without updating preferences', async (invalid) => {
    const res = await app.inject({ method: 'PUT', url: '/api/users/me/preferences', headers: headers(), payload: { ...DEFAULT_USER_PREFERENCES, ...invalid } });
    expect(res.statusCode).toBe(400);
    expect((await app.inject({ url: '/api/users/me/preferences', headers: headers() })).json().preferences).toEqual(DEFAULT_USER_PREFERENCES);
  });

  it('rejects incomplete preference objects', async () => {
    expect((await app.inject({ method: 'PUT', url: '/api/users/me/preferences', headers: headers(), payload: {} })).statusCode).toBe(400);
  });

  it('preserves preferences when the SQLite database is closed and reopened', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'tichu-preferences-'));
    let persistent = createDatabase(join(directory, 'preferences.sqlite'));
    let routes = Fastify();
    try {
      await persistent.db.insert(users).values({ id: 'alice', displayName: 'Alice', isGuest: false });
      registerPreferencesRoutes(routes, persistent, secret);
      const preferences = { ...DEFAULT_USER_PREFERENCES, cardOrder: 'ascending', yourTurnSound: false };
      expect((await routes.inject({ method: 'PUT', url: '/api/users/me/preferences', headers: headers(), payload: preferences })).statusCode).toBe(200);
      await routes.close(); persistent.close();
      persistent = createDatabase(join(directory, 'preferences.sqlite'));
      routes = Fastify(); registerPreferencesRoutes(routes, persistent, secret);
      expect((await routes.inject({ url: '/api/users/me/preferences', headers: headers() })).json().preferences).toEqual(preferences);
    } finally {
      await routes.close(); persistent.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('allows PUT in the application CORS preflight response', async () => {
    const application = createApp({ databasePath: ':memory:', corsOrigin: 'http://localhost:3000' });
    try {
      const response = await application.fastify.inject({ method: 'OPTIONS', url: '/api/users/me/preferences',
        headers: { origin: 'http://localhost:3000', 'access-control-request-method': 'PUT' } });
      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-methods']).toContain('PUT');
      expect(response.headers['access-control-allow-headers']).toContain('Authorization');
    } finally { await application.stop(); }
  });
});
