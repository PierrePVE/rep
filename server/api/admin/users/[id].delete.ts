/**
 * DELETE /api/admin/users/:id: deletes an account and all its data (admin only).
 *
 * The foreign keys cascade to the user's sessions (logged out immediately),
 * workouts, sets and exercises.
 *
 * Returns: 204. 400 when targeting one's own account, 404 if it does not exist.
 */
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '../../../db/schema'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, params => paramsSchema.parse(params))

  // Deleting itself would leave the app without an admin.
  if (id === admin.id) {
    throw createError({ statusCode: 400, message: 'Impossible de supprimer votre propre compte' })
  }

  const deleted = await useDb().delete(users).where(eq(users.id, id)).returning({ id: users.id })
  if (deleted.length === 0) {
    throw createError({ statusCode: 404, message: 'Compte introuvable' })
  }

  setResponseStatus(event, 204)
  return null
})
