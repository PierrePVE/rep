/**
 * Database schema (Drizzle ORM, PostgreSQL on Neon).
 *
 * Data model:
 *
 *   users 1───* sessions
 *     │
 *     ├──1───* exercises 1───* workout_exercises *───1 workouts *───1 users
 *                                     │
 *                                     1───* sets
 *
 * - `users`             : accounts (email + password), with a role (user / admin / demo).
 * - `sessions`          : server-side login sessions, one row per logged-in device.
 * - `exercises`         : each user's own exercise catalogue (bench press, squat...).
 * - `workouts`          : one gym session (start, end) of a user.
 * - `workout_exercises` : an exercise done during a given session, with its order.
 *                         It is the join table between workouts and exercises,
 *                         plus its own data (position, notes).
 * - `sets`              : one set (weight x reps) attached to a workout_exercise.
 *
 * Ownership: only `exercises` and `workouts` carry a `userId`. Workout exercises
 * and sets belong to a user through their workout, so the API must always reach
 * them via a workout filtered on the current user. The DB does not prevent a
 * workout from referencing another user's exercise: the API checks it.
 *
 * Keys are written in camelCase here; `casing: 'snake_case'` (drizzle.config.ts
 * and useDb()) turns them into snake_case columns (startedAt -> started_at).
 * That is also why the raw `sql` snippets below use snake_case names.
 *
 * Personal records are NOT stored: they are computed on the fly from `sets`
 * (see docs/DATA_MODEL.md), so there is no `prs` table.
 */
import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// Enums: real Postgres ENUM types, so the database itself rejects unknown values.
// ---------------------------------------------------------------------------

/**
 * Account role:
 * - `user` : regular account.
 * - `admin`: can also list and delete other accounts.
 * - `demo` : public portfolio account. Same features as `user`, but the API
 *            must refuse to change its email / password or delete it, and its
 *            data can be reset periodically.
 */
export const userRole = pgEnum('user_role', ['user', 'admin', 'demo'])

/** Main muscle group of an exercise, used for the weekly volume per muscle stats. */
export const muscleGroup = pgEnum('muscle_group', [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'full_body',
])

/** Equipment used, mostly to tell apart variants (barbell vs dumbbell bench). */
export const equipment = pgEnum('equipment', [
  'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'other',
])

/**
 * Kind of set. Replaces the `isWarmup` boolean of the original spec, because
 * drop sets need their own treatment:
 * - `normal`: work set, counts for PRs and volume.
 * - `warmup`: ignored by PRs and volume.
 * - `drop`  : counts for volume, but never triggers a PR and is skipped (or
 *             tagged) by the "last time" display and the prefill, so a lighter
 *             drop set never reads as a regression.
 */
export const setType = pgEnum('set_type', ['normal', 'warmup', 'drop'])

// ---------------------------------------------------------------------------
// Auth tables
// ---------------------------------------------------------------------------

