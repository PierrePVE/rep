/**
 * Drizzle client factory, with no dependency on Nuxt / Nitro.
 *
 * Shared by the app (server/utils/db.ts, which reads the URL from the runtime
 * config) and by standalone scripts run with tsx (seed), where
 * useRuntimeConfig() does not exist.
 *
 * Driver: Neon's HTTP driver. Each query is a single HTTPS request, with no
 * TCP connection to keep open: a good fit for serverless functions (Vercel),
 * which are short-lived and would otherwise exhaust Postgres connections.
 * Limitation: no interactive transactions (`db.transaction()` throws). To run
 * several writes atomically, use `db.batch([...])`, which sends them in one
 * request inside a single transaction.
 */
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

/**
 * Builds a Drizzle client bound to the app schema.
 *
 * @param url - Neon connection string.
 * @returns The Drizzle client.
 */
export function createDb(url: string) {
  return drizzle({
    client: neon(url),
    // Enables the relational query API: db.query.workouts.findMany({ with: ... }).
    schema,
    // Must match drizzle.config.ts, otherwise queries would target camelCase
    // columns (startedAt) that the migrations created as snake_case (started_at).
    casing: 'snake_case',
  })
}

/** Type of the Drizzle client, for helpers that receive `db` as a parameter. */
export type Db = ReturnType<typeof createDb>
