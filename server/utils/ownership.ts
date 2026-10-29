/**
 * Ownership guards for the program editor and workout logger routes.
 *
 * Only `programs` and `workouts` carry a `userId`: days and planned exercises
 * belong to a user through their program, workout exercises and sets through
 * their workout. Each guard therefore joins up to the owning table and
 * filters on the user, so a route can never act on another user's row just by
 * guessing its id.
 *
 * Every guard answers 404 both when the row does not exist and when it belongs
 * to someone else, so the ids of other users cannot be probed.
 */
import { and, eq } from 'drizzle-orm'
import { exercises, programDays, programExercises, programs, sets, workoutExercises, workouts } from '../db/schema'

/**
 * Loads an exercise of the given user's catalogue (archived ones included:
 * their history stays readable).
 *
 * @param userId - Logged-in user.
 * @param exerciseId - Exercise id from the route.
 * @returns The exercise's id.
 * @throws 404 if the exercise does not exist or belongs to another user.
 */
export async function requireOwnedExercise(userId: number, exerciseId: number) {
  const [exercise] = await useDb()
    .select({ id: exercises.id })
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), eq(exercises.userId, userId)))

  if (!exercise) throw createError({ statusCode: 404, message: 'Exercice introuvable' })
  return exercise
}

/**
 * Loads a program of the given user.
 *
 * @param userId - Logged-in user.
 * @param programId - Program id from the route.
 * @returns The program's id, name and active flag.
 * @throws 404 if the program does not exist or belongs to another user.
 */
export async function requireOwnedProgram(userId: number, programId: number) {
  const [program] = await useDb()
    .select({ id: programs.id, name: programs.name, active: programs.active })
    .from(programs)
    .where(and(eq(programs.id, programId), eq(programs.userId, userId)))

  if (!program) throw createError({ statusCode: 404, message: 'Programme introuvable' })
  return program
}

/**
 * Loads a program day of the given user.
 *
 * @param userId - Logged-in user.
 * @param dayId - Program day id from the route.
 * @returns The day's id, program id, name (a workout started from the day is
 *   named after it) and position (needed to renumber on delete).
 * @throws 404 if the day does not exist or belongs to another user.
 */
export async function requireOwnedDay(userId: number, dayId: number) {
  const [day] = await useDb()
    .select({
      id: programDays.id,
      programId: programDays.programId,
      name: programDays.name,
      position: programDays.position,
    })
    .from(programDays)
    .innerJoin(programs, eq(programs.id, programDays.programId))
    .where(and(eq(programDays.id, dayId), eq(programs.userId, userId)))

  if (!day) throw createError({ statusCode: 404, message: 'Séance introuvable' })
  return day
}

/**
 * Loads a planned exercise of the given user.
 *
 * @param userId - Logged-in user.
 * @param programExerciseId - Planned exercise id from the route.
 * @returns Its id, day id, position and rep range (the PATCH route needs the
 *   stored range to validate a change of only one bound).
 * @throws 404 if it does not exist or belongs to another user.
 */
export async function requireOwnedProgramExercise(userId: number, programExerciseId: number) {
  const [programExercise] = await useDb()
    .select({
      id: programExercises.id,
      programDayId: programExercises.programDayId,
      position: programExercises.position,
      repMin: programExercises.repMin,
      repMax: programExercises.repMax,
    })
    .from(programExercises)
    .innerJoin(programDays, eq(programDays.id, programExercises.programDayId))
    .innerJoin(programs, eq(programs.id, programDays.programId))
    .where(and(eq(programExercises.id, programExerciseId), eq(programs.userId, userId)))

  if (!programExercise) throw createError({ statusCode: 404, message: 'Exercice introuvable dans ce programme' })
  return programExercise
}

/**
 * Loads a workout of the given user.
 *
 * @param userId - Logged-in user.
 * @param workoutId - Workout id from the route.
 * @returns Its id and end date (null while the session is in progress).
 * @throws 404 if the workout does not exist or belongs to another user.
 */
export async function requireOwnedWorkout(userId: number, workoutId: number) {
  const [workout] = await useDb()
    .select({ id: workouts.id, endedAt: workouts.endedAt })
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))

  if (!workout) throw createError({ statusCode: 404, message: 'Séance introuvable' })
  return workout
}

/**
 * Loads an exercise of a workout of the given user.
 *
 * @param userId - Logged-in user.
 * @param workoutExerciseId - Workout exercise id from the route.
 * @returns Its id, workout id, exercise id (the PR history is per exercise)
 *   and position (needed to renumber on delete).
 * @throws 404 if it does not exist or belongs to another user.
 */
export async function requireOwnedWorkoutExercise(userId: number, workoutExerciseId: number) {
  const [workoutExercise] = await useDb()
    .select({
      id: workoutExercises.id,
      workoutId: workoutExercises.workoutId,
      exerciseId: workoutExercises.exerciseId,
      position: workoutExercises.position,
    })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(eq(workoutExercises.id, workoutExerciseId), eq(workouts.userId, userId)))

  if (!workoutExercise) throw createError({ statusCode: 404, message: 'Exercice introuvable dans cette séance' })
  return workoutExercise
}

/**
 * Loads a set of a workout of the given user.
 *
 * @param userId - Logged-in user.
 * @param setId - Set id from the route.
 * @returns Its id, workout exercise id and position (needed to renumber on
 *   delete).
 * @throws 404 if it does not exist or belongs to another user.
 */
export async function requireOwnedSet(userId: number, setId: number) {
  const [set] = await useDb()
    .select({ id: sets.id, workoutExerciseId: sets.workoutExerciseId, position: sets.position })
    .from(sets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, sets.workoutExerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(eq(sets.id, setId), eq(workouts.userId, userId)))

  if (!set) throw createError({ statusCode: 404, message: 'Série introuvable' })
  return set
}
