/**
 * GET /api/feed/:id: read-only detail of a session from the feed, with its
 * exercises and sets, for its owner or a follower who may see it.
 *
 * The notes are left out for others: they are a private journal (pains,
 * feelings), not a caption. The program plan is left out too.
 *
 * Returns: { workout: { id, name, startedAt, endedAt, photoUrl, exercises },
 *   username, mine, likeCount, likedByMe }.
 * Errors: 401, 403 (demo), 400 (no username yet, invalid id), 404 if the
 * session does not exist or the user may not see it.
 */
import { and, count, eq } from 'drizzle-orm'
import { users, workoutLikes } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const me = await requireSocialUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const viewable = await requireViewableWorkout(me.id, id)
  const db = useDb()

  const [full, [owner], [likes], [mine]] = await Promise.all([
    loadWorkout(viewable.userId, id),
    db.select({ username: users.username }).from(users).where(eq(users.id, viewable.userId)),
    db.select({ n: count() }).from(workoutLikes).where(eq(workoutLikes.workoutId, id)),
    db.select({ n: count() }).from(workoutLikes).where(and(eq(workoutLikes.workoutId, id), eq(workoutLikes.userId, me.id))),
  ])
  if (!full) throw createError({ statusCode: 404, message: 'Séance introuvable' })

  return {
    workout: {
      id: full.id,
      name: full.name,
      startedAt: full.startedAt,
      endedAt: full.endedAt,
      photoUrl: full.photoUrl,
      exercises: full.exercises,
      ...(viewable.mine ? { notes: full.notes } : {}),
    },
    username: owner!.username!,
    mine: viewable.mine,
    likeCount: likes!.n,
    likedByMe: mine!.n > 0,
  }
})
