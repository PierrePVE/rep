/**
 * GET /api/exercises: lists the current user's exercises, for the exercise
 * picker of the program editor and of the workout screen, and for the
 * exercise library page.
 *
 * Query: `?archived=true` returns the archived exercises instead of the active
 * ones (the library shows them apart, to unarchive them). Without it, only the
 * active ones: archived exercises are kept for history and stats, not picked.
 * Returns: [{ id, name, muscleGroup, equipment, archived }], sorted by name.
 * 400 if `archived` is not a boolean-like value.
 */
import { and, asc, eq } from 'drizzle-orm'
import { exercises } from '../../db/schema'

export default defineEventHandler(async (event) => {
  // 401 if not logged in. Also gives the user id used to filter below.
  const user = await requireUser(event)
  const { archived } = await getValidatedQuery(event, exerciseListQuerySchema.parse)

  return useDb()
    .select({
      id: exercises.id,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
      equipment: exercises.equipment,
      archived: exercises.archived,
    })
    .from(exercises)
    // Without the userId filter every account would receive everyone's exercises.
    .where(and(
      eq(exercises.userId, user.id),
      eq(exercises.archived, archived),
    ))
    .orderBy(asc(exercises.name))
})
