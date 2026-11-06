/**
 * DELETE /api/followers/:username: removes a follower, or refuses their
 * pending request. They are not told; they can ask again later.
 *
 * Returns: 204 (also when they did not follow).
 * Errors: 401, 403 (demo), 400 (no username yet), 404 if nobody has it.
 */
import { and, eq } from 'drizzle-orm'
import { follows } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const me = await requireSocialUser(event)
  const follower = await requireUserByUsername(getRouterParam(event, 'username') ?? '')

  await useDb().delete(follows).where(and(eq(follows.followerId, follower.id), eq(follows.followeeId, me.id)))
  setResponseStatus(event, 204)
  return null
})
