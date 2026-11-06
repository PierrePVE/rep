/**
 * GET /api/following: the users the current user follows or asked to follow.
 *
 * Returns: [{ username, followStatus }], sorted by username.
 * Errors: 401, 403 (demo), 400 (no username yet).
 */
import { asc, eq } from 'drizzle-orm'
import { follows, users } from '../db/schema'

export default defineEventHandler(async (event) => {
  const me = await requireSocialUser(event)
  const rows = await useDb()
    .select({ username: users.username, followStatus: follows.status })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followeeId))
    .where(eq(follows.followerId, me.id))
    .orderBy(asc(users.username))
  return rows.map(r => ({ username: r.username!, followStatus: r.followStatus }))
})
