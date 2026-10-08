/**
 * POST /api/auth/login: email + password login.
 *
 * Body: { email, password } (loginSchema).
 * Returns: { user } and sets the session cookie. 401 on bad credentials.
 */
import { eq, sql } from 'drizzle-orm'
import { users } from '../../db/schema'

// Hash of a throwaway password, checked when the email is unknown so that the
// response takes as long as for a wrong password (see below). Computed once,
// on first use.
let dummyHash: Promise<string> | undefined

export default defineEventHandler(async (event) => {
  const { email, password } = await readValidatedBody(event, body => loginSchema.parse(body))
  const db = useDb()

  const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email))

  // Always run the (slow) hash check, even for an unknown email: answering
  // faster when the email does not exist would reveal which emails have an
  // account. For the same reason the error message is the same in both cases.
  dummyHash ??= hashPassword('dummy-password-for-timing')
  const valid = await verifyPassword(user?.passwordHash ?? await dummyHash, password)
  if (!user || !valid) {
    throw createError({ statusCode: 401, message: 'Email ou mot de passe incorrect' })
  }

  // If the hashing parameters were strengthened since this hash was made,
  // upgrade it now: login is the only moment we have the plain password.
  if (passwordNeedsReHash(user.passwordHash)) {
    await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, user.id))
  }

  await deleteExpiredSessions(user.id)
  const sessionUser = { id: user.id, email: user.email, role: user.role }
  await startSession(event, sessionUser)
  return { user: sessionUser }
})
