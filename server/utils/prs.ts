/**
 * Personal records of a saved set, computed from the database with the shared
 * rules of shared/utils/pr.ts.
 */
import { and, eq, sql } from 'drizzle-orm'
import { sets, workoutExercises, workouts } from '../db/schema'

/**
 * Tells which records a saved set beats.
 *
 * The set is compared with every set of the same exercise done BEFORE it:
 * earlier sessions, then within its own session the earlier exercises and
 * earlier sets. "Before" follows the order of the sets, not their creation
 * date, so that a set added afterwards to an old session from the history is
 * judged against what came before it, not against later progress.
 *
 * @param userId - Owner of the set: other users' sets are never found.
 * @param setId - A set already saved in the database.
 * @returns The records beaten (see detectPrs), empty if none or if the set is
 *   not found.
 */
export async function findSetPrs(userId: number, setId: number) {
  const db = useDb()

  const [target] = await db
    .select({
      weightKg: sets.weightKg,
      reps: sets.reps,
      type: sets.type,
      exerciseId: workoutExercises.exerciseId,
    })
    .from(sets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, sets.workoutExerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(eq(sets.id, setId), eq(workouts.userId, userId)))
  if (!target) return []

  // A warm-up or drop set is never a PR: skip the history query.
  if (target.type !== 'normal') return []

  const history = await db
    .select({ weightKg: sets.weightKg, reps: sets.reps, type: sets.type })
    .from(sets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, sets.workoutExerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(
      eq(workouts.userId, userId),
      eq(workoutExercises.exerciseId, target.exerciseId),
      // Row comparison: Postgres compares the tuples left to right, like
      // words in a dictionary. So "before" = an earlier session, or the same
      // session and an earlier exercise, or the same exercise and an earlier
      // set. The target's tuple is read by a subquery rather than sent from
      // JavaScript: a JS Date drops the microseconds of started_at, which
      // would wrongly push the target's own session after it. Plain SQL with
      // short aliases, since the outer query already uses the table names.
      sql`(${workouts.startedAt}, ${workoutExercises.position}, ${sets.position}) < (
        SELECT w.started_at, we.position, s.position
        FROM sets s
        JOIN workout_exercises we ON we.id = s.workout_exercise_id
        JOIN workouts w ON w.id = we.workout_id
        WHERE s.id = ${setId}
      )`,
    ))

  return detectPrs(target, history)
}
