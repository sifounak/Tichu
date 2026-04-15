// REQ-F-AU10: Registration requires username, email, password
// REQ-F-AU11: Username unique (case-insensitive, trimmed)
// REQ-F-AU12: Username cannot be "bot" (case-insensitive)
// REQ-F-AU13: Username constraints: 1-30 chars, no leading/trailing spaces
// REQ-F-AU14: Login accepts (username OR email) + password
// REQ-F-AU15: Username is immutable after creation
// REQ-NF-AU02: Password hashed with bcrypt (10 rounds)

import { eq, sql } from 'drizzle-orm';
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

// REQ-F-AU12: Reserved usernames (case-insensitive)
const RESERVED_USERNAMES = ['bot'];

/**
 * Validates username constraints.
 * REQ-F-AU11, REQ-F-AU12, REQ-F-AU13
 */
export function validateUsername(username: string): { valid: boolean; error?: string } {
  const trimmed = username.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Username is required' };
  }
  if (trimmed.length > 30) {
    return { valid: false, error: 'Username must be 30 characters or less' };
  }
  if (trimmed !== username) {
    return { valid: false, error: 'Username must not have leading or trailing spaces' };
  }
  if (RESERVED_USERNAMES.includes(trimmed.toLowerCase())) {
    return { valid: false, error: `Username "${trimmed}" is reserved` };
  }

  return { valid: true };
}

/**
 * Registers a new account by upgrading a guest or creating a fresh user.
 * Returns a JWT token on success.
 * REQ-F-AU10, REQ-F-AU16
 */
export async function registerAccount(
  database: Database,
  jwtSecret: string,
  params: {
    userId: string;
    username: string;
    email: string;
    password: string;
  },
): Promise<{ token: string; userId: string }> {
  const { db } = database;
  const { userId, username, email, password } = params;

  // REQ-F-AU13: Validate username constraints
  const validation = validateUsername(username);
  if (!validation.valid) {
    throw new Error(validation.error!);
  }

  // REQ-F-AU11: Check if username already taken (case-insensitive)
  const existingUsername = await db.select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.username}) = LOWER(${username})`)
    .limit(1);

  if (existingUsername.length > 0) {
    throw new Error('Username already taken');
  }

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
    // REQ-F-AU16: Username replaces displayName as player identity
    await db.update(users).set({
      username,
      displayName: username,
      email,
      passwordHash,
      isGuest: false,
      lastSeenAt: new Date().toISOString(),
    }).where(eq(users.id, userId));
  } else {
    // Create new registered user
    await db.insert(users).values({
      id: userId,
      username,
      displayName: username,
      email,
      passwordHash,
      isGuest: false,
    });
  }

  const token = jwt.sign({ userId, email } satisfies AuthTokenPayload, jwtSecret, { expiresIn: JWT_EXPIRY });
  return { token, userId };
}

/**
 * Logs in with (username OR email) + password.
 * Detects which was provided: if identifier contains '@', treat as email.
 * REQ-F-AU14
 */
export async function loginAccount(
  database: Database,
  jwtSecret: string,
  identifier: string,
  password: string,
): Promise<{ token: string; userId: string; username: string }> {
  const { db } = database;

  // REQ-F-AU14: Detect whether identifier is email or username
  const isEmail = identifier.includes('@');

  const result = await db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    email: users.email,
    passwordHash: users.passwordHash,
  }).from(users).where(
    isEmail
      ? eq(users.email, identifier)
      : sql`LOWER(${users.username}) = LOWER(${identifier})`
  ).limit(1);

  if (result.length === 0 || !result[0].passwordHash) {
    throw new Error('Invalid credentials');
  }

  const valid = await bcrypt.compare(password, result[0].passwordHash);
  if (!valid) {
    throw new Error('Invalid credentials');
  }

  // Update last seen
  await db.update(users).set({ lastSeenAt: new Date().toISOString() }).where(eq(users.id, result[0].id));

  const token = jwt.sign(
    { userId: result[0].id, email: result[0].email! } satisfies AuthTokenPayload,
    jwtSecret,
    { expiresIn: JWT_EXPIRY },
  );

  return { token, userId: result[0].id, username: result[0].username ?? result[0].displayName };
}

/**
 * Verifies a JWT token and returns the payload.
 */
export function verifyToken(token: string, jwtSecret: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (
      typeof decoded === 'object' && decoded !== null &&
      'userId' in decoded && typeof decoded.userId === 'string' &&
      'email' in decoded && typeof decoded.email === 'string'
    ) {
      return { userId: decoded.userId, email: decoded.email };
    }
    return null;
  } catch {
    return null;
  }
}
