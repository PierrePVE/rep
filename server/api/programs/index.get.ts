/**
 * GET /api/programs: lists the current user's programs, for the programs page.
 *
 * Only the program rows: days and exercises are loaded by GET /api/programs/:id
 * when one is opened, so the list stays a single light query.
 * Returns: [{ id, name, active }], sorted by name.
 */
import { asc, eq } from 'drizzle-orm'
import { programs } from '../../db/schema'

export default defineEventHandler(async (event) => {
  // 401 if not logged in. Also gives the user id used to filter below.
  const user = await requireUser(event)

  return useDb()
    .select({
      id: programs.id,
      name: programs.name,
      active: programs.active,
    })
    .from(programs)
    // Without this filter every account would receive everyone's programs.
    .where(eq(programs.userId, user.id))
    .orderBy(asc(programs.name))
})
