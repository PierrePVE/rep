/**
 * GET /api/shared-programs/:token: read-only preview of a shared program,
 * for any logged-in user who has the link.
 *
 * Returns: { program: { name, days: [{ name, position, exercises: [{
 *   position, targetSets, repMin, repMax, targetRpe, restSeconds, notes,
 *   exercise: { name, muscleGroup, equipment } }] }] }, mine }. Internal ids
 * and the owner are left out; `mine` tells the viewer it is their own program
 * (importing it would just make a copy).
 * Errors: 401 if not logged in, 404 if no program is shared with this token
 * (wrong link, or revoked).
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const token = getRouterParam(event, 'token') ?? ''

  const program = await loadSharedProgram(token)
  if (!program) throw createError({ statusCode: 404, message: 'Ce lien de partage n\'existe pas ou a été révoqué' })

  return {
    program: {
      name: program.name,
      days: program.days.map(d => ({
        name: d.name,
        position: d.position,
        exercises: d.exercises.map(({ id: _, ...e }) => e),
      })),
    },
    mine: program.userId === user.id,
  }
})
