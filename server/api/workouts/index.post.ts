/**
 * POST /api/workouts: starts a session for the current user.
 *
 * Body: { programDayId? }. From a program day, the session takes the day's
 * name and is prefilled with its planned exercises, in order (archived ones
 * are skipped). Without one, it starts empty.
 * Only one session can be in progress: if one already is, it is returned
 * as is (status 200) instead of starting another, so that a double tap or a
 * second device simply resumes it.
 * Returns: { workout } with the full tree (see loadWorkout), status 201 when
 * it was just created.
 * Errors: 401 if not logged in, 400 if the body is invalid, 404 if the program
 * day does not exist or belongs to another user.
 */
import { and, eq, sql } from 'drizzle-orm'
import { exercises, programExercises, workoutExercises, workouts } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  // `?? {}`: a start without a program may be sent with no body at all.
  const { programDayId } = await readValidatedBody(event, body => startWorkoutSchema.parse(body ?? {}))

  const current = await loadWorkout(user.id)
  if (current) return { workout: current }

  const day = programDayId ? await requireOwnedDay(user.id, programDayId) : null
  const db = useDb()

  // The day's planned exercises to copy, archived ones left out.
  const planned = day
    ? await db
        .select({ exerciseId: programExercises.exerciseId })
        .from(programExercises)
        .innerJoin(exercises, eq(exercises.id, programExercises.exerciseId))
        .where(and(eq(programExercises.programDayId, day.id), eq(exercises.archived, false)))
        .orderBy(programExercises.position)
    : []

  const insertWorkout = db
    .insert(workouts)
    .values({ userId: user.id, programDayId: day?.id ?? null, name: day?.name ?? null })

  try {
    if (planned.length > 0) {
      // The new workout's id is not known yet inside the batch, so each row
      // finds it again as "the user's session in progress": the unique index
      // workouts_one_in_progress_uq guarantees it is the one just inserted.
      const workoutId = sql<number>`(SELECT ${workouts.id} FROM ${workouts} WHERE ${workouts.userId} = ${user.id} AND ${workouts.endedAt} IS NULL)`
      const prefill = db.insert(workoutExercises).values(planned.map((p, index) => ({
        workoutId,
        exerciseId: p.exerciseId,
        // The index rather than the planned position: positions stay 0, 1,
        // 2... without gaps even when an archived exercise was skipped.
        position: index,
      })))
      // db.batch runs both statements in one transaction (neon-http has no
      // interactive ones): never a half-filled session if the copy fails.
      await db.batch([insertWorkout, prefill])
    }
    else {
      await insertWorkout
    }
  }
  catch (error) {
    // Another request (double tap, second device) started a session between
    // the check above and this insert: resume that one instead.
    if (!isUniqueViolation(error, 'workouts_one_in_progress_uq')) throw error
    const started = await loadWorkout(user.id)
    if (started) return { workout: started }
    throw error
  }

  const workout = await loadWorkout(user.id)
  // Just inserted, so always found; this only narrows the type.
  if (!workout) throw createError({ statusCode: 500, message: 'Démarrage de la séance impossible' })

  setResponseStatus(event, 201)
  return { workout }
})
