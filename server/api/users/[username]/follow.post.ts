/**
 * POST /api/users/:username/follow: asks to follow a user. The request stays
 * pending until they accept it. Asking again changes nothing.
 *
 * Returns: { followStatus } ('pending', or 'accepted' if it already was),
 * status 201.
 * Errors: 401, 403 (demo), 400 (no username yet, or following oneself), 404.
 */
import { and, eq } from 'drizzle-orm'
import { follows } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const me = await requireSocialUser(event)
  const target = await requireUserByUsername(getRouterParam(event, 'username') ?? '')
  if (target.id === me.id) throw createError({ statusCode: 400, message: 'Impossible de vous suivre vous-même' })

  const db = useDb()
  // The primary key makes a repeated request a no-op, even two sent at once.
  await db.insert(follows).values({ followerId: me.id, followeeId: target.id }).onConflictDoNothing()
  const [row] = await db
    .select({ status: follows.status })
    .from(follows)
    .where(and(eq(follows.followerId, me.id), eq(follows.followeeId, target.id)))

  setResponseStatus(event, 201)
  return { followStatus: row?.status ?? 'pending' }
})
