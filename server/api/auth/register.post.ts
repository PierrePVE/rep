/**
 * POST /api/auth/register: creates an account and logs it in.
 *
 * Body: { email, password } (registerSchema).
 * Returns: 201 { user } and sets the session cookie. 409 if the email is taken.
 */
import { eq } from 'drizzle-orm'
import { createDefaultExercises } from '../../db/defaultExercises'
import { users } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const { email, password } = await readValidatedBody(event, body => registerSchema.parse(body))
  const db = useDb()

  // Insert directly and let the unique index reject duplicates, instead of
  // checking first: two simultaneous sign-ups could both pass a prior check.
  let user
  try {
    [user] = await db
      .insert(users)
      .values({ email, passwordHash: await hashPassword(password) })
      .returning({ id: users.id, email: users.email, role: users.role, username: users.username })
  }
  catch (error) {
    if (isUniqueViolation(error)) {
      throw createError({ statusCode: 409, message: 'Un compte existe déjà avec cet email' })
    }
    throw error
  }
  if (!user) throw createError({ statusCode: 500, message: 'Création du compte impossible' })

  // Two separate requests: the HTTP driver has no transactions, and a batch
  // cannot pass the new user id to the second insert. If the exercises fail,
  // remove the account so the user can simply sign up again.
  try {
    await createDefaultExercises(db, user.id)
  }
  catch (error) {
    await db.delete(users).where(eq(users.id, user.id))
    throw error
  }

  await startSession(event, user)
  setResponseStatus(event, 201)
  return { user }
})
