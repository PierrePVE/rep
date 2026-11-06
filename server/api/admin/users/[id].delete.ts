/**
 * DELETE /api/admin/users/:id: deletes an account and all its data (admin only).
 *
 * Returns: 204. 400 when targeting one's own account, 404 if it does not exist.
 */
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { programs, users, workouts } from '../../../db/schema'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, params => paramsSchema.parse(params))

  // Deleting itself would leave the app without an admin.
  if (id === admin.id) {
    throw createError({ statusCode: 400, message: 'Impossible de supprimer votre propre compte' })
  }

  // Programs and workouts go first, in the same batch (one transaction):
  // their rows reference the user's exercises with 'no action', and a plain
  // user deletion cascades to exercises before those rows are gone, which
  // fails the foreign key check. The user deletion then cascades to the
  // sessions (logged out immediately) and the exercises.
  const [, , deleted] = await useDb().batch([
    useDb().delete(programs).where(eq(programs.userId, id)),
    useDb().delete(workouts).where(eq(workouts.userId, id)),
    useDb().delete(users).where(eq(users.id, id)).returning({ id: users.id }),
  ])
  if (deleted.length === 0) {
    throw createError({ statusCode: 404, message: 'Compte introuvable' })
  }

  setResponseStatus(event, 204)
  return null
})
