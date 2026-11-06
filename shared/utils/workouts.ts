/**
 * Validation schemas of the workout logger (sessions, their exercises, sets).
 *
 * Shared by the Vue forms and the API routes, like shared/utils/programs.ts.
 * The bounds mirror the SQL CHECK constraints of server/db/schema.ts.
 */
import { z } from 'zod'
import { SET_TYPES } from './sets'

/**
 * Start a session (POST /api/workouts). With a program day, the session is
 * named after it and prefilled with its planned exercises; without one it
 * starts empty (free session).
 */
export const startWorkoutSchema = z.object({
  programDayId: z.number().int().positive().nullable().optional(),
})

/** Add an exercise to the session in progress (POST /api/workouts/:id/exercises). */
export const workoutExerciseSchema = z.object({
  // Custom message: the picker shows it when nothing has been picked yet.
  exerciseId: z.number({ error: 'Exercice requis' }).int().positive(),
})

/**
 * Fields of a set, without defaults. Kept separate because the update schema
 * below needs `.partial()`, and a `.default()` kept through `.partial()` would
 * silently reset an omitted `type` to 'normal' on every edit.
 */
const setFields = z.object({
  // 0 = bodyweight. No step check: the column keeps 2 decimals, and a float
  // check like multipleOf(0.01) wrongly rejects values such as 0.1 + 0.2.
  weightKg: z.number({ error: 'Poids requis' }).min(0, 'Poids négatif').max(1000, '1000 kg maximum'),
  reps: z.number({ error: 'Reps requises' }).int().min(1, '1 rep minimum').max(100, '100 reps maximum'),
  // nullable so that the form can clear it, optional so that it can be omitted.
  rpe: z.number().min(1).max(10).multipleOf(0.5, 'RPE par pas de 0,5').nullable().optional(),
  type: z.enum(SET_TYPES),
})

/** Log a set (POST /api/workout-exercises/:id/sets). A work set by default. */
export const setSchema = setFields.extend({
  type: setFields.shape.type.default('normal'),
})

/** Edit a set (PATCH /api/sets/:id): only the sent fields change. */
export const setUpdateSchema = setFields.partial()

/**
 * Query of the history list (GET /api/workouts). Cursor pagination rather
 * than pages: `cursor` is the id of the last session already shown, so a
 * session finished meanwhile never shifts the list and shows a row twice.
 * Query values arrive as strings, hence the coercion.
 */
export const workoutListQuerySchema = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

/**
 * Edit a session after the fact (PATCH /api/workouts/:id): its name and
 * notes. An empty name or notes field clears it (null) rather than storing "".
 */
export const workoutUpdateSchema = z.object({
  name: z.string().trim().max(50, '50 caractères maximum').transform(v => v || null).nullable().optional(),
  notes: z.string().trim().max(1000, '1000 caractères maximum').transform(v => v || null).nullable().optional(),
})

export type StartWorkoutInput = z.infer<typeof startWorkoutSchema>
export type WorkoutExerciseInput = z.infer<typeof workoutExerciseSchema>
export type SetInput = z.infer<typeof setSchema>
export type SetUpdateInput = z.infer<typeof setUpdateSchema>
export type WorkoutUpdateInput = z.infer<typeof workoutUpdateSchema>
