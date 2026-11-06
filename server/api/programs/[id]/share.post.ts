/**
 * POST /api/programs/:id/share: turns on the share link of a program of the
 * current user. Calling it again keeps the same link (the token only changes
 * when the link is revoked and shared again), so a double tap is harmless.
 *
 * Returns: { shareToken }. The page builds the link: /programs/shared/<token>.
 * Errors: 401 if not logged in, 403 for the demo account (any visitor can use
 * it, so links made there would be anyone's), 400 if :id is invalid, 404 if
 * the program does not exist or belongs to another user.
 */
import { and, eq, sql } from 'drizzle-orm'
import { programs } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role === 'demo') {
    throw createError({ statusCode: 403, message: 'Le partage n\'est pas disponible sur le compte démo' })
  }
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)

  const [program] = await useDb()
    .update(programs)
    // coalesce: keeps the existing token if the program is already shared.
    .set({ shareToken: sql`coalesce(${programs.shareToken}, ${generateShareToken()})` })
    .where(and(eq(programs.id, id), eq(programs.userId, user.id)))
    .returning({ shareToken: programs.shareToken })

  if (!program) throw createError({ statusCode: 404, message: 'Programme introuvable' })
  return { shareToken: program.shareToken! }
})
