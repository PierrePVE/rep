/**
 * DELETE /api/programs/:id/share: revokes the share link of a program of the
 * current user. The old link stops working at once (404); copies already
 * imported by others are not affected, they are theirs.
 *
 * Returns: 204 No Content (also when the program was not shared).
 * Errors: 401 if not logged in, 400 if :id is invalid, 404 if the program
 * does not exist or belongs to another user.
 */
import { and, eq } from 'drizzle-orm'
import { programs } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)

  const updated = await useDb()
    .update(programs)
    .set({ shareToken: null })
    .where(and(eq(programs.id, id), eq(programs.userId, user.id)))
    .returning({ id: programs.id })

  if (!updated.length) throw createError({ statusCode: 404, message: 'Programme introuvable' })
  setResponseStatus(event, 204)
  return null
})
