/**
 * Statistics computed from the sets of the user: current records and
 * per-session figures of an exercise (its page), recent PRs and the weekly
 * streak (the home page).
 *
 * Pure functions on plain arrays: the server loads the sets (see
 * server/utils/stats.ts) and these do the maths, which keeps the rules
 * unit-tested without a database. The PR rules are those of pr.ts.
 */
import { estimateOneRepMax } from './oneRepMax'
import { detectPrs, type PrType } from './pr'
import type { SetType } from './sets'

/**
 * Time zone of the user's days and weeks ("did I train on Monday?"). One for
 * the whole app: it is used from France.
 */
export const APP_TIME_ZONE = 'Europe/Paris'

/** Sessions a week the dashboard counts towards (the user trains 6 days a week). */
export const WEEKLY_SESSION_GOAL = 6

/**
 * Day of a moment in the app's time zone.
 *
 * @param date - The moment (e.g. now).
 * @returns The local day as "YYYY-MM-DD": 23:30 UTC on 1 November is
 *   already "2026-11-02" in Paris.
 */
export function localDay(date: Date) {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE }).format(date)
}

/** A set with the session it belongs to, as the stats queries return it. */
export interface StatSet {
  workoutId: number
  /** Start of the session, ISO string. */
  startedAt: string
  weightKg: number
  reps: number
  type: SetType
}

/** A record and the set that set it. */
export interface RecordSet {
  weightKg: number
  reps: number
  startedAt: string
}

/** A record with a computed value (estimated 1RM, or weight × reps). */
export interface ValueRecord extends RecordSet {
  value: number
}

/**
 * Current records of an exercise. Only work sets count (as for PR detection):
 * a warm-up or a drop set never holds a record.
 *
 * @param sets - All the sets of the exercise, in session order (oldest
 *   first): on equal values the first set keeps the record, so its date is
 *   the day the record was first reached.
 * @returns The heaviest weight, best estimated 1RM and best weight × reps
 *   (null without a weighted work set), and the rep max of each weight,
 *   heaviest first, leaving out a weight whose reps were matched or beaten at
 *   a heavier one (that entry says nothing more).
 */
export function exerciseRecords(sets: StatSet[]) {
  let maxWeight: RecordSet | null = null
  let e1rm: ValueRecord | null = null
  let setVolume: ValueRecord | null = null
  const bestRepsByWeight = new Map<number, RecordSet>()

  for (const s of sets) {
    if (s.type !== 'normal') continue
    const entry = { weightKg: s.weightKg, reps: s.reps, startedAt: s.startedAt }

    const atWeight = bestRepsByWeight.get(s.weightKg)
    if (!atWeight || s.reps > atWeight.reps) bestRepsByWeight.set(s.weightKg, entry)

    // Bodyweight sets (0 kg) only have rep maxes, as in detectPrs.
    if (s.weightKg <= 0) continue
    if (!maxWeight || s.weightKg > maxWeight.weightKg) maxWeight = entry
    const estimate = estimateOneRepMax(s.weightKg, s.reps)
    if (estimate !== null && (!e1rm || estimate > e1rm.value)) e1rm = { ...entry, value: estimate }
    const volume = s.weightKg * s.reps
    if (!setVolume || volume > setVolume.value) setVolume = { ...entry, value: volume }
  }

  // Heaviest first; a lighter weight is kept only if it beats the reps of
  // every heavier one.
  const repMaxes: RecordSet[] = []
  for (const entry of [...bestRepsByWeight.values()].sort((a, b) => b.weightKg - a.weightKg)) {
    const last = repMaxes.at(-1)
    if (!last || entry.reps > last.reps) repMaxes.push(entry)
  }

  return { maxWeight, e1rm, setVolume, repMaxes }
}

/**
 * Per-session figures of an exercise, for its charts and history.
 *
 * @param sets - All the sets of the exercise, in session order. Extra
 *   fields (e.g. the set id) are kept on the sets of each session.
 * @returns One entry per session, in the same order: its sets, the best
 *   estimated 1RM of its work sets (null if none has one: bodyweight, or all
 *   above 12 reps) and its volume (weight × reps of all but the warm-ups,
 *   the same rule as the history list).
 */
export function exerciseSessions<T extends StatSet>(sets: T[]) {
  const sessions: Array<{ workoutId: number, startedAt: string, bestE1rm: number | null, volumeKg: number, sets: T[] }> = []

  for (const s of sets) {
    let session = sessions.at(-1)
    // Sets arrive grouped by session, so a new id starts a new entry.
    if (session?.workoutId !== s.workoutId) {
      session = { workoutId: s.workoutId, startedAt: s.startedAt, bestE1rm: null, volumeKg: 0, sets: [] }
      sessions.push(session)
    }
    session.sets.push(s)
    if (s.type !== 'warmup') session.volumeKg += s.weightKg * s.reps
    const estimate = s.type === 'normal' ? estimateOneRepMax(s.weightKg, s.reps) : null
    if (estimate !== null && (session.bestE1rm === null || estimate > session.bestE1rm)) session.bestE1rm = estimate
  }

  return sessions
}

/**
 * The sets that beat a record since a given date, all exercises together.
 * Records are not stored (see pr.ts), so each set is compared, with
 * detectPrs, to the sets of its exercise that came before it.
 *
 * @param sets - All the user's sets, with their exercise, in session order.
 *   The whole history is needed, not only the recent part: a record is
 *   judged against everything done before.
 * @param since - ISO date; older sets are used as history but not listed.
 * @returns The record sets, newest first, with the records each one beat.
 */
export function recentPrs<T extends StatSet & { exerciseId: number }>(sets: T[], since: string) {
  const sinceTime = Date.parse(since)
  const historyByExercise = new Map<number, StatSet[]>()
  const prs: Array<T & { types: PrType[] }> = []

  for (const s of sets) {
    const history = historyByExercise.get(s.exerciseId) ?? []
    if (Date.parse(s.startedAt) >= sinceTime) {
      const types = detectPrs(s, history)
      if (types.length) prs.push({ ...s, types })
    }
    history.push(s)
    historyByExercise.set(s.exerciseId, history)
  }

  return prs.reverse()
}

/**
 * Monday of the week of a day, as "YYYY-MM-DD". Computed in UTC on the date
 * alone, so that no time zone or daylight saving change can shift the day.
 *
 * @param day - A day as "YYYY-MM-DD".
 * @returns Its week's Monday.
 */
export function weekStart(day: string) {
  const date = new Date(`${day}T00:00:00Z`)
  // getUTCDay(): 0 = Sunday ... 6 = Saturday; Monday is the first day here.
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}

/**
 * Number of weeks in a row with at least one session, counting back from the
 * current week. A week without a session YET does not break the streak: on
 * Monday morning, last week's streak is still alive.
 *
 * @param sessionDays - Days with a session, as "YYYY-MM-DD" in the user's
 *   time zone, in any order (duplicates are fine).
 * @param today - Today, same format.
 * @returns The streak, in weeks.
 */
export function weekStreak(sessionDays: string[], today: string) {
  const weeks = new Set(sessionDays.map(weekStart))
  const week = new Date(`${weekStart(today)}T00:00:00Z`)
  if (!weeks.has(week.toISOString().slice(0, 10))) week.setUTCDate(week.getUTCDate() - 7)

  let streak = 0
  while (weeks.has(week.toISOString().slice(0, 10))) {
    streak++
    week.setUTCDate(week.getUTCDate() - 7)
  }
  return streak
}
