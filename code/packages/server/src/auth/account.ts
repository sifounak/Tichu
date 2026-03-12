// REQ-F-AU02: Optional account registration — email + password, JWT tokens

import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Database } from '../db/connection.js';
import { users } from '../db/schema.js';

const SALT_ROUNDS = 10;
const JWT_EXPIRY = '7d';

export interface AuthTokenPayload {
  userId: string;
  email: string;
}

/**
 * Registers a new account by upgrading a guest or creating a fresh user.
 * Returns a JWT token on success.
 */
export async function registerAccount(
  database: Database,
  jwtSecret: string,
  params: {
    userId: string; // existing guest ID to upgrade, or new ID
    email: string;
    password: string;
    displayName: string;
  },
): Promise<{ token: string; userId: string }> {
  const { db } = database;
  const { userId, email, password, displayName } = params;

  // Check if email already taken
  const existingEmail = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingEmail.length > 0) {
    throw new Error('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Check if userId already exists (guest upgrade)
  const existingUser = await db.select({ id: users.id, isGuest: users.isGuest })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (existingUser.length > 0) {
    if (!existingUser[0].isGuest) {
      throw new Error('Account already registered');
    }
    // Upgrade guest to registered account
    await db.update(users).set({
      email,
      passwordHash,
      displayName,
      isGuest: false,
      lastSeenAt: new Date(),
    }).where(eq(users.id, userId));
  } else {
    // Create new registered user
    await db.insert(users).values({
      id: userId,
      displayName,
      email,
      passwordHash,
      isGuest: false,
    });
  }

  const token = jwt.sign({ userId, email } satisfies AuthTokenPayload, jwtSecret, { expiresIn: JWT_EXPIRY });
  return { token, userId };
}

/**
 * Logs in with email + password.
 * Returns a JWT token on success.
 */
export async function loginAccount(
  database: Database,
  jwtSecret: string,
  email: string,
  password: string,
): Promise<{ token: string; userId: string; displayName: string }> {
  const { db } = database;

  const result = await db.select({
    id: users.id,
    displayName: users.displayName,
    email: users.email,
    passwordHash: users.passwordHash,
  }).from(users).where(eq(users.email, email)).limit(1);

  if (result.length === 0 || !result[0].passwordHash) {
    throw new Error('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, result[0].passwordHash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  // Update last seen
  await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, result[0].id));

  const token = jwt.sign(
    { userId: result[0].id, email: result[0].email! } satisfies AuthTokenPayload,
    jwtSecret,
    { expiresIn: JWT_EXPIRY },
  );

  return { token, userId: result[0].id, displayName: result[0].displayName };
}

/**
 * Verifies a JWT token and returns the payload.
 */
export function verifyToken(token: string, jwtSecret: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (
      typeof decoded === 'object' && decoded !== null &&
      typeof (decoded as any).userId === 'string' &&
      typeof (decoded as any).email === 'string'
    ) {
      return { userId: (decoded as any).userId, email: (decoded as any).email };
    }
    return null;
  } catch {
    return null;
  }
}