/** User accounts. Login is email + password. */
export const users = pgTable('users', {
  id: serial().primaryKey(),
  // Stored as typed; uniqueness is case-insensitive (see the index below),
  // and the API should still lowercase / trim it before writing.
  email: text().notNull(),
  // Never the password itself: a scrypt hash (e.g. nuxt-auth-utils'
  // hashPassword), which embeds its own salt and parameters.
  passwordHash: text().notNull(),
  role: userRole().notNull().default('user'),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, t => [
  // On lower(email) rather than email, so "Pierre@x.com" and "pierre@x.com"
  // cannot become two accounts.
  uniqueIndex('users_email_uq').on(sql`lower(email)`),
  // At most ONE admin. Same trick as the "one in-progress workout" index: every
  // admin row gets the same key, so a second admin violates the uniqueness.
  uniqueIndex('users_one_admin_uq').on(t.role).where(sql`role = 'admin'`),
])

/**
 * Server-side sessions ("opaque token" pattern).
 *
 * On login the server generates a random token, sends it to the browser in an
 * httpOnly cookie, and stores only its SHA-256 hash here. Each request hashes
 * the cookie value and looks the row up. Storing the hash means a leaked DB
 * dump cannot be replayed as valid cookies.
 *
 * No refresh token: they exist for stateless access tokens (JWT) that cannot be
 * revoked and must therefore be short-lived. A DB session is checked on every
 * request, so it can be revoked at any time (logout, account deleted by the
 * admin), and it is kept alive by pushing `expiresAt` forward when the user is
 * active (sliding expiration), which is what a refresh token would provide.
 */
export const sessions = pgTable('sessions', {
  // SHA-256 of the token, hex encoded. The raw token never touches the DB.
  id: text().primaryKey(),
  // Deleting a user logs them out everywhere.
  userId: integer().notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, t => [
  // "Log out from all devices" deletes by user.
  index('sessions_user_idx').on(t.userId),
  // Cleanup job: DELETE FROM sessions WHERE expires_at < now().
  index('sessions_expires_at_idx').on(t.expiresAt),
])

// ---------------------------------------------------------------------------
// Training tables
// ---------------------------------------------------------------------------

/**
 * Exercise catalogue, one per user: each account gets its own copy of the base
 * exercises at sign-up, so renaming or archiving one never affects other users.
 * Exercises are archived instead of deleted, because deleting one would erase
 * (or be blocked by) its history.
 */
export const exercises = pgTable('exercises', {
  id: serial().primaryKey(),
  userId: integer().notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  muscleGroup: muscleGroup().notNull(),
  equipment: equipment().notNull().default('other'),
  // Hidden from the "add exercise" picker, but kept for history and stats.
  archived: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, t => [
  // Unique per user, not globally: two users can both have "Squat". This index
  // also serves "list my exercises" (it starts with user_id).
  uniqueIndex('exercises_user_name_uq').on(t.userId, t.name),
])

/** A gym session. `endedAt = null` means the session is still in progress. */
export const workouts = pgTable('workouts', {
  id: serial().primaryKey(),
  userId: integer().notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text(), // optional label, e.g. "Push A"
  startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp({ withTimezone: true }),
  notes: text(),
}, t => [
  // History list and stats always filter by user and sort by date.
  index('workouts_user_started_at_idx').on(t.userId, t.startedAt),
  // At most ONE session in progress per user: a partial unique index. Only
  // rows with ended_at IS NULL are indexed, so two in-progress sessions of the
  // same user collide; finished sessions are not concerned.
  uniqueIndex('workouts_one_in_progress_uq').on(t.userId).where(sql`ended_at IS NULL`),
  check('workouts_ended_after_started_ck', sql`ended_at IS NULL OR ended_at >= started_at`),
])

/**
 * An exercise performed during a session. The same exercise may appear twice
 * in one session (e.g. bench at the start and at the end), hence no unique
 * constraint on (workoutId, exerciseId).
 */
export const workoutExercises = pgTable('workout_exercises', {
  id: serial().primaryKey(),
  // Deleting a session deletes its exercises (and, in cascade, their sets).
  workoutId: integer().notNull().references(() => workouts.id, { onDelete: 'cascade' }),
  // 'no action' and not 'restrict': both refuse to delete an exercise that has
  // history, but 'restrict' checks immediately, while 'no action' checks at the
  // end of the statement. Deleting a user cascades to BOTH exercises and
  // workouts; with 'restrict' that could fail depending on which cascade runs
  // first, with 'no action' the referencing rows are gone by the time it checks.
  exerciseId: integer().notNull().references(() => exercises.id, { onDelete: 'no action' }),
  position: integer().notNull(), // order inside the session (0, 1, 2...)
  notes: text(),
}, t => [
  // Postgres does not index foreign keys automatically; these speed up the
  // joins "exercises of a session" and "history of an exercise".
  index('we_workout_idx').on(t.workoutId),
  index('we_exercise_idx').on(t.exerciseId),
])

/** One set: weight x reps, with an optional RPE. */
export const sets = pgTable('sets', {
  id: serial().primaryKey(),
  workoutExerciseId: integer().notNull()
    .references(() => workoutExercises.id, { onDelete: 'cascade' }),
  position: integer().notNull(), // order inside the exercise (0, 1, 2...)
  // numeric instead of real: exact decimals (82.5 stays 82.5, no float drift).
  // mode 'number' returns a JS number instead of the default string.
  weightKg: numeric({ precision: 6, scale: 2, mode: 'number' }).notNull(), // 0 = bodyweight
  reps: integer().notNull(),
  rpe: numeric({ precision: 3, scale: 1, mode: 'number' }), // 1-10, optional
  type: setType().notNull().default('normal'),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('sets_we_idx').on(t.workoutExerciseId),
  // Same rules as the Zod validation: Zod gives nice error messages to the
  // UI, these CHECKs guarantee the data stays valid whatever writes to it.
  check('sets_reps_ck', sql`reps BETWEEN 1 AND 100`),
  check('sets_weight_ck', sql`weight_kg BETWEEN 0 AND 1000`),
  // rpe * 2 must be a whole number, i.e. steps of 0.5 (7, 7.5, 8...).
  check('sets_rpe_ck', sql`rpe IS NULL OR (rpe BETWEEN 1 AND 10 AND rpe * 2 = trunc(rpe * 2))`),
])

// ---------------------------------------------------------------------------
// Relations: no effect on the SQL schema (the foreign keys above do that).
// They only teach Drizzle's query API how to load nested data, e.g.
//   db.query.workouts.findFirst({ with: { exercises: { with: { sets: true } } } })
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  exercises: many(exercises),
  workouts: many(workouts),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const exercisesRelations = relations(exercises, ({ one, many }) => ({
  user: one(users, { fields: [exercises.userId], references: [users.id] }),
  workoutExercises: many(workoutExercises),
}))

export const workoutsRelations = relations(workouts, ({ one, many }) => ({
  user: one(users, { fields: [workouts.userId], references: [users.id] }),
  exercises: many(workoutExercises),
}))

export const workoutExercisesRelations = relations(workoutExercises, ({ one, many }) => ({
  workout: one(workouts, { fields: [workoutExercises.workoutId], references: [workouts.id] }),
  exercise: one(exercises, { fields: [workoutExercises.exerciseId], references: [exercises.id] }),
  sets: many(sets),
}))

export const setsRelations = relations(sets, ({ one }) => ({
  workoutExercise: one(workoutExercises, {
    fields: [sets.workoutExerciseId],
    references: [workoutExercises.id],
  }),
}))

// ---------------------------------------------------------------------------
// Inferred types, to reuse in the API and the front end instead of
// redeclaring the shapes by hand. `Select` = a row read from the DB,
// `New...` = what an insert accepts (columns with defaults become optional).
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type UserRole = (typeof userRole.enumValues)[number]
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type Exercise = typeof exercises.$inferSelect
export type NewExercise = typeof exercises.$inferInsert
export type Workout = typeof workouts.$inferSelect
export type NewWorkout = typeof workouts.$inferInsert
export type WorkoutExercise = typeof workoutExercises.$inferSelect
export type NewWorkoutExercise = typeof workoutExercises.$inferInsert
// Not named `Set`: it would shadow the built-in JavaScript Set.
export type WorkoutSet = typeof sets.$inferSelect
export type NewWorkoutSet = typeof sets.$inferInsert
export type SetType = (typeof setType.enumValues)[number]
