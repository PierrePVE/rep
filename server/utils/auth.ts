/**
 * Glue between the nuxt-auth-utils cookie and the DB sessions.
 *
 * The cookie (encrypted by nuxt-auth-utils) holds the user for display and, in
 * its `secure` part, the session token. The cookie alone is never trusted:
 * every check goes through validateSession(), so deleting the DB row (logout,
 * account deleted by the admin) logs the user out immediately.
 */
import type { H3Event } from 'h3'
import type { User } from '#auth-utils'

/**
 * Logs a user in: creates the DB session and writes the cookie.
 *
 * @param event - Current request.
 * @param user - Public user data to put in the cookie.
 */
export async function startSession(event: H3Event, user: User): Promise<void> {
  const sessionToken = await createSession(user.id)
  // replace (not set): never merge with what a previous session left behind.
  await replaceUserSession(event, { user, secure: { sessionToken } })
}

/**
 * Returns the logged-in user of a request, checked against the database.
 * Clears the cookie when its session is no longer valid, and re-writes it when
 * the session was renewed or the user's data changed.
 *
 * @param event - Current request.
 * @returns The user, or null if not logged in.
 */
export async function resolveUser(event: H3Event): Promise<User | null> {
  const session = await getUserSession(event)
  const token = session.secure?.sessionToken
  if (!token) return null

  const result = await validateSession(token)
  if (!result) {
    await clearUserSession(event)
    return null
  }

  const { user, renewed } = result
  const stale = session.user?.email !== user.email || session.user?.role !== user.role
  // Re-writing the cookie also pushes its own expiry date forward, keeping it
  // in sync with the renewed DB session.
  if (renewed || stale) {
    await setUserSession(event, { user })
  }
  return user
}

/**
 * Guard for API routes that need a logged-in user.
 *
 * @param event - Current request.
 * @returns The logged-in user.
 * @throws 401 if not logged in or the session is no longer valid.
 */
export async function requireUser(event: H3Event): Promise<User> {
  const user = await resolveUser(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Connexion requise' })
  }
  return user
}

/**
 * Guard for admin-only API routes.
 *
 * @param event - Current request.
 * @returns The admin user.
 * @throws 401 if not logged in, 403 if logged in but not admin.
 */
export async function requireAdmin(event: H3Event): Promise<User> {
  const user = await requireUser(event)
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Réservé à l\'administrateur' })
  }
  return user
}
