/**
 * GET /api/workouts/:id/photo: the photo of a session, as an image.
 *
 * Same audience as the session itself (see requireViewableWorkout): its
 * owner, and followers when it is visible to them. The URL carries a version (?v=, see photoUrl), so the response
 * can be cached for good; "private" keeps shared caches (CDN, proxies) from
 * storing a personal picture.
 *
 * Errors: 401 if not logged in, 400 if :id is invalid, 404 if the workout
 * does not exist, may not be seen by the user, or has no photo.
 */
import { eq } from 'drizzle-orm'
import { workoutPhotos } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  await requireViewableWorkout(user.id, id)

  const [photo] = await useDb()
    .select({ data: workoutPhotos.data, mimeType: workoutPhotos.mimeType })
    .from(workoutPhotos)
    .where(eq(workoutPhotos.workoutId, id))
  if (!photo) throw createError({ statusCode: 404, message: 'Pas de photo pour cette séance' })

  setResponseHeaders(event, {
    'content-type': photo.mimeType,
    'cache-control': 'private, max-age=31536000, immutable',
    // The stored type was sniffed at upload; nosniff makes the browser stick to it.
    'x-content-type-options': 'nosniff',
  })
  return photo.data
})
