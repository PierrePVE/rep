/**
 * Database side of the statistics: loads the user's sets in session order
 * for the pure helpers of shared/utils/stats.ts, and the aggregates that are
 * simpler in SQL (counts and sums by day or week).
 */
import { and, asc, eq, isNotNull, sql } from 'drizzle-orm'
import { exercises, sets, workoutExercises, workouts } from '../db/schema'

/**
 * Session order of the sets: by session start, then exercise position, then
 * set position. The same order as the PR detection (server/utils/prs.ts), so
 * "the first time a record was reached" means the same everywhere.
 */
const setOrder = [asc(workouts.startedAt), asc(workoutExercises.position), asc(sets.position)]

/**
 * `started_at` converted to the app's local time. APP_TIME_ZONE is a constant
 * of ours, never user input, so inlining it with sql.raw is safe.
 */
const localStartedAt = sql`(${workouts.startedAt} AT TIME ZONE '${sql.raw(APP_TIME_ZONE)}')`

/**
 * Loads every set of one exercise of the user, the session in progress
 * included (its sets are real work).
 *
 * @param userId - Owner of the sets.
 * @param exerciseId - The exercise; the caller checks that the user owns it.
 * @returns The sets in session order, `startedAt` as an ISO string.
 */
export async function loadExerciseSets(userId: number, exerciseId: number) {
  const rows = await useDb()
    .select({
      id: sets.id,
      workoutId: workouts.id,
      startedAt: workouts.startedAt,
      weightKg: sets.weightKg,
      reps: sets.reps,
      rpe: sets.rpe,
      type: sets.type,
    })
    .from(sets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, sets.workoutExerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(eq(workouts.userId, userId), eq(workoutExercises.exerciseId, exerciseId)))
    .orderBy(...setOrder)

  return rows.map(r => ({ ...r, startedAt: r.startedAt.toISOString() }))
}

/**
 * Loads every set of the user, all exercises, with the exercise's name: the
 * input of recentPrs (which needs the whole history).
 *
 * @param userId - Owner of the sets.
 * @returns The sets in session order, `startedAt` as an ISO string.
 */
export async function loadAllSets(userId: number) {
  const rows = await useDb()
    .select({
      workoutId: workouts.id,
      startedAt: workouts.startedAt,
      exerciseId: exercises.id,
      exerciseName: exercises.name,
      weightKg: sets.weightKg,
      reps: sets.reps,
      type: sets.type,
    })
    .from(sets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, sets.workoutExerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .where(eq(workouts.userId, userId))
    .orderBy(...setOrder)

  return rows.map(r => ({ ...r, startedAt: r.startedAt.toISOString() }))
}

/**
 * Days on which the user started a finished session, newest first. Local
 * days: a session at 00:30 in Paris belongs to that day, not the UTC one.
 *
 * @param userId - Owner of the sessions.
 * @returns Distinct days as "YYYY-MM-DD", with the number of sessions of each.
 */
export async function loadSessionDays(userId: number) {
  const day = sql<string>`to_char(${localStartedAt}, 'YYYY-MM-DD')`
  return useDb()
    .select({ day, sessions: sql<number>`count(*)::int` })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), isNotNull(workouts.endedAt)))
    .groupBy(day)
    .orderBy(sql`1 DESC`)
}

/**
 * Work done per week and muscle group over the last weeks, for the stacked
 * bars of the home page. Warm-ups are left out, as everywhere.
 *
 * @param userId - Owner of the sets.
 * @param weeks - How many weeks back, the current one included.
 * @returns One row per (week, muscle group), oldest week first: the week's
 *   Monday as "YYYY-MM-DD", the volume (weight × reps) and the number of
 *   sets. Both are given since bodyweight work has no volume, only sets.
 */
export async function loadWeeklyMuscleWork(userId: number, weeks: number) {
  // date_trunc('week') starts weeks on Monday, like weekStreak.
  const week = sql<string>`to_char(date_trunc('week', ${localStartedAt}), 'YYYY-MM-DD')`
  const nowLocal = sql`(now() AT TIME ZONE '${sql.raw(APP_TIME_ZONE)}')`
  return useDb()
    .select({
      week,
      muscleGroup: exercises.muscleGroup,
      volumeKg: sql<number>`coalesce(sum(${sets.weightKg} * ${sets.reps}), 0)::float8`,
      sets: sql<number>`count(*)::int`,
    })
    .from(sets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, sets.workoutExerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .where(and(
      eq(workouts.userId, userId),
      sql`${sets.type} <> 'warmup'`,
      // From the Monday of the oldest week shown. make_interval keeps the
      // number a bound parameter instead of text pasted into the SQL.
      sql`${localStartedAt} >= date_trunc('week', ${nowLocal}) - make_interval(weeks => ${weeks - 1})`,
    ))
    .groupBy(week, exercises.muscleGroup)
    .orderBy(sql`1`)
}

/**
 * Total weight lifted by the user since the start (weight × reps of every
 * set but the warm-ups), for the home page.
 *
 * @param userId - Owner of the sets.
 * @returns The total, in kg.
 */
export async function loadTotalVolume(userId: number) {
  const [row] = await useDb()
    .select({ total: sql<number>`coalesce(sum(${sets.weightKg} * ${sets.reps}), 0)::float8` })
    .from(sets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, sets.workoutExerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(eq(workouts.userId, userId), sql`${sets.type} <> 'warmup'`))
  return row?.total ?? 0
}
