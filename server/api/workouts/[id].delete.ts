/**
 * DELETE /api/workouts/:id: deletes a session of the current user, with its
 * exercises and sets (ON DELETE CASCADE). Works on the session in progress
 * too, to drop one started by mistake.
 *
 * Returns: 204 No Content.
 * Errors: 401 if not logged in, 400 if :id is invalid, 404 if the session does
 * not exist or belongs to another user.
 */
import { and, eq } from 'drizzle-orm'
import { workouts } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)

  const deleted = await useDb()
    .delete(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, user.id)))
    .returning({ id: workouts.id })

  if (!deleted.length) throw createError({ statusCode: 404, message: 'Séance introuvable' })
  setResponseStatus(event, 204)
  return null
})
