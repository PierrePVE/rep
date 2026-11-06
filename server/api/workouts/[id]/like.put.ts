/**
 * PUT /api/workouts/:id/like: gives a "bravo" to a session the current user
 * can see (their own included, as on Strava). Idempotent: liking twice
 * counts once.
 *
 * Returns: { likeCount, likedByMe: true }.
 * Errors: 401, 403 (demo), 400 (no username yet, invalid id), 404 if the
 * session does not exist or the user may not see it.
 */
import { count, eq } from 'drizzle-orm'
import { workoutLikes } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const me = await requireSocialUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  await requireViewableWorkout(me.id, id)
  const db = useDb()

  // The (workoutId, userId) primary key makes a second like a no-op.
  await db.insert(workoutLikes).values({ workoutId: id, userId: me.id }).onConflictDoNothing()
  const [likes] = await db.select({ n: count() }).from(workoutLikes).where(eq(workoutLikes.workoutId, id))
  return { likeCount: likes!.n, likedByMe: true }
})
