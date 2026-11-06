/**
 * DELETE /api/users/:username/follow: stops following a user, or cancels a
 * pending request.
 *
 * Returns: 204 (also when there was nothing to undo).
 * Errors: 401, 403 (demo), 400 (no username yet), 404 if nobody has it.
 */
import { and, eq } from 'drizzle-orm'
import { follows } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const me = await requireSocialUser(event)
  const target = await requireUserByUsername(getRouterParam(event, 'username') ?? '')

  await useDb().delete(follows).where(and(eq(follows.followerId, me.id), eq(follows.followeeId, target.id)))
  setResponseStatus(event, 204)
  return null
})
