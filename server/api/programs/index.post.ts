/**
 * POST /api/programs: creates an empty program for the current user.
 *
 * Body: { name }. The program starts active when the user has no active one
 * yet (e.g. their first program), so that a user with programs always has
 * one active. Otherwise it starts inactive: switching programs has its own
 * route (POST /api/programs/:id/activate), which also deactivates the
 * previous one.
 * Returns: { program: { id, name, active } } with status 201, so the client can
 * show it or redirect to its editor without a second request.
 * Errors: 401 if not logged in, 400 if the name is invalid, 409 if the user
 * already has a program with that name, or if a concurrent creation took the
 * active slot first.
 */
import { sql } from 'drizzle-orm'
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
      .values({
        userId: user.id,
        name,
        // Decided in the INSERT itself rather than by a prior SELECT, so that
        // two concurrent creations cannot both see "no active program": the
        // second one hits programs_one_active_uq instead (handled below).
        active: sql`not exists (select 1 from ${programs} where ${programs.userId} = ${user.id} and ${programs.active})`,
      })
      .returning({ id: programs.id, name: programs.name, active: programs.active })
  }
  catch (error) {
    if (isUniqueViolation(error, 'programs_user_name_uq')) {
      throw createError({ statusCode: 409, message: 'Un programme existe déjà avec ce nom' })
    }
    if (isUniqueViolation(error, 'programs_one_active_uq')) {
      throw createError({ statusCode: 409, message: 'Création simultanée détectée, réessayez' })
    }
    throw error
  }
  // .returning() always yields the inserted row; this only narrows the type.
  if (!program) throw createError({ statusCode: 500, message: 'Création du programme impossible' })

  setResponseStatus(event, 201)
  return { program }
})
