/**
 * GET /api/workouts/current: the session in progress of the current user.
 *
 * Returns: { workout } with the full tree (see loadWorkout), or
 * { workout: null } when no session is in progress. A 200 in both cases:
 * having no session in progress is a normal state, not an error.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return { workout: await loadWorkout(user.id) }
})
