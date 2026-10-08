/**
 * GET /api/admin/users: lists all accounts (admin only).
 *
 * Returns: [{ id, email, role, createdAt }], oldest first. Never the password hash.
 */
import { asc } from 'drizzle-orm'
import { users } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return useDb()
    .select({ id: users.id, email: users.email, role: users.role, createdAt: users.createdAt })
    .from(users)
    .orderBy(asc(users.createdAt))
})
