/**
 * DELETE /api/program-exercises/:id: removes a planned exercise from its day.
 *
 * The following exercises move up one place, so positions stay 0, 1, 2...
 * Returns: 204. 404 if it does not exist or belongs to another user.
 */
import { and, eq, gt, sql } from 'drizzle-orm'
import { programExercises } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const current = await requireOwnedProgramExercise(user.id, id)
  const db = useDb()

  // One transaction: never a deleted exercise with the others left un-shifted.
  await db.batch([
    db.delete(programExercises).where(eq(programExercises.id, current.id)),
    db
      .update(programExercises)
      .set({ position: sql`${programExercises.position} - 1` })
      .where(and(
        eq(programExercises.programDayId, current.programDayId),
        gt(programExercises.position, current.position),
      )),
  ])

  setResponseStatus(event, 204)
  return null
})
