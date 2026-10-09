/**
 * DELETE /api/program-days/:id: removes a session day from its program.
 *
 * Its planned exercises go with it (FK cascade); workouts started from it are
 * kept with programDayId set to null. The following days move up one place,
 * so the rotation positions stay 0, 1, 2...
 * Returns: 204. 404 if the day does not exist or belongs to another user.
 */
import { and, eq, gt, sql } from 'drizzle-orm'
import { programDays } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const day = await requireOwnedDay(user.id, id)
  const db = useDb()

  // One transaction: never a deleted day with the others left un-shifted.
  await db.batch([
    db.delete(programDays).where(eq(programDays.id, day.id)),
    db
      .update(programDays)
      .set({ position: sql`${programDays.position} - 1` })
      .where(and(eq(programDays.programId, day.programId), gt(programDays.position, day.position))),
  ])

  setResponseStatus(event, 204)
  return null
})
