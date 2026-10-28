/**
 * POST /api/workouts/:id/exercises: adds an exercise at the end of a session.
 *
 * Works on finished sessions too, so that the history page can fix a
 * forgotten exercise afterwards. The same exercise may be added twice.
 * Body: { exerciseId }.
 * Returns: the created workout exercise with its exercise and an empty `sets`
 * list (status 201): the same shape as in loadWorkout, so the page can append
 * it as is.
 * Errors: 400 if the input is invalid or the exercise is not in the user's
 * catalogue, 404 if the workout does not exist or belongs to another user.
 */
import { and, eq, sql } from 'drizzle-orm'
import { exercises, workoutExercises } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const { exerciseId } = await readValidatedBody(event, body => workoutExerciseSchema.parse(body))
  const workout = await requireOwnedWorkout(user.id, id)
  const db = useDb()

  // The foreign key only proves the exercise exists, not that it is this
  // user's. Archived ones are refused too, as the picker hides them.
  const [exercise] = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
      equipment: exercises.equipment,
    })
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), eq(exercises.userId, user.id), eq(exercises.archived, false)))
  if (!exercise) throw createError({ statusCode: 400, message: 'Exercice introuvable' })

  const [created] = await db
    .insert(workoutExercises)
    .values({
      workoutId: workout.id,
      exerciseId: exercise.id,
      // max + 1 rather than the count: still correct if positions have a gap.
      position: sql`(SELECT COALESCE(MAX(${workoutExercises.position}), -1) + 1 FROM ${workoutExercises} WHERE ${workoutExercises.workoutId} = ${workout.id})`,
    })
    .returning()

  setResponseStatus(event, 201)
  return { ...created, exercise, sets: [] }
})
