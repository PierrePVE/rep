/**
 * POST /api/programs: creates an empty, inactive program for the current user.
 *
 * Body: { name }. Activation has its own route (POST /api/programs/:id/activate)
 * because it must also deactivate the previously active program.
 * Returns: { program: { id, name, active } } with status 201, so the client can
 * show it or redirect to its editor without a second request.
 * Errors: 401 if not logged in, 400 if the name is invalid, 409 if the user
 * already has a program with that name.
 */
import { programs } from '../../db/schema'

export default defineEventHandler(async (event) => {
  // 401 if not logged in. Also gives the owner of the new program.
  const user = await requireUser(event)
  const { name } = await readValidatedBody(event, body => programSchema.parse(body))

  // Insert directly and let the unique index (user_id, name) reject
  // duplicates, instead of checking first: a double click or two open tabs
  // could both pass a prior check and create the same name twice.
  let program
  try {
    [program] = await useDb()
      .insert(programs)
      .values({ userId: user.id, name })
      .returning({ id: programs.id, name: programs.name, active: programs.active })
  }
  catch (error) {
    if (isUniqueViolation(error)) {
      throw createError({ statusCode: 409, message: 'Un programme existe déjà avec ce nom' })
    }
    throw error
  }
  // .returning() always yields the inserted row; this only narrows the type.
  if (!program) throw createError({ statusCode: 500, message: 'Création du programme impossible' })

  setResponseStatus(event, 201)
  return { program }
})
