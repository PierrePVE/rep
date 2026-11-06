/**
 * PATCH /api/profile: picks or changes the username of the current user.
 * Body: { username } (see usernameSchema; lowercased).
 *
 * Returns: { username }. The session cookie catches up on the next request
 * (resolveUser notices the change); the page calls fetch() to get it now.
 * Errors: 401 if not logged in, 403 for the demo account, 400 if the username
 * is invalid, 409 if someone already has it.
 */
import { eq } from 'drizzle-orm'
import { users } from '../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role === 'demo') {
    throw createError({ statusCode: 403, message: 'Le fil social n\'est pas disponible sur le compte démo' })
  }
  const { username } = await readValidatedBody(event, body => profileUpdateSchema.parse(body))

  try {
    await useDb().update(users).set({ username }).where(eq(users.id, user.id))
  }
  catch (error) {
    // The unique index decides, not a prior check: two users could otherwise
    // grab the same name at the same time.
    if (isUniqueViolation(error)) throw createError({ statusCode: 409, message: 'Ce pseudo est déjà pris' })
    throw error
  }
  return { username }
})
