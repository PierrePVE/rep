/**
 * GET /api/follow-requests: the pending requests to follow the current user,
 * newest first.
 *
 * Returns: [{ username, createdAt }].
 * Errors: 401, 403 (demo), 400 (no username yet).
 */
import { and, desc, eq } from 'drizzle-orm'
import { follows, users } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const me = await requireSocialUser(event)
  const rows = await useDb()
    .select({ username: users.username, createdAt: follows.createdAt })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followerId))
    .where(and(eq(follows.followeeId, me.id), eq(follows.status, 'pending')))
    .orderBy(desc(follows.createdAt))
  // Followers always have a username: asking to follow requires one.
  return rows.map(r => ({ username: r.username!, createdAt: r.createdAt }))
})
