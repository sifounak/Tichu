// REQ-F-AU01: Guest access — play immediately with display name, no registration

import { eq } from 'drizzle-orm';
import type { Database } from '../db/connection.js';
import { users } from '../db/schema.js';

/**
 * Ensures a guest user exists in the database.
 * Creates a new record if the userId doesn't exist, otherwise updates lastSeenAt.
 * Returns the user record.
 */
export async function ensureGuestUser(
  database: Database,
  userId: string,
  displayName: string,
): Promise<{ id: string; displayName: string; isGuest: boolean }> {
  const { db } = database;

  // Try to find existing user
  const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (existing.length > 0) {
    // Update last seen and display name
    await db.update(users)
      .set({ lastSeenAt: new Date().toISOString(), displayName })
      .where(eq(users.id, userId));
    return { id: existing[0].id, displayName, isGuest: existing[0].isGuest };
  }

  // Create new guest user
  const [newUser] = await db.insert(users).values({
    id: userId,
    displayName,
    isGuest: true,
  }).returning();

  return { id: newUser.id, displayName: newUser.displayName, isGuest: newUser.isGuest };
}

/**
 * Gets a user by ID. Returns undefined if not found.
 */
// REQ-F-AU16: Return username for registered users
export async function getUserById(
  database: Database,
  userId: string,
): Promise<{ id: string; username: string | null; displayName: string; email: string | null; isGuest: boolean } | undefined> {
  const { db } = database;
  const result = await db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    email: users.email,
    isGuest: users.isGuest,
  }).from(users).where(eq(users.id, userId)).limit(1);

  return result[0];
}
