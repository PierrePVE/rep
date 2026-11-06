/**
 * PATCH /api/workouts/:id: renames a session or edits its notes, e.g. from
 * the history page. Only the fields sent change; an empty string clears one.
 *
 * Body: { name?, notes? }. Returns: { id, name, notes }.
 * Errors: 401 if not logged in, 400 if :id or the body is invalid, 404 if the
 * session does not exist or belongs to another user.
 */
import { and, eq } from 'drizzle-orm'
import { workouts } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const changes = await readValidatedBody(event, workoutUpdateSchema.parse)

  // Nothing to update: answer with the current values rather than running an
  // UPDATE with an empty SET (which Drizzle refuses).
  if (changes.name === undefined && changes.notes === undefined) {
    const workout = await loadWorkout(user.id, id)
    if (!workout) throw createError({ statusCode: 404, message: 'Séance introuvable' })
    return { id: workout.id, name: workout.name, notes: workout.notes }
  }

  const [updated] = await useDb()
    .update(workouts)
    .set(changes)
    // userId in the WHERE is the ownership check: a foreign id updates nothing.
    .where(and(eq(workouts.id, id), eq(workouts.userId, user.id)))
    .returning({ id: workouts.id, name: workouts.name, notes: workouts.notes })

  if (!updated) throw createError({ statusCode: 404, message: 'Séance introuvable' })
  return updated
})
