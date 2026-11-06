/**
 * DELETE /api/workouts/:id/photo: removes the photo of a session of the
 * current user.
 *
 * Returns: 204 No Content (also when there was no photo).
 * Errors: 401 if not logged in, 400 if :id is invalid, 404 if the workout
 * does not exist or belongs to another user.
 */
import { eq } from 'drizzle-orm'
import { workoutPhotos } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  await requireOwnedWorkout(user.id, id)

  await useDb().delete(workoutPhotos).where(eq(workoutPhotos.workoutId, id))
  setResponseStatus(event, 204)
  return null
})
