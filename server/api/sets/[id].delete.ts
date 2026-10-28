/**
 * DELETE /api/sets/:id: removes a set.
 *
 * The following sets of the same exercise move up one place, so positions
 * stay 0, 1, 2...
 * Returns: 204. 404 if the set does not exist or belongs to another user.
 */
import { and, eq, gt, sql } from 'drizzle-orm'
import { sets } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const current = await requireOwnedSet(user.id, id)
  const db = useDb()

  // One transaction: never a deleted set with the others left un-shifted.
  await db.batch([
    db.delete(sets).where(eq(sets.id, current.id)),
    db
      .update(sets)
      .set({ position: sql`${sets.position} - 1` })
      .where(and(
        eq(sets.workoutExerciseId, current.workoutExerciseId),
        gt(sets.position, current.position),
      )),
  ])

  setResponseStatus(event, 204)
  return null
})
