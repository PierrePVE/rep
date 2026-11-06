/**
 * GET /api/followers: the users who follow the current user (accepted).
 *
 * Returns: [{ username }], sorted by username.
 * Errors: 401, 403 (demo), 400 (no username yet).
 */
import { and, asc, eq } from 'drizzle-orm'
import { follows, users } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const me = await requireSocialUser(event)
  const rows = await useDb()
    .select({ username: users.username })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followerId))
    .where(and(eq(follows.followeeId, me.id), eq(follows.status, 'accepted')))
    .orderBy(asc(users.username))
  return rows.map(r => ({ username: r.username! }))
})
