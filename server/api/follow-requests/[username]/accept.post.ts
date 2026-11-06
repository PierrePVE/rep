/**
 * POST /api/follow-requests/:username/accept: accepts a pending request; that
 * user now sees the current user's sessions in their feed. Refusing is
 * DELETE /api/followers/:username.
 *
 * Returns: 204.
 * Errors: 401, 403 (demo), 400 (no username yet), 404 if there is no pending
 * request from this user.
 */
import { and, eq } from 'drizzle-orm'
import { follows } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const me = await requireSocialUser(event)
  const follower = await requireUserByUsername(getRouterParam(event, 'username') ?? '')

  const updated = await useDb()
    .update(follows)
    .set({ status: 'accepted' })
    .where(and(eq(follows.followerId, follower.id), eq(follows.followeeId, me.id), eq(follows.status, 'pending')))
    .returning({ status: follows.status })
  if (!updated.length) throw createError({ statusCode: 404, message: 'Demande introuvable' })

  setResponseStatus(event, 204)
  return null
})
