/**
 * POST /api/workouts/:id/finish: ends a session of the current user.
 *
 * Returns: { id, endedAt }.
 * Errors: 401 if not logged in, 400 if :id is invalid, 404 if the workout does
 * not exist or belongs to another user, 409 if it is already finished.
 */
import { and, eq, isNull, sql } from 'drizzle-orm'
import { workouts } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const workout = await requireOwnedWorkout(user.id, id)
  if (workout.endedAt) throw createError({ statusCode: 409, message: 'Séance déjà terminée' })

  const [finished] = await useDb()
    .update(workouts)
    // now() from the database rather than the server's clock: startedAt was
    // set by the database too, so the ended_at >= started_at CHECK can never
    // fail because of a clock gap between the two machines.
    .set({ endedAt: sql`now()` })
    // endedAt IS NULL again: if two requests finish it at once, the second
    // updates nothing instead of moving the end date.
    .where(and(eq(workouts.id, id), isNull(workouts.endedAt)))
    .returning({ id: workouts.id, endedAt: workouts.endedAt })

  if (!finished) throw createError({ statusCode: 409, message: 'Séance déjà terminée' })
  return finished
})
