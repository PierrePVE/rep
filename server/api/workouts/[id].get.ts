/**
 * GET /api/workouts/:id: one session of the current user, with its exercises
 * and sets (the same tree as GET /api/workouts/current, see loadWorkout), for
 * the history detail page.
 *
 * Returns: { workout }.
 * Errors: 401 if not logged in, 400 if :id is invalid, 404 if the session does
 * not exist or belongs to another user.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)

  const workout = await loadWorkout(user.id, id)
  if (!workout) throw createError({ statusCode: 404, message: 'Séance introuvable' })
  return { workout }
})
