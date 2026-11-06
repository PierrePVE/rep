/**
 * GET /api/users/:username: public profile of a user.
 *
 * Returns: { username, isMe, followers, following, followStatus, followsMe }.
 * followStatus is the current user's follow of them (null, 'pending' or
 * 'accepted'); followsMe whether they follow the current user (accepted).
 * Their sessions come from GET /api/feed?user=, which applies the
 * visibility rules.
 * Errors: 401, 403 (demo), 400 (no username yet), 404 if nobody has it.
 */
import { and, count, eq } from 'drizzle-orm'
import { follows } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const me = await requireSocialUser(event)
  const target = await requireUserByUsername(getRouterParam(event, 'username') ?? '')
  const db = useDb()

  /** Counts the follows matching a condition. */
  const countWhere = async (where: ReturnType<typeof and>) =>
    (await db.select({ n: count() }).from(follows).where(where))[0]!.n
  /** Status of the follow of `followerId` on `followeeId`, null if none. */
  const statusOf = async (followerId: number, followeeId: number) =>
    (await db.select({ status: follows.status }).from(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId))))[0]?.status ?? null

  const [followers, following, followStatus, theirStatus] = await Promise.all([
    countWhere(and(eq(follows.followeeId, target.id), eq(follows.status, 'accepted'))),
    countWhere(and(eq(follows.followerId, target.id), eq(follows.status, 'accepted'))),
    statusOf(me.id, target.id),
    statusOf(target.id, me.id),
  ])

  return {
    username: target.username,
    isMe: target.id === me.id,
    followers,
    following,
    followStatus,
    followsMe: theirStatus === 'accepted',
  }
})
