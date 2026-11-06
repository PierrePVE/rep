/**
 * Loading of a full workout, shared by the routes that return one (the session
 * in progress now, the history detail page later).
 */
import { and, eq, isNull } from 'drizzle-orm'
import { programExercises, workouts } from '../db/schema'

/**
 * Loads a workout of the given user with its exercises and their sets, each
 * list sorted by position, plus the plan of the program day it was started
 * from.
 *
 * @param userId - Owner of the workout: other users' workouts are never found.
 * @param workoutId - The workout to load; omitted, loads the one in progress.
 * @returns The workout tree, or null if there is none. `photoUrl` is the
 *   URL of its photo, null when it has none. `plan` lists the
 *   targets (sets, rep range, RPE, rest) of the program day, empty for a free
 *   session: the page matches them to the exercises by `exerciseId`, since a
 *   workout exercise keeps no link to the planned one (the program may change
 *   after the session, the history must not).
 */
export async function loadWorkout(userId: number, workoutId?: number) {
  const db = useDb()

  const workout = await db.query.workouts.findFirst({
    columns: { userId: false },
    // The userId condition is the ownership check.
    where: and(
      eq(workouts.userId, userId),
      workoutId === undefined ? isNull(workouts.endedAt) : eq(workouts.id, workoutId),
    ),
    with: {
      // Only the version: the bytes are served by GET /api/workouts/:id/photo.
      photo: { columns: { updatedAt: true } },
      exercises: {
        orderBy: (we, { asc }) => [asc(we.position)],
        with: {
          exercise: { columns: { id: true, name: true, muscleGroup: true, equipment: true } },
          sets: {
            columns: { workoutExerciseId: false },
            orderBy: (s, { asc }) => [asc(s.position)],
          },
        },
      },
    },
  })
  if (!workout) return null

  const plan = workout.programDayId === null
    ? []
    : await db
        .select({
          exerciseId: programExercises.exerciseId,
          targetSets: programExercises.targetSets,
          repMin: programExercises.repMin,
          repMax: programExercises.repMax,
          targetRpe: programExercises.targetRpe,
          restSeconds: programExercises.restSeconds,
          notes: programExercises.notes,
        })
        .from(programExercises)
        .where(eq(programExercises.programDayId, workout.programDayId))
        .orderBy(programExercises.position)

  const { photo, ...rest } = workout
  return { ...rest, photoUrl: photoUrl(workout.id, photo?.updatedAt ?? null), plan }
}
