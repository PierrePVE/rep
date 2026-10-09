/**
 * PATCH /api/programs/:id: renames one of the current user's programs.
 *
 * Body: { name }. Returns: the updated { id, name, active }.
 * 400 if :id or the name is invalid, 404 if the program does not exist or
 * belongs to another user, 409 if the user already has a program with that name.
 */
import { and, eq } from 'drizzle-orm'
import { programs } from '../../db/schema'

export default defineEventHandler(async (event) => {
  // 401 if not logged in. Also gives the user id used to check ownership.
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const { name } = await readValidatedBody(event, body => programSchema.parse(body))

  // Ownership is part of the WHERE, as in the DELETE route: one atomic query.
  let updated
  try {
    [updated] = await useDb()
      .update(programs)
      .set({ name })
      .where(and(eq(programs.id, id), eq(programs.userId, user.id)))
      .returning({ id: programs.id, name: programs.name, active: programs.active })
  }
  catch (error) {
    // Same unique index (user_id, name) as on creation.
    if (isUniqueViolation(error)) {
      throw createError({ statusCode: 409, message: 'Un programme existe déjà avec ce nom' })
    }
    throw error
  }

  if (!updated) throw createError({ statusCode: 404, message: 'Programme introuvable' })
  return updated
})
