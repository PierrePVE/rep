/**
 * GET /api/stats/dashboard: the figures of the home page.
 *
 * Returns: {
 *   today — today as "YYYY-MM-DD", Paris time: the page uses this one rather
 *     than the browser's clock, so its calendar agrees with the server's days,
 *   current: { id, name, startedAt } | null — the session in progress, to
 *     offer resuming it,
 *   week: { sessions, goal } — finished sessions this week (Monday to
 *     Sunday, Paris time) against WEEKLY_SESSION_GOAL,
 *   streak — weeks in a row with at least one session (see weekStreak),
 *   totalVolumeKg — weight × reps since the start, warm-ups left out,
 *   days: [{ day, sessions }] — every day with a finished session, newest
 *     first, for the attendance calendar,
 *   muscles: [{ muscleGroup, sets, volumeKg }] — work sets per muscle group
 *     over the last MUSCLE_WEEKS weeks, most worked first,
 *   recentPrs: [{ workoutId, startedAt, exerciseId, exerciseName, weightKg,
 *     reps, types }] — record sets of the last RECENT_PR_DAYS days, newest
 *     first, at most MAX_RECENT_PRS,
 * }.
 * Errors: 401 if not logged in.
 */
import { and, eq, isNull } from 'drizzle-orm'
import { workouts } from '../../db/schema'

/** Window of the "recent PRs" list, in days. */
const RECENT_PR_DAYS = 30
/** Longest "recent PRs" list: past that, it stops being a highlight. */
const MAX_RECENT_PRS = 10
/** Window of the sets-per-muscle chart, in weeks (the current one included). */
const MUSCLE_WEEKS = 4

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const now = new Date()
  const today = localDay(now)

  // Independent queries: run them in parallel.
  const [currentRows, days, totalVolumeKg, muscleRows, allSets] = await Promise.all([
    useDb()
      .select({ id: workouts.id, name: workouts.name, startedAt: workouts.startedAt })
      .from(workouts)
      .where(and(eq(workouts.userId, user.id), isNull(workouts.endedAt))),
    loadSessionDays(user.id),
    loadTotalVolume(user.id),
    loadWeeklyMuscleWork(user.id, MUSCLE_WEEKS),
    loadAllSets(user.id),
  ])

  const thisWeek = weekStart(today)
  const weekSessions = days
    .filter(d => weekStart(d.day) === thisWeek)
    .reduce((total, d) => total + d.sessions, 0)

  // The SQL gives one row per (week, muscle group): summed over the weeks
  // here, the chart shows the whole window.
  const muscles = new Map<string, { muscleGroup: typeof muscleRows[number]['muscleGroup'], sets: number, volumeKg: number }>()
  for (const row of muscleRows) {
    const entry = muscles.get(row.muscleGroup) ?? { muscleGroup: row.muscleGroup, sets: 0, volumeKg: 0 }
    entry.sets += row.sets
    entry.volumeKg += row.volumeKg
    muscles.set(row.muscleGroup, entry)
  }

  const since = new Date(now.getTime() - RECENT_PR_DAYS * 24 * 3600 * 1000).toISOString()
  const prs = recentPrs(allSets, since).slice(0, MAX_RECENT_PRS)

  return {
    today,
    current: currentRows[0] ?? null,
    week: { sessions: weekSessions, goal: WEEKLY_SESSION_GOAL },
    streak: weekStreak(days.map(d => d.day), today),
    totalVolumeKg,
    days,
    muscles: [...muscles.values()].sort((a, b) => b.sets - a.sets),
    recentPrs: prs.map(p => ({
      workoutId: p.workoutId,
      startedAt: p.startedAt,
      exerciseId: p.exerciseId,
      exerciseName: p.exerciseName,
      weightKg: p.weightKg,
      reps: p.reps,
      types: p.types,
    })),
  }
})
