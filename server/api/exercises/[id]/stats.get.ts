/**
 * GET /api/exercises/:id/stats: everything the exercise page shows.
 *
 * Returns: { exercise: { id, name, muscleGroup, equipment, archived },
 *   records: { maxWeight, e1rm, setVolume, repMaxes } (see exerciseRecords),
 *   sessions: [{ workoutId, startedAt, bestE1rm, volumeKg, sets }] oldest
 *   first (see exerciseSessions) }.
 * The session in progress is included: its sets are real work.
 * Errors: 401 if not logged in, 400 if :id is invalid, 404 if the exercise
 * does not exist or belongs to another user.
 */
import { and, eq } from 'drizzle-orm'
import { exercises } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)

  const [exercise] = await useDb()
    .select({
      id: exercises.id,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
      equipment: exercises.equipment,
      archived: exercises.archived,
    })
    .from(exercises)
    // userId in the WHERE is the ownership check.
    .where(and(eq(exercises.id, id), eq(exercises.userId, user.id)))
  if (!exercise) throw createError({ statusCode: 404, message: 'Exercice introuvable' })

  const sets = await loadExerciseSets(user.id, id)
  return { exercise, records: exerciseRecords(sets), sessions: exerciseSessions(sets) }
})
