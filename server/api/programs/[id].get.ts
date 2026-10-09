/**
 * GET /api/programs/:id: one program of the current user with its days and
 * their planned exercises, each list sorted by position (for the editor).
 *
 * Returns: { id, name, active, days: [{ ..., exercises: [{ ..., exercise: { name } }] }] }.
 * 400 if :id is not a positive integer. 404 if the program does not exist or
 * belongs to another user: the same answer in both cases, so the ids of other
 * users' programs cannot be probed.
 */
export default defineEventHandler(async (event) => {
  // 401 if not logged in. Also gives the user id used to check ownership.
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)

  // Relational query: one call loads the whole tree. `and`, `eq` and `asc`
  // come from the callbacks, so nothing needs importing from drizzle-orm.
  const program = await useDb().query.programs.findFirst({
    columns: { id: true, name: true, active: true },
    // The userId condition is the ownership check: without it any logged-in
    // user could read any program by guessing its id.
    where: (p, { and, eq }) => and(eq(p.id, id), eq(p.userId, user.id)),
    with: {
      days: {
        orderBy: (d, { asc }) => [asc(d.position)],
        with: {
          exercises: {
            orderBy: (e, { asc }) => [asc(e.position)],
            // Only the name: the editor shows it, the rest is in the catalogue.
            with: { exercise: { columns: { name: true } } },
          },
        },
      },
    },
  })

  if (!program) throw createError({ statusCode: 404, message: 'Programme introuvable' })
  return program
})
