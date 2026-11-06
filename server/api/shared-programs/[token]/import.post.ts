/**
 * POST /api/shared-programs/:token/import: copies a shared program into the
 * current user's programs (see importSharedProgram: exercises matched by
 * name, missing ones created).
 *
 * Returns: { program: { id, name, active } } with status 201.
 * Errors: 401 if not logged in, 404 if no program is shared with this token,
 * 409 if a concurrent import or creation took the same name or the active
 * slot first (retrying works).
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const token = getRouterParam(event, 'token') ?? ''

  const source = await loadSharedProgram(token)
  if (!source) throw createError({ statusCode: 404, message: 'Ce lien de partage n\'existe pas ou a été révoqué' })

  let program
  try {
    program = await importSharedProgram(user.id, source)
  }
  catch (error) {
    if (isUniqueViolation(error)) {
      throw createError({ statusCode: 409, message: 'Import simultané détecté, réessayez' })
    }
    throw error
  }

  setResponseStatus(event, 201)
  return { program }
})
