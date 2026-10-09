/**
 * PUT /api/program-days/:id/order: reorders the planned exercises of a day.
 *
 * Body: { ids }, every planned exercise id of the day, in the new order.
 * Returns: 204. 400 if the list is not exactly the day's exercises, 404 if the
 * day does not exist or belongs to another user.
 */
import { eq } from 'drizzle-orm'
import { programExercises } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const { ids } = await readValidatedBody(event, body => reorderSchema.parse(body))
  const day = await requireOwnedDay(user.id, id)
  const db = useDb()

  // The list must be exactly the day's exercises: a foreign id would move an
  // exercise of another day (or user), a missing one would keep a stale
  // position and collide with the new ones. The schema already refused
  // duplicates, so equal sizes + all known means the same set.
  const rows = await db
    .select({ id: programExercises.id })
    .from(programExercises)
    .where(eq(programExercises.programDayId, day.id))
  const known = new Set(rows.map(row => row.id))
  if (ids.length !== known.size || !ids.every(exerciseId => known.has(exerciseId))) {
    throw createError({ statusCode: 400, message: 'La liste ne correspond pas aux exercices de la séance' })
  }

  const updates = ids.map((exerciseId, position) => db
    .update(programExercises)
    .set({ position })
    .where(eq(programExercises.id, exerciseId)))
  // batch() wants a non-empty tuple; reorderSchema guarantees at least one id.
  await db.batch(updates as [typeof updates[number], ...typeof updates])

  setResponseStatus(event, 204)
  return null
})
