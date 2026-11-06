/**
 * GET /api/users?q=: finds users by username prefix, to follow them.
 *
 * Query: `q`, 2 to 20 characters (shorter would list everyone).
 * Returns: [{ username, followStatus }], at most 20, sorted by username.
 * followStatus is the current user's follow of them (null, 'pending' or
 * 'accepted'). The current user is left out.
 * Errors: 401, 403 (demo), 400 (no username yet, or invalid q).
 */
import { and, asc, eq, like, ne } from 'drizzle-orm'
import { z } from 'zod'
import { follows, users } from '../../db/schema'

const querySchema = z.object({ q: z.string().trim().toLowerCase().min(2).max(20) })

export default defineEventHandler(async (event) => {
  const me = await requireSocialUser(event)
  const { q } = await getValidatedQuery(event, query => querySchema.parse(query))
  // Escapes the LIKE wildcards: "_" is allowed in usernames and would
  // otherwise match any character.
  const pattern = `${q.replace(/[%_\\]/g, c => `\\${c}`)}%`

  const rows = await useDb()
    .select({ username: users.username, followStatus: follows.status })
    .from(users)
    .leftJoin(follows, and(eq(follows.followeeId, users.id), eq(follows.followerId, me.id)))
    .where(and(like(users.username, pattern), ne(users.id, me.id)))
    .orderBy(asc(users.username))
    .limit(20)
  // LIKE never matches NULL, so every row has a username.
  return rows.map(r => ({ username: r.username!, followStatus: r.followStatus }))
})
