/**
 * DELETE /api/workout-exercises/:id: removes an exercise from a session,
 * with its sets (cascade).
 *
 * The following exercises move up one place, so positions stay 0, 1, 2...
 * Returns: 204. 404 if it does not exist or belongs to another user.
 */
import { and, eq, gt, sql } from 'drizzle-orm'
import { workoutExercises } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const current = await requireOwnedWorkoutExercise(user.id, id)
  const db = useDb()

  // One transaction: never a deleted exercise with the others left un-shifted.
  await db.batch([
    db.delete(workoutExercises).where(eq(workoutExercises.id, current.id)),
    db
      .update(workoutExercises)
      .set({ position: sql`${workoutExercises.position} - 1` })
      .where(and(
        eq(workoutExercises.workoutId, current.workoutId),
        gt(workoutExercises.position, current.position),
      )),
  ])

  setResponseStatus(event, 204)
  return null
})
