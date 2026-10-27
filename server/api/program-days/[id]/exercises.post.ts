/**
 * POST /api/program-days/:id/exercises: adds a planned exercise at the end of
 * a session day.
 *
 * Body: { exerciseId, targetSets, repMin, repMax, targetRpe?, restSeconds?, notes? }.
 * Returns: the created planned exercise with status 201.
 * 400 if the input is invalid or the exercise is not in the user's catalogue,
 * 404 if the day does not exist or belongs to another user.
 */
import { and, eq, sql } from 'drizzle-orm'
import { exercises, programExercises } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const input = await readValidatedBody(event, body => programExerciseSchema.parse(body))
  const day = await requireOwnedDay(user.id, id)
  const db = useDb()

  // The foreign key only proves the exercise exists, not that it is this
  // user's: without this check a program could point at someone else's
  // exercise. Archived ones are refused too, as the picker hides them.
  const [exercise] = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(and(
      eq(exercises.id, input.exerciseId),
      eq(exercises.userId, user.id),
      eq(exercises.archived, false),
    ))
  if (!exercise) throw createError({ statusCode: 400, message: 'Exercice introuvable' })

  const [created] = await db
    .insert(programExercises)
    .values({
      ...input,
      programDayId: day.id,
      // max + 1 rather than the count: still correct if positions have a gap.
      position: sql`(SELECT COALESCE(MAX(${programExercises.position}), -1) + 1 FROM ${programExercises} WHERE ${programExercises.programDayId} = ${day.id})`,
    })
    .returning()

  setResponseStatus(event, 201)
  return created
})
