/**
 * DELETE /api/programs/:id: deletes one of the current user's programs.
 *
 * Its days and planned exercises go with it (FK cascade). Workouts started
 * from it are kept: their programDayId becomes null, the history stays.
 *
 * Returns: 204. 400 if :id is invalid, 404 if the program does not exist or
 * belongs to another user (same answer, so other users' ids cannot be probed).
 */
import { and, eq } from 'drizzle-orm'
import { programs } from '../../db/schema'

export default defineEventHandler(async (event) => {
  // 401 if not logged in. Also gives the user id used to check ownership.
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)

  // Ownership is part of the WHERE: check and delete happen in one atomic
  // query, instead of a prior lookup that could go stale before the delete.
  const deleted = await useDb()
    .delete(programs)
    .where(and(eq(programs.id, id), eq(programs.userId, user.id)))
    .returning({ id: programs.id })

  if (deleted.length === 0) {
    throw createError({ statusCode: 404, message: 'Programme introuvable' })
  }

  setResponseStatus(event, 204)
  return null
})
