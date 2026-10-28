/**
 * Kinds of set, shared by the database schema, the API and the PR logic.
 *
 * This file is also imported by server/db/schema.ts, which drizzle-kit and the
 * seed load outside Nuxt: it must only use explicit imports, never Nuxt
 * auto-imports.
 */

/**
 * Single source of truth for the `set_type` Postgres enum (see
 * server/db/schema.ts for what each kind means). Kept here rather than in the
 * schema because shared/ is also bundled for the browser, which must not pull
 * in Drizzle. Changing a value changes the database type: it needs a migration.
 */
export const SET_TYPES = ['normal', 'warmup', 'drop'] as const

export type SetType = (typeof SET_TYPES)[number]
