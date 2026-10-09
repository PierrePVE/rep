/**
 * POST /api/programs/:id/days: adds a session day at the end of the rotation.
 *
 * Body: { name }. A program holds at most MAX_PROGRAM_DAYS (7) days.
 * Returns: { id, programId, name, position } with status 201.
 * 400 if the input is invalid or the program already has 7 days, 404 if the
 * program does not exist or belongs to another user.
 */
import { count, eq, sql } from 'drizzle-orm'
import { programDays } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const { name } = await readValidatedBody(event, body => programDaySchema.parse(body))
  const program = await requireOwnedProgram(user.id, id)
  const db = useDb()

  // A CHECK constraint cannot count rows, so the limit lives here. Two
  // simultaneous requests could both see 6 days; acceptable for a personal
  // app where only the owner edits their program, from one screen.
  const [{ total } = { total: 0 }] = await db
    .select({ total: count() })
    .from(programDays)
    .where(eq(programDays.programId, program.id))
  if (total >= MAX_PROGRAM_DAYS) {
    throw createError({ statusCode: 400, message: `${MAX_PROGRAM_DAYS} séances maximum par programme` })
  }

  const [day] = await db
    .insert(programDays)
    .values({
      programId: program.id,
      name,
      // max + 1 rather than the count: still correct if positions ever have a
      // gap, where the count would reuse an existing position.
      position: sql`(SELECT COALESCE(MAX(${programDays.position}), -1) + 1 FROM ${programDays} WHERE ${programDays.programId} = ${program.id})`,
    })
    .returning()

  setResponseStatus(event, 201)
  return day
})
