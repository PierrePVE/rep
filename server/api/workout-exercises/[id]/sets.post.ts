/**
 * POST /api/workout-exercises/:id/sets: logs a set at the end of an exercise
 * of a session.
 *
 * Body: { weightKg, reps, rpe?, type? } (type defaults to 'normal').
 * Returns: { set, prs } with status 201. `prs` lists the records this set
 * beats (see findSetPrs), so the page can show a badge right away.
 * Errors: 400 if the input is invalid, 404 if the workout exercise does not
 * exist or belongs to another user.
 */
import { sql } from 'drizzle-orm'
import { sets } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const input = await readValidatedBody(event, body => setSchema.parse(body))
  const workoutExercise = await requireOwnedWorkoutExercise(user.id, id)

  const [set] = await useDb()
    .insert(sets)
    .values({
      ...input,
      workoutExerciseId: workoutExercise.id,
      // max + 1 rather than the count: still correct if positions have a gap.
      position: sql`(SELECT COALESCE(MAX(${sets.position}), -1) + 1 FROM ${sets} WHERE ${sets.workoutExerciseId} = ${workoutExercise.id})`,
    })
    .returning()
  // .returning() always yields the inserted row; this only narrows the type.
  if (!set) throw createError({ statusCode: 500, message: 'Enregistrement de la série impossible' })

  setResponseStatus(event, 201)
  return { set, prs: await findSetPrs(user.id, set.id) }
})
