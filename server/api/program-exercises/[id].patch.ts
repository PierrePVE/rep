/**
 * PATCH /api/program-exercises/:id: edits the targets of a planned exercise.
 *
 * Body: any of { targetSets, repMin, repMax, targetRpe, restSeconds, notes };
 * only the sent fields change, null clears an optional one.
 * Returns: the updated planned exercise.
 * 400 if the input is invalid, empty, or gives repMin > repMax once merged with
 * the stored values; 404 if it does not exist or belongs to another user.
 */
import { eq } from 'drizzle-orm'
import { programExercises } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const changes = await readValidatedBody(event, body => programExerciseUpdateSchema.parse(body))
  const current = await requireOwnedProgramExercise(user.id, id)

  // Drizzle throws on an empty SET; answer with a readable 400 instead.
  if (Object.keys(changes).length === 0) {
    throw createError({ statusCode: 400, message: 'Aucune modification' })
  }

  // The schema can only compare the bounds when both are sent. When a single
  // one changes, compare it with the stored other one, so the user gets this
  // message instead of a 500 from the SQL CHECK.
  const repMin = changes.repMin ?? current.repMin
  const repMax = changes.repMax ?? current.repMax
  if (repMin > repMax) {
    throw createError({ statusCode: 400, message: 'Le max doit être ≥ au min' })
  }

  const [updated] = await useDb()
    .update(programExercises)
    .set(changes)
    .where(eq(programExercises.id, current.id))
    .returning()

  // Only reachable if it was deleted between the check and the update.
  if (!updated) throw createError({ statusCode: 404, message: 'Exercice introuvable dans ce programme' })
  return updated
})
