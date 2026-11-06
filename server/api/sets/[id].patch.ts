/**
 * PATCH /api/sets/:id: edits a set (typo in the weight, wrong set type...).
 *
 * Body: any of { weightKg, reps, rpe, type }; only the sent fields change,
 * null clears the RPE.
 * Returns: { set, prs }, the records are computed again since the edit may
 * create or remove one.
 * Errors: 400 if the input is invalid or empty, 404 if the set does not exist
 * or belongs to another user.
 */
import { eq } from 'drizzle-orm'
import { sets } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const changes = await readValidatedBody(event, body => setUpdateSchema.parse(body))
  const current = await requireOwnedSet(user.id, id)

  // Drizzle throws on an empty SET; answer with a readable 400 instead.
  if (Object.keys(changes).length === 0) {
    throw createError({ statusCode: 400, message: 'Aucune modification' })
  }

  const [set] = await useDb()
    .update(sets)
    .set(changes)
    .where(eq(sets.id, current.id))
    .returning()

  // Only reachable if it was deleted between the check and the update.
  if (!set) throw createError({ statusCode: 404, message: 'Série introuvable' })
  return { set, prs: await findSetPrs(user.id, set.id) }
})
