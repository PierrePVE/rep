/**
 * GET /api/workouts: the history of the current user, newest first, one page
 * at a time. Only FINISHED sessions: the one in progress lives on the
 * logging screen.
 *
 * Query: `?limit=` (1-50, default 20), `?cursor=` the id of the last session
 * of the previous page.
 * Returns: { items: [{ id, name, startedAt, endedAt, exerciseCount, setCount,
 *   volumeKg, photoUrl }], nextCursor }, `nextCursor` null on the last page.
 * `volumeKg` is the total weight × reps of the session, warm-ups left out
 * (they would inflate it without being real work); bodyweight sets count 0.
 * Errors: 401 if not logged in, 400 if the query is invalid.
 */
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { workouts } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { cursor, limit } = await getValidatedQuery(event, workoutListQuerySchema.parse)

  const rows = await useDb()
    .select({
      id: workouts.id,
      name: workouts.name,
      startedAt: workouts.startedAt,
      endedAt: workouts.endedAt,
      // Correlated subqueries rather than joins + GROUP BY: each count stays
      // independent (a join of exercises AND sets would multiply the rows).
      // ::int / ::float8: Postgres returns bigint and numeric as strings.
      // `workouts.id` is written out rather than interpolated: inside a
      // select, Drizzle renders a column as a bare "id", which the subquery
      // would resolve to its own we.id.
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
    })
    .from(workouts)
    .where(and(
      eq(workouts.userId, user.id),
      isNotNull(workouts.endedAt),
      // Rows strictly after the cursor in the (startedAt, id) order. The
      // cursor's startedAt is read in SQL, not passed from JS: a JS Date drops
      // the microseconds, which could skip or repeat a row. The userId check
      // keeps a foreign cursor id from leaking anything (it just matches nothing).
      cursor === undefined
        ? undefined
        : sql`(workouts.started_at, workouts.id) < (
            SELECT c.started_at, c.id FROM workouts c WHERE c.id = ${cursor} AND c.user_id = ${user.id}
          )`,
    ))
    // id as a tie-breaker, so the order (and so the cursor) is always total.
    .orderBy(desc(workouts.startedAt), desc(workouts.id))
    // One extra row tells whether another page exists, without a count query.
    .limit(limit + 1)

  const items = rows.slice(0, limit).map(({ photoUpdatedAt, ...w }) => ({
    ...w,
    photoUrl: photoUrl(w.id, photoUpdatedAt),
  }))
  return {
    items,
    nextCursor: rows.length > limit ? items.at(-1)!.id : null,
  }
})
