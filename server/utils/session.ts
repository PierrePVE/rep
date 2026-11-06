/**
 * Server-side sessions stored in the `sessions` table (see schema.ts for the
 * design). This file only deals with the database; the cookie side lives in
 * server/utils/auth.ts.
 */
import { createHash, randomBytes } from 'node:crypto'
import type { User } from '#auth-utils'
import { and, eq, lt } from 'drizzle-orm'
import { sessions, users } from '../db/schema'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Lifetime of a session. Must match `runtimeConfig.session.maxAge` in
 * nuxt.config.ts, so the cookie and the DB row expire together.
 */
export const SESSION_DURATION_MS = 30 * DAY_MS

// Sliding expiration: a session used when less than this is left gets a full
// new lifetime. Renewing only past the halfway point (instead of on every
// request) saves a DB write on almost every call.
const RENEW_THRESHOLD_MS = 15 * DAY_MS

/**
 * Hashes a session token for storage / lookup.
 * SHA-256 is enough here (no need for a slow hash like scrypt): the token is
 * 256 random bits, so it cannot be brute-forced like a password.
 *
 * @param token - Raw token from the cookie.
 * @returns Hex-encoded SHA-256.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Opens a new session for a user.
 *
 * @param userId - Owner of the session.
 * @returns The raw token, to put in the (encrypted) cookie. Never stored as is.
 */
export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await useDb().insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  })
  return token
}

/**
 * Checks a session token and returns its user, renewing the session if needed.
 * Also returns fresh user data, so a role or email change in the DB is picked
 * up without logging out.
 *
 * @param token - Raw token from the cookie.
 * @returns The user and whether the session was renewed, or null if the
 *   session does not exist (logged out, account deleted) or has expired.
 */
export async function validateSession(token: string): Promise<{ user: User, renewed: boolean } | null> {
  const db = useDb()
  const id = hashToken(token)

  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      user: { id: users.id, email: users.email, role: users.role, username: users.username },
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
  if (!row) return null

  const now = Date.now()
  const remaining = row.expiresAt.getTime() - now
  if (remaining <= 0) {
    await db.delete(sessions).where(eq(sessions.id, id))
    return null
  }

  const renewed = remaining < RENEW_THRESHOLD_MS
  if (renewed) {
    await db.update(sessions)
      .set({ expiresAt: new Date(now + SESSION_DURATION_MS) })
      .where(eq(sessions.id, id))
  }
  return { user: row.user, renewed }
}

/**
 * Deletes one session (logout). No error if it does not exist anymore.
 *
 * @param token - Raw token from the cookie.
 */
export async function deleteSession(token: string): Promise<void> {
  await useDb().delete(sessions).where(eq(sessions.id, hashToken(token)))
}

/**
 * Removes a user's expired sessions. Called at login, which is enough to keep
 * the table small without a scheduled cleanup job.
 *
 * @param userId - User whose expired sessions are removed.
 */
export async function deleteExpiredSessions(userId: number): Promise<void> {
  await useDb().delete(sessions)
    .where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())))
}
