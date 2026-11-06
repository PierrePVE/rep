/**
 * Program sharing: share links and copying a shared program into another
 * account.
 *
 * A share link holds a random token (programs.share_token). Any logged-in
 * user who has the link can preview the program and import a copy; the copy
 * is independent (later edits of either side do not reach the other).
 */
import { randomBytes } from 'node:crypto'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { exercises, programDays, programExercises, programs } from '../db/schema'

/**
 * Creates the secret of a share link: 128 random bits, URL-safe (22
 * characters), so links cannot be guessed or enumerated.
 *
 * @returns A new token.
 */
export function generateShareToken() {
  return randomBytes(16).toString('base64url')
}

/**
 * Loads a shared program by its link, with its days and planned exercises
 * (each list sorted by position). The owner is left out on purpose: a link
 * must not reveal who made it (their email is their login).
 *
 * @param token - Token from the link.
 * @returns The program tree, or null if no program is shared with this token
 *   (never shared, or the link was revoked).
 */
export async function loadSharedProgram(token: string) {
  const program = await useDb().query.programs.findFirst({
    columns: { id: true, userId: true, name: true },
    where: (p, { eq }) => eq(p.shareToken, token),
    with: {
      days: {
        columns: { id: true, name: true, position: true },
        orderBy: (d, { asc }) => [asc(d.position)],
        with: {
          exercises: {
            columns: { id: true, position: true, targetSets: true, repMin: true, repMax: true, targetRpe: true, restSeconds: true, notes: true },
            orderBy: (e, { asc }) => [asc(e.position)],
            with: { exercise: { columns: { name: true, muscleGroup: true, equipment: true } } },
          },
        },
      },
    },
  })
  return program ?? null
}

/** Longest program name (see nameSchema in shared/utils/programs.ts). */
const MAX_NAME_LENGTH = 50

/**
 * Picks a name for the copy that the user does not use yet: the original
 * name, else "Name (2)", "Name (3)"... (program names are unique per user).
 *
 * @param userId - Who gets the copy.
 * @param name - Name of the shared program.
 * @returns A free name, at most 50 characters.
 */
async function freeProgramName(userId: number, name: string) {
  const rows = await useDb().select({ name: programs.name }).from(programs).where(eq(programs.userId, userId))
  const taken = new Set(rows.map(r => r.name))
  if (!taken.has(name)) return name
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`
    const candidate = `${name.slice(0, MAX_NAME_LENGTH - suffix.length).trimEnd()}${suffix}`
    if (!taken.has(candidate)) return candidate
  }
}

/**
 * Copies a shared program into a user's account.
 *
 * Exercises belong to each account, so each planned exercise is matched by
 * name to the user's own catalogue. The missing ones are created with the
 * same muscle group and equipment; matching ones the user had archived are
 * restored, since the imported program uses them.
 *
 * neon-http has no interactive transactions: the steps run one after the
 * other, and if one fails after the program row exists, that row is deleted
 * (its days and exercises go with it, ON DELETE CASCADE), so a failed import
 * leaves no half-built program behind. Created or restored exercises are kept:
 * they are harmless in the catalogue.
 *
 * @param userId - Who gets the copy.
 * @param source - The shared program (loadSharedProgram).
 * @returns The new program: { id, name, active }. It is active only when the
 *   user had no active program (same rule as POST /api/programs).
 */
export async function importSharedProgram(
  userId: number,
  source: NonNullable<Awaited<ReturnType<typeof loadSharedProgram>>>,
) {
  const db = useDb()

  // --- Exercises: match by name, create the missing ones. ---
  const wanted = new Map<string, { name: string, muscleGroup: typeof exercises.$inferSelect['muscleGroup'], equipment: typeof exercises.$inferSelect['equipment'] }>()
  for (const day of source.days) {
    for (const planned of day.exercises) wanted.set(planned.exercise.name, planned.exercise)
  }
  const names = [...wanted.keys()]

  const owned = names.length
    ? await db
        .select({ id: exercises.id, name: exercises.name, archived: exercises.archived })
        .from(exercises)
        .where(and(eq(exercises.userId, userId), inArray(exercises.name, names)))
    : []
  const idByName = new Map(owned.map(e => [e.name, e.id]))

  const missing = names.filter(name => !idByName.has(name)).map(name => ({ ...wanted.get(name)!, userId }))
  if (missing.length) {
    const created = await db.insert(exercises).values(missing).returning({ id: exercises.id, name: exercises.name })
    for (const e of created) idByName.set(e.name, e.id)
  }

  const archivedIds = owned.filter(e => e.archived).map(e => e.id)
  if (archivedIds.length) {
    await db.update(exercises).set({ archived: false }).where(inArray(exercises.id, archivedIds))
  }

  // --- Program, then its days, then the planned exercises. ---
  const name = await freeProgramName(userId, source.name)
  const [program] = await db
    .insert(programs)
    .values({
      userId,
      name,
      // Same rule as POST /api/programs: active only if the user has none.
      active: sql`not exists (select 1 from ${programs} where ${programs.userId} = ${userId} and ${programs.active})`,
    })
    .returning({ id: programs.id, name: programs.name, active: programs.active })
  if (!program) throw createError({ statusCode: 500, message: 'Import du programme impossible' })

  try {
    if (source.days.length) {
      const days = await db
        .insert(programDays)
        .values(source.days.map(d => ({ programId: program.id, name: d.name, position: d.position })))
        .returning({ id: programDays.id, position: programDays.position })
      const dayIdByPosition = new Map(days.map(d => [d.position, d.id]))

      const planned = source.days.flatMap(d => d.exercises.map(e => ({
        programDayId: dayIdByPosition.get(d.position)!,
        exerciseId: idByName.get(e.exercise.name)!,
        position: e.position,
        targetSets: e.targetSets,
        repMin: e.repMin,
        repMax: e.repMax,
        targetRpe: e.targetRpe,
        restSeconds: e.restSeconds,
        notes: e.notes,
      })))
      if (planned.length) await db.insert(programExercises).values(planned)
    }
  }
  catch (error) {
    await db.delete(programs).where(eq(programs.id, program.id))
    throw error
  }

  return program
}
