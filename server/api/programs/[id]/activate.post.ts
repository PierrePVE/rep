/**
 * POST /api/programs/:id/activate: makes this program the user's active one
 * (the one the home page proposes to start a session from).
 *
 * The previously active program, if any, is deactivated in the same
 * transaction. Calling it on the already active program is harmless.
 * Returns: the activated { id, name, active }. 404 if the program does not
 * exist or belongs to another user.
 */
import { and, eq } from 'drizzle-orm'
import { programs } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const program = await requireOwnedProgram(user.id, id)

  // Order matters: the partial unique index `programs_one_active_uq` allows
  // a single active program per user, so the old one must be switched off
  // first. batch() runs both updates in one transaction (the HTTP driver has
  // no interactive transactions), so the user never ends up with none active
  // because of a half-applied change.
  await useDb().batch([
    useDb()
      .update(programs)
      .set({ active: false })
      .where(and(eq(programs.userId, user.id), eq(programs.active, true))),
    useDb()
      .update(programs)
      .set({ active: true })
      .where(eq(programs.id, program.id)),
  ])

  return { ...program, active: true }
})
