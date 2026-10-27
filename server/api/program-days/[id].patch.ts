/**
 * PATCH /api/program-days/:id: renames a session day.
 *
 * Body: { name }. Returns: the updated { id, programId, name, position }.
 * 400 if the input is invalid, 404 if the day does not exist or belongs to
 * another user.
 */
import { eq } from 'drizzle-orm'
import { programDays } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const { name } = await readValidatedBody(event, body => programDaySchema.parse(body))
  const day = await requireOwnedDay(user.id, id)

  const [updated] = await useDb()
    .update(programDays)
    .set({ name })
    .where(eq(programDays.id, day.id))
    .returning()

  // Only reachable if the day was deleted between the check and the update.
  if (!updated) throw createError({ statusCode: 404, message: 'Séance introuvable' })
  return updated
})
