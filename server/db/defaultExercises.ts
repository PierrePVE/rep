/**
 * Base exercise catalogue given to every new account.
 *
 * Each user owns their own copy (see `exercises` in schema.ts), so this list is
 * inserted once per user: by the seed for the admin and demo accounts, and by
 * the sign-up route for everyone else.
 */
import type { Db } from './client'
import { exercises, type NewExercise } from './schema'

/** The base exercises, without `userId` (filled in per account). */
export const DEFAULT_EXERCISES: Omit<NewExercise, 'userId'>[] = [
  // Chest
  { name: 'Développé couché', muscleGroup: 'chest', equipment: 'barbell' },
  { name: 'Développé incliné haltères', muscleGroup: 'chest', equipment: 'dumbbell' },
  { name: 'Écarté poulie', muscleGroup: 'chest', equipment: 'cable' },
  // Shoulders
  { name: 'Développé militaire', muscleGroup: 'shoulders', equipment: 'barbell' },
  { name: 'Élévations latérales', muscleGroup: 'shoulders', equipment: 'dumbbell' },
  { name: 'Face pull', muscleGroup: 'shoulders', equipment: 'cable' },
  // Arms
  { name: 'Dips', muscleGroup: 'triceps', equipment: 'bodyweight' },
  { name: 'Extension triceps poulie', muscleGroup: 'triceps', equipment: 'cable' },
  { name: 'Curl barre', muscleGroup: 'biceps', equipment: 'barbell' },
  { name: 'Curl marteau', muscleGroup: 'biceps', equipment: 'dumbbell' },
  // Back
  { name: 'Tractions', muscleGroup: 'back', equipment: 'bodyweight' },
  { name: 'Rowing barre', muscleGroup: 'back', equipment: 'barbell' },
  { name: 'Tirage vertical', muscleGroup: 'back', equipment: 'cable' },
  { name: 'Rowing poulie assis', muscleGroup: 'back', equipment: 'cable' },
  { name: 'Soulevé de terre', muscleGroup: 'back', equipment: 'barbell' },
  // Legs
  { name: 'Squat', muscleGroup: 'quads', equipment: 'barbell' },
  { name: 'Presse à cuisses', muscleGroup: 'quads', equipment: 'machine' },
  { name: 'Leg extension', muscleGroup: 'quads', equipment: 'machine' },
  { name: 'Soulevé de terre roumain', muscleGroup: 'hamstrings', equipment: 'barbell' },
  { name: 'Leg curl', muscleGroup: 'hamstrings', equipment: 'machine' },
  { name: 'Hip thrust', muscleGroup: 'glutes', equipment: 'barbell' },
  { name: 'Mollets debout', muscleGroup: 'calves', equipment: 'machine' },
  // Abs
  { name: 'Crunch poulie', muscleGroup: 'abs', equipment: 'cable' },
  { name: 'Gainage', muscleGroup: 'abs', equipment: 'bodyweight' },
]

/**
 * Builds the insert of the base exercises for one user, without running it.
 *
 * Returning the query (instead of awaiting it) lets the caller either await it
 * directly or put it in a `db.batch([...])` with other writes.
 *
 * Idempotent: exercises the user already has (same name) are skipped thanks to
 * the (user_id, name) unique index, so re-running it never duplicates anything.
 *
 * @param db - Drizzle client.
 * @param userId - Owner of the new exercises.
 * @returns The pending insert query.
 */
export function createDefaultExercises(db: Db, userId: number) {
  return db
    .insert(exercises)
    .values(DEFAULT_EXERCISES.map(e => ({ ...e, userId })))
    .onConflictDoNothing({ target: [exercises.userId, exercises.name] })
}
