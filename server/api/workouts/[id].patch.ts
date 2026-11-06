/**
 * PATCH /api/workouts/:id: renames a session, edits its notes or changes who
 * sees it in the social feed, e.g. from the history page. Only the fields
 * sent change; an empty string clears a text field.
 *
 * Body: { name?, notes?, visibility? }. Returns: { id, name, notes, visibility }.
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
  if (changes.name === undefined && changes.notes === undefined && changes.visibility === undefined) {
    const workout = await loadWorkout(user.id, id)
    if (!workout) throw createError({ statusCode: 404, message: 'Séance introuvable' })
    return { id: workout.id, name: workout.name, notes: workout.notes, visibility: workout.visibility }
  }

  const [updated] = await useDb()
    .update(workouts)
    .set(changes)
    // userId in the WHERE is the ownership check: a foreign id updates nothing.
    .where(and(eq(workouts.id, id), eq(workouts.userId, user.id)))
    .returning({ id: workouts.id, name: workouts.name, notes: workouts.notes, visibility: workouts.visibility })

  if (!updated) throw createError({ statusCode: 404, message: 'Séance introuvable' })
  return updated
})
