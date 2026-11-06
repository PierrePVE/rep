/**
 * GET /api/feed: the social feed, newest first, one page at a time: the
 * current user's finished sessions and the visible ones of the users they
 * follow (see loadFeed).
 *
 * Query: `?limit=` (1-50, default 20), `?cursor=` the id of the last session
 * of the previous page, `?user=` a username to list only their sessions
 * (profile page).
 * Returns: { items: [{ id, username, mine, name, startedAt, endedAt,
 *   visibility, exerciseCount, setCount, volumeKg, photoUrl, likeCount,
 *   likedByMe, prCount }], nextCursor }.
 * Errors: 401, 403 (demo), 400 (no username yet, invalid query), 404 if
 * `user` matches nobody.
 */
import { z } from 'zod'

const querySchema = workoutListQuerySchema.extend({ user: z.string().max(20).optional() })

export default defineEventHandler(async (event) => {
  const me = await requireSocialUser(event)
  const { cursor, limit, user } = await getValidatedQuery(event, query => querySchema.parse(query))
  const ownerId = user === undefined ? undefined : (await requireUserByUsername(user)).id

  return loadFeed({ viewerId: me.id, ownerId, cursor, limit })
})
