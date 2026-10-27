/**
 * Exercise catalogue: the allowed muscle groups and equipment, and the
 * validation schema of an exercise.
 *
 * This file is also imported by server/db/schema.ts, which drizzle-kit and the
 * seed load outside Nuxt: it must only use explicit imports, never Nuxt
 * auto-imports, or those tools would see them as undefined.
 */
import { z } from 'zod'
import { nameSchema } from './programs'

/**
 * Single source of truth for the `muscle_group` and `equipment` Postgres
 * enums: server/db/schema.ts builds its pgEnum from these lists, and the Zod
 * schema below validates against them, so both can never drift apart. They
 * live here rather than in schema.ts because shared/ is also bundled for the
 * browser, which must not pull in Drizzle.
 * Changing a value changes the database type: it needs a migration.
 */
export const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'full_body',
] as const

export const EQUIPMENTS = [
  'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'other',
] as const

/** Create an exercise (POST /api/exercises). */
export const exerciseSchema = z.object({
  name: nameSchema,
  muscleGroup: z.enum(MUSCLE_GROUPS),
  equipment: z.enum(EQUIPMENTS),
})

/**
 * Edit an exercise (PATCH /api/exercises/:id): every field is optional, only
 * the sent ones change. Archiving goes through here too (no DELETE route:
 * workouts and programs keep referencing the exercise), hence `archived`.
 */
export const exerciseUpdateSchema = exerciseSchema
  .extend({ archived: z.boolean() })
  .partial()

/** French labels of the muscle groups. The Record type makes a value added to MUSCLE_GROUPS fail to compile until it gets a label. */
export const MUSCLE_GROUP_LABELS: Record<typeof MUSCLE_GROUPS[number], string> = {
  chest: 'Pectoraux',
  back: 'Dos',
  shoulders: 'Épaules',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Avant-bras',
  quads: 'Quadriceps',
  hamstrings: 'Ischio-jambiers',
  glutes: 'Fessiers',
  calves: 'Mollets',
  abs: 'Abdominaux',
  full_body: 'Corps entier',
}

/** French labels of the equipment, checked the same way as MUSCLE_GROUP_LABELS. */
export const EQUIPMENT_LABELS: Record<typeof EQUIPMENTS[number], string> = {
  barbell: 'Barre',
  dumbbell: 'Haltères',
  machine: 'Machine',
  cable: 'Poulie',
  bodyweight: 'Poids du corps',
  kettlebell: 'Kettlebell',
  other: 'Autre',
}

export type ExerciseInput = z.infer<typeof exerciseSchema>
export type ExerciseUpdateInput = z.infer<typeof exerciseUpdateSchema>
