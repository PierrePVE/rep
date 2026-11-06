/**
 * DELETE /api/workouts/:id/like: takes back the current user's "bravo".
 *
 * Returns: { likeCount, likedByMe: false } (also when there was none).
 * Errors: 401, 403 (demo), 400 (no username yet, invalid id), 404 if the
 * session does not exist or the user may not see it.
 */
import { and, count, eq } from 'drizzle-orm'
import { workoutLikes } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const me = await requireSocialUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  await requireViewableWorkout(me.id, id)
  const db = useDb()

  await db.delete(workoutLikes).where(and(eq(workoutLikes.workoutId, id), eq(workoutLikes.userId, me.id)))
  const [likes] = await db.select({ n: count() }).from(workoutLikes).where(eq(workoutLikes.workoutId, id))
  return { likeCount: likes!.n, likedByMe: false }
})
