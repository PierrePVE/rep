/**
 * Validation schemas of the program editor (programs, days, planned exercises).
 *
 * Shared by the Vue forms (instant feedback) and the API routes (the only
 * check that can be trusted, since anyone can call the API directly). The
 * bounds mirror the SQL CHECK constraints of server/db/schema.ts: the database
 * stays the last line of defence, Zod just rejects bad input earlier and with
 * a readable French message instead of a raw Postgres error.
 */
import { z } from 'zod'

/**
 * Maximum number of session days in a program: one per day of the week.
 * Enforced by POST /api/programs/:id/days; the editor uses it to disable its
 * "add a day" button instead of letting the user hit the 400.
 */
export const MAX_PROGRAM_DAYS = 7

/**
 * Program, day and exercise names: trimmed so that "  Push A " and "Push A"
 * are the same. Exported for shared/utils/exercises.ts.
 */
export const nameSchema = z.string()
  .trim()
  .min(1, 'Nom requis')
  .max(50, '50 caractères maximum')

/**
 * Route parameter `:id`. Params always arrive as strings ("12"), so they are
 * coerced to a number first; "abc" or "-3" are then rejected with a 400
 * instead of reaching the database.
 */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

/** Create or rename a program (POST /api/programs, PATCH /api/programs/:id). */
export const programSchema = z.object({
  name: nameSchema,
})

/** Create or rename a program day (POST .../days, PATCH /api/program-days/:id). */
export const programDaySchema = z.object({
  name: nameSchema,
})

/**
 * Fields of a planned exercise, without the cross-field rule. Kept separate
 * because Zod 4 refuses `.partial()` on a schema that already has a
 * `.refine()`, and the update schema below needs `.partial()`.
 */
const programExerciseFields = z.object({
  // Custom message: the form shows it when no exercise has been picked yet.
  exerciseId: z.number({ error: 'Exercice requis' }).int().positive(),
  targetSets: z.number().int().min(1, '1 série minimum').max(20, '20 séries maximum'),
  repMin: z.number().int().min(1, '1 rep minimum').max(100, '100 reps maximum'),
  repMax: z.number().int().min(1, '1 rep minimum').max(100, '100 reps maximum'),
  // nullable so that the editor can clear a value (send null), optional so
  // that the client may simply omit it.
  targetRpe: z.number().min(1).max(10).multipleOf(0.5, 'RPE par pas de 0,5').nullable().optional(),
  restSeconds: z.number().int().min(0).max(3600, '1 heure maximum').nullable().optional(),
  notes: z.string().trim().max(500, '500 caractères maximum').nullable().optional(),
})

/**
 * Error shown under the "reps max" field. `path` attaches it to that field,
 * so a UForm displays it in the right place instead of as a global error.
 */
const repRangeError = { message: 'Le max doit être ≥ au min', path: ['repMax'] }

/** Add an exercise to a day (POST /api/program-days/:id/exercises). */
export const programExerciseSchema = programExerciseFields
  .refine(v => v.repMin <= v.repMax, repRangeError)

/**
 * Edit a planned exercise (PATCH /api/program-exercises/:id): every field is
 * optional, only the sent ones change. The exercise itself cannot be swapped
 * here (remove it and add another), hence the omit. The range is only checked
 * when both bounds are sent; if only one is, the SQL CHECK still guards it.
 */
export const programExerciseUpdateSchema = programExerciseFields
  .omit({ exerciseId: true })
  .partial()
  .refine(v => v.repMin === undefined || v.repMax === undefined || v.repMin <= v.repMax, repRangeError)

/**
 * Reorder the exercises of a day (PUT /api/program-days/:id/order): the full
 * list of ids in their new order. Duplicates are rejected, since they would
 * give two exercises the same position.
 */
export const reorderSchema = z.object({
  ids: z.array(z.number().int().positive())
    .min(1)
    .max(50)
    .refine(ids => new Set(ids).size === ids.length, 'Identifiants en double'),
})

export type ProgramInput = z.infer<typeof programSchema>
export type ProgramDayInput = z.infer<typeof programDaySchema>
export type ProgramExerciseInput = z.infer<typeof programExerciseSchema>
export type ProgramExerciseUpdateInput = z.infer<typeof programExerciseUpdateSchema>
export type ReorderInput = z.infer<typeof reorderSchema>
