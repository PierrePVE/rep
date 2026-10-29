/**
 * GET /api/exercises/:id/last: what the current user did on this exercise
 * last time, shown as a reminder under the exercise during a session.
 *
 * "Last time" = the most recent FINISHED session containing the exercise. The
 * session in progress is left out on purpose: once a first set is logged, the
 * reminder would otherwise show today's sets instead of the previous session.
 * Returns: { last: { workoutId, startedAt, sets } }, the sets in session order
 * (exercise position, then set position; an exercise done twice in the same
 * session gives the sets of both), or { last: null } if the exercise was
 * never done. A 200 in both cases: a new exercise has no history, that is
 * not an error.
 * Errors: 401 if not logged in, 400 if :id is invalid, 404 if the exercise
 * does not exist or belongs to another user.
 */
import { and, asc, desc, eq, isNotNull } from 'drizzle-orm'
import { sets, workoutExercises, workouts } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  // Without it, a foreign exercise would answer { last: null } instead of 404.
  await requireOwnedExercise(user.id, id)
  const db = useDb()

  const [workout] = await db
    .select({ id: workouts.id, startedAt: workouts.startedAt })
    .from(workouts)
    .innerJoin(workoutExercises, eq(workoutExercises.workoutId, workouts.id))
    .where(and(
      eq(workouts.userId, user.id),
      eq(workoutExercises.exerciseId, id),
      isNotNull(workouts.endedAt),
    ))
    .orderBy(desc(workouts.startedAt))
    .limit(1)
  if (!workout) return { last: null }

  const lastSets = await db
    .select({
      id: sets.id,
      weightKg: sets.weightKg,
      reps: sets.reps,
      rpe: sets.rpe,
      type: sets.type,
    })
    .from(sets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, sets.workoutExerciseId))
    .where(and(
      eq(workoutExercises.workoutId, workout.id),
      eq(workoutExercises.exerciseId, id),
    ))
    .orderBy(asc(workoutExercises.position), asc(sets.position))

  return { last: { workoutId: workout.id, startedAt: workout.startedAt, sets: lastSets } }
})
