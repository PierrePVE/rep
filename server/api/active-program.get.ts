/**
 * GET /api/active-program: the current user's active program, for the start
 * screen of a session, with the day to suggest next.
 *
 * Returns: { program: { id, name, days: [{ id, name, position,
 *   exerciseCount }], nextDayId } }, the days sorted by position, or
 * { program: null } when the user has no program yet (a 200: that is a normal
 * state for a new account).
 * `nextDayId` is the day after the one of the last FINISHED session started
 * from this program (see nextProgramDayId); free sessions and sessions of
 * other programs do not move the rotation. Null for a program without days.
 *
 * Not under /api/programs/: an /api/programs/active route would share its
 * path pattern with /api/programs/:id, and the typed $fetch would then type
 * every `/api/programs/${id}` call as either of the two routes.
 */
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { workouts } from '../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = useDb()

  const program = await db.query.programs.findFirst({
    columns: { id: true, name: true },
    where: (p, { and, eq }) => and(eq(p.userId, user.id), eq(p.active, true)),
    with: {
      days: {
        columns: { id: true, name: true, position: true },
        orderBy: (d, { asc }) => [asc(d.position)],
        // Only the ids, to count them: the start screen shows "5 exercices".
        with: { exercises: { columns: { id: true } } },
      },
    },
  })
  if (!program) return { program: null }

  const dayIds = program.days.map(d => d.id)
  // Without days there is nothing to look up (and inArray() of an empty list
  // would be useless SQL).
  const [last] = dayIds.length
    ? await db
        .select({ programDayId: workouts.programDayId })
        .from(workouts)
        .where(and(
          eq(workouts.userId, user.id),
          inArray(workouts.programDayId, dayIds),
          isNotNull(workouts.endedAt),
        ))
        .orderBy(desc(workouts.startedAt))
        .limit(1)
    : []

  return {
    program: {
      id: program.id,
      name: program.name,
      days: program.days.map(d => ({
        id: d.id,
        name: d.name,
        position: d.position,
        exerciseCount: d.exercises.length,
      })),
      nextDayId: nextProgramDayId(program.days, last?.programDayId ?? null),
    },
  }
})
