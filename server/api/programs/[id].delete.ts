/**
 * DELETE /api/programs/:id: deletes one of the current user's programs.
 *
 * Its days and planned exercises go with it (FK cascade). Workouts started
 * from it are kept: their programDayId becomes null, the history stays.
 *
 * The active program cannot be deleted while the user has other programs:
 * a user with programs must always have one active, and picking a
 * replacement for them could activate one they did not want. The last
 * program can be deleted, active or not.
 *
 * Returns: 204. 400 if :id is invalid, 404 if the program does not exist or
 * belongs to another user (same answer, so other users' ids cannot be probed),
 * 409 if it is the active program and others exist.
 */
import { and, eq, exists, ne, not, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { programs } from '../../db/schema'

// Second reference to the table for the "other programs" subquery, so its
// columns are not confused with those of the row being deleted.
const others = alias(programs, 'others')

export default defineEventHandler(async (event) => {
  // 401 if not logged in. Also gives the user id used to check ownership.
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)

  const db = useDb()

  // Ownership and the active-program rule are both part of the WHERE: checks
  // and delete happen in one atomic query, instead of a prior lookup that
  // could go stale before the delete (e.g. a program activated meanwhile).
  const deleted = await db
    .delete(programs)
    .where(and(
      eq(programs.id, id),
      eq(programs.userId, user.id),
      or(
        not(programs.active),
        not(exists(
          db.select({ id: others.id }).from(others)
            .where(and(eq(others.userId, user.id), ne(others.id, id))),
        )),
      ),
    ))
    .returning({ id: programs.id })

  if (deleted.length === 0) {
    // Nothing deleted: find out why, to answer 404 or 409. This lookup only
    // picks the error message, so it does not need to be atomic.
    const program = await db.query.programs.findFirst({
      columns: { id: true },
      where: (p, { and, eq }) => and(eq(p.id, id), eq(p.userId, user.id)),
    })
    if (!program) throw createError({ statusCode: 404, message: 'Programme introuvable' })
    throw createError({
      statusCode: 409,
      message: 'Activez un autre programme avant de supprimer celui-ci',
    })
  }

  setResponseStatus(event, 204)
  return null
})
