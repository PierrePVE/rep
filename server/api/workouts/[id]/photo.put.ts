/**
 * PUT /api/workouts/:id/photo: sets or replaces the photo of a session of the
 * current user. The body is the raw image (JPEG or WebP, at most
 * MAX_PHOTO_BYTES), already shrunk by the client.
 *
 * Returns: { photoUrl }.
 * Errors: 401 if not logged in, 403 for the demo account (anyone can log into
 * it, so a personal photo must not end up there), 400 if :id is invalid, 404
 * if the workout does not exist or belongs to another user, 413 if the image
 * is too big, 415 if it is not a JPEG or WebP.
 */
import { sql } from 'drizzle-orm'
import { workoutPhotos } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role === 'demo') {
    throw createError({ statusCode: 403, message: 'Les photos ne sont pas disponibles sur le compte démo' })
  }
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  await requireOwnedWorkout(user.id, id)

  // Checked on the header first, so an oversized upload is refused without
  // being read; then on the actual body, since the header can lie.
  const declared = Number(getRequestHeader(event, 'content-length') ?? 0)
  if (declared > MAX_PHOTO_BYTES) throw createError({ statusCode: 413, message: 'Photo trop lourde' })
  const data = await readRawBody(event, false)
  if (!data?.length) throw createError({ statusCode: 400, message: 'Photo manquante' })
  if (data.length > MAX_PHOTO_BYTES) throw createError({ statusCode: 413, message: 'Photo trop lourde' })

  const mimeType = sniffPhotoType(data)
  if (!mimeType) throw createError({ statusCode: 415, message: 'Format non pris en charge (JPEG ou WebP)' })

  // Upsert: one photo per workout (primary key), a new one replaces it.
  const [photo] = await useDb()
    .insert(workoutPhotos)
    .values({ workoutId: id, data, mimeType })
    .onConflictDoUpdate({
      target: workoutPhotos.workoutId,
      set: { data, mimeType, updatedAt: sql`now()` },
    })
    .returning({ updatedAt: workoutPhotos.updatedAt })

  return { photoUrl: photoUrl(id, photo!.updatedAt)! }
})
