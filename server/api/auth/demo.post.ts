/**
 * POST /api/auth/demo: logs into the demo account, without a password.
 *
 * Powers the "Try the demo" button for the portfolio. The demo account is
 * public anyway, and doing it server-side means its credentials never have to
 * be shipped to the browser.
 *
 * Returns: { user } and sets the session cookie. 404 if no demo account exists
 * (run `npm run db:seed`).
 */
import { eq } from 'drizzle-orm'
import { users } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const [demo] = await useDb()
    .select({ id: users.id, email: users.email, role: users.role, username: users.username })
    .from(users)
    .where(eq(users.role, 'demo'))
    .limit(1)
  if (!demo) {
    throw createError({ statusCode: 404, message: 'Aucun compte de démo configuré' })
  }

  await deleteExpiredSessions(demo.id)
  await startSession(event, demo)
  return { user: demo }
})
