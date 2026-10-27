/**
 * PATCH /api/exercises/:id: edits one of the current user's exercises.
 *
 * Body: any of { name, muscleGroup, equipment, archived }; only the sent fields
 * change. Archiving is `{ archived: true }`: there is no DELETE route, since
 * past workouts and programs keep referencing the exercise.
 * Returns: the updated { id, name, muscleGroup, equipment, archived }, the
 * same shape as the items of GET /api/exercises.
 * Errors: 401 if not logged in, 400 if :id or the body is invalid or empty,
 * 404 if the exercise does not exist or belongs to another user, 409 if the
 * user already has an exercise with the new name.
 */
import { and, eq } from 'drizzle-orm'
import { exercises } from '../../db/schema'

export default defineEventHandler(async (event) => {
  // 401 if not logged in. Also gives the user id used to check ownership.
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  // The whole body, not destructured: we do not know in advance which
  // fields were sent. The partial schema drops unknown keys (such as userId).
  const changes = await readValidatedBody(event, body => exerciseUpdateSchema.parse(body))

  // The partial schema accepts {}, but Drizzle throws on an empty SET:
  // answer with a readable 400 instead of a 500.
  if (Object.keys(changes).length === 0) {
    throw createError({ statusCode: 400, message: 'Aucune modification' })
  }

  // Ownership is part of the WHERE: one atomic query, no gap between a
  // check and the update. A foreign or missing id matches no row.
  let updated
  try {
    [updated] = await useDb()
      .update(exercises)
      .set(changes)
      .where(and(eq(exercises.id, id), eq(exercises.userId, user.id)))
      .returning({
        id: exercises.id,
        name: exercises.name,
        muscleGroup: exercises.muscleGroup,
        equipment: exercises.equipment,
        archived: exercises.archived,
      })
  }
  catch (error) {
    // Same unique index (user_id, name) as on creation.
    if (isUniqueViolation(error, 'exercises_user_name_uq')) {
      throw createError({ statusCode: 409, message: 'Un exercice existe déjà avec ce nom' })
    }
    throw error
  }

  // No row updated: the exercise does not exist or is someone else's. Same
  // answer in both cases, so the ids of other users cannot be probed.
  if (!updated) throw createError({ statusCode: 404, message: 'Exercice introuvable' })
  return updated
})
