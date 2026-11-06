/**
 * GET /api/programs/:id: one program of the current user with its days and
 * their planned exercises, each list sorted by position (for the editor).
 *
 * Returns: { id, name, active, shareToken, otherPrograms,
 *   days: [{ ..., exercises: [{ ..., exercise: { name } }] }] }.
 * `otherPrograms` is how many other programs the user has: the page needs it
 * to tell whether the active program can be deleted (see the DELETE route).
 * `shareToken` is the secret of its share link, null when not shared.
 * 400 if :id is not a positive integer. 404 if the program does not exist or
 * belongs to another user: the same answer in both cases, so the ids of other
 * users' programs cannot be probed.
 */
import { and, eq, ne } from 'drizzle-orm'
import { programs } from '../../db/schema'

export default defineEventHandler(async (event) => {
  // 401 if not logged in. Also gives the user id used to check ownership.
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)

  const db = useDb()

  // Relational query: one call loads the whole tree. The `and`, `eq` and `asc`
  // used inside come from the callbacks' second argument.
  const programQuery = db.query.programs.findFirst({
    columns: { id: true, name: true, active: true, shareToken: true },
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
  // Only counts the user's own programs, so it needs no ownership check of
  // its own; on a 404 the result is simply dropped.
  const countQuery = db.$count(programs, and(eq(programs.userId, user.id), ne(programs.id, id)))

  // Independent queries: run them in parallel rather than one after the other.
  const [program, otherPrograms] = await Promise.all([programQuery, countQuery])

  if (!program) throw createError({ statusCode: 404, message: 'Programme introuvable' })
  return { ...program, otherPrograms }
})
