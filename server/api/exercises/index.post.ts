/**
 * POST /api/exercises: adds an exercise to the current user's catalogue.
 *
 * Body: { name, muscleGroup, equipment }. The exercise starts active (the
 * column default): archiving is done afterwards through PATCH.
 * Returns: { exercise: { id, name, muscleGroup, equipment, archived } } with
 * status 201, the same shape as the items of GET /api/exercises, so the
 * client can add it to its list without a second request.
 * Errors: 401 if not logged in, 400 if the input is invalid, 409 if the user
 * already has an exercise with that name.
 */
import { exercises } from '../../db/schema'

export default defineEventHandler(async (event) => {
  // 401 if not logged in. Also gives the owner of the new exercise.
  const user = await requireUser(event)
  const input = await readValidatedBody(event, body => exerciseSchema.parse(body))

  // Insert directly and let the unique index (user_id, name) reject
  // duplicates, instead of checking first: a double click or two open tabs
  // could both pass a prior check and create the same name twice.
  let exercise
  try {
    [exercise] = await useDb()
      .insert(exercises)
      // userId last, so that nothing spread from the body could ever replace
      // it (Zod already strips unknown keys; this keeps it safe regardless).
      .values({ ...input, userId: user.id })
      .returning({
        id: exercises.id,
        name: exercises.name,
        muscleGroup: exercises.muscleGroup,
        equipment: exercises.equipment,
        archived: exercises.archived,
      })
  }
  catch (error) {
    if (isUniqueViolation(error, 'exercises_user_name_uq')) {
      throw createError({ statusCode: 409, message: 'Un exercice existe déjà avec ce nom' })
    }
    throw error
  }
  // .returning() always yields the inserted row; this only narrows the type.
  if (!exercise) throw createError({ statusCode: 500, message: 'Création de l\'exercice impossible' })

  setResponseStatus(event, 201)
  return { exercise }
})
