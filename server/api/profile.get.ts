/**
 * GET /api/profile: the social profile of the current user.
 *
 * Returns: { username, followers, following, pendingRequests }. username is
 * null until picked; followers and following count accepted follows only,
 * pendingRequests the incoming requests waiting for an answer.
 * Errors: 401 if not logged in.
 */
import { and, count, eq } from 'drizzle-orm'
import { follows, users } from '../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = useDb()

  /** Counts the follows matching a condition. */
  const countWhere = async (where: ReturnType<typeof and>) =>
    (await db.select({ n: count() }).from(follows).where(where))[0]!.n

  const [[me], followers, following, pendingRequests] = await Promise.all([
    db.select({ username: users.username }).from(users).where(eq(users.id, user.id)),
    countWhere(and(eq(follows.followeeId, user.id), eq(follows.status, 'accepted'))),
    countWhere(and(eq(follows.followerId, user.id), eq(follows.status, 'accepted'))),
    countWhere(and(eq(follows.followeeId, user.id), eq(follows.status, 'pending'))),
  ])

  return { username: me?.username ?? null, followers, following, pendingRequests }
})
