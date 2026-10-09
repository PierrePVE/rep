/**
 * GET /api/exercises: lists the current user's exercises, for the exercise
 * picker of the program editor and of the workout screen.
 *
 * Archived exercises are left out: they are kept only for history and stats.
 * Returns: [{ id, name, muscleGroup, equipment }], sorted by name.
 */
import { and, asc, eq } from 'drizzle-orm'
import { exercises } from '../../db/schema'

export default defineEventHandler(async (event) => {
  // 401 if not logged in. Also gives the user id used to filter below.
  const user = await requireUser(event)

  return useDb()
    .select({
      id: exercises.id,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
      equipment: exercises.equipment,
    })
    .from(exercises)
    // Without this filter every account would receive everyone's exercises.
    .where(and(
      eq(exercises.userId, user.id),
      eq(exercises.archived, false),
    ))
    .orderBy(asc(exercises.name))
})
