/**
 * The social feed query: summary cards of the sessions a user may see.
 */
import { and, desc, eq, sql } from 'drizzle-orm'
import { users, workouts } from '../db/schema'

/** Options of loadFeed. */
interface FeedOptions {
  /** Logged-in user: decides which sessions are visible. */
  viewerId: number
  /** Only this user's sessions (profile page); omitted, the whole feed. */
  ownerId?: number
  /** Id of the last session of the previous page. */
  cursor?: number
  /** Page size. */
  limit: number
}

/**
 * Loads one page of the feed, newest first: the viewer's own finished
 * sessions and the visible ones of the users they follow (see
 * feedWorkoutsCondition).
 *
 * @param options - See FeedOptions.
 * @returns { items, nextCursor }; each item has the session summary, its
 *   owner's username, its photo URL, its likes and the number of personal
 *   records it set. `visibility` is only meaningful on the viewer's own
 *   sessions (the others are always 'followers').
 */
export async function loadFeed({ viewerId, ownerId, cursor, limit }: FeedOptions) {
  const rows = await useDb()
    .select({
      id: workouts.id,
      ownerId: workouts.userId,
      username: users.username,
      name: workouts.name,
      startedAt: workouts.startedAt,
      endedAt: workouts.endedAt,
      visibility: workouts.visibility,
      // Same subqueries as the history list (see GET /api/workouts), with
      // `workouts.id` written out for the same reason.
      exerciseCount: sql<number>`(
        SELECT count(*)::int FROM workout_exercises we WHERE we.workout_id = workouts.id
      )`,
      setCount: sql<number>`(
        SELECT count(*)::int FROM sets s
        JOIN workout_exercises we ON we.id = s.workout_exercise_id
        WHERE we.workout_id = workouts.id
      )`,
      volumeKg: sql<number>`(
        SELECT coalesce(sum(s.weight_kg * s.reps), 0)::float8 FROM sets s
        JOIN workout_exercises we ON we.id = s.workout_exercise_id
        WHERE we.workout_id = workouts.id AND s.type <> 'warmup'
      )`,
      photoUpdatedAt: sql<string | null>`(
        SELECT p.updated_at FROM workout_photos p WHERE p.workout_id = workouts.id
      )`,
      likeCount: sql<number>`(
        SELECT count(*)::int FROM workout_likes l WHERE l.workout_id = workouts.id
      )`,
      likedByMe: sql<boolean>`EXISTS (
        SELECT 1 FROM workout_likes l WHERE l.workout_id = workouts.id AND l.user_id = ${viewerId}
      )`,
    })
    .from(workouts)
    .innerJoin(users, eq(users.id, workouts.userId))
    .where(and(
      feedWorkoutsCondition(viewerId),
      ownerId === undefined ? undefined : eq(workouts.userId, ownerId),
      // Same keyset pagination as the history. The cursor row must itself be
      // visible to the viewer, or a foreign id would leak the start time of
      // a private session through the page boundary.
      cursor === undefined
        ? undefined
        : sql`(workouts.started_at, workouts.id) < (
            SELECT c.started_at, c.id FROM workouts c
            WHERE c.id = ${cursor} AND (c.user_id = ${viewerId} OR (c.visibility = 'followers' AND EXISTS (
              SELECT 1 FROM follows f
              WHERE f.follower_id = ${viewerId} AND f.followee_id = c.user_id AND f.status = 'accepted'
            )))
          )`,
    ))
    .orderBy(desc(workouts.startedAt), desc(workouts.id))
    .limit(limit + 1)

  const page = rows.slice(0, limit)
  const prCounts = await countPrs(page)

  return {
    items: page.map(({ photoUpdatedAt, ownerId: owner, username, ...w }) => ({
      ...w,
      // Every feed author has a username: following requires one, and the
      // viewer's own sessions only show once they picked theirs.
      username: username!,
      mine: owner === viewerId,
      photoUrl: photoUrl(w.id, photoUpdatedAt),
      prCount: prCounts.get(w.id) ?? 0,
    })),
    nextCursor: rows.length > limit ? page.at(-1)!.id : null,
  }
}

/**
 * Number of personal records set in each session of a feed page. Records are
 * not stored, so they are recomputed from each owner's whole history (see
 * recentPrs): one query per distinct owner on the page, fine at this scale.
 *
 * @param page - Sessions of the page, with their owner and start.
 * @returns Record count by session id (sessions without any are absent).
 */
async function countPrs(page: Array<{ id: number, ownerId: number, startedAt: Date }>) {
  const counts = new Map<number, number>()
  const owners = [...new Set(page.map(w => w.ownerId))]
  const ids = new Set(page.map(w => w.id))

  await Promise.all(owners.map(async (ownerId) => {
    // Only records from the oldest session of this owner on the page onwards
    // matter; older sets still serve as the history they are judged against.
    const since = page
      .filter(w => w.ownerId === ownerId)
      .reduce((min, w) => (w.startedAt < min ? w.startedAt : min), new Date(8.64e15))
    for (const pr of recentPrs(await loadAllSets(ownerId), since.toISOString())) {
      // A set beating several records at once counts once.
      if (ids.has(pr.workoutId)) counts.set(pr.workoutId, (counts.get(pr.workoutId) ?? 0) + 1)
    }
  }))
  return counts
}
