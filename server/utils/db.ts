/**
 * Database access for the Nitro server.
 *
 * Files in server/utils/ are auto-imported by Nitro, so every API route can
 * call `useDb()` without importing it.
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
import * as schema from '../db/schema'

/**
 * Builds the Drizzle client. Kept as a separate function only so that the
 * `Db` type below can be inferred from its return type.
 *
 * @param url - Neon pooled connection string.
 * @returns A Drizzle client bound to the app schema.
 */
function createDb(url: string) {
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

// Created on first use and then reused for the lifetime of the server process
// (or of the warm serverless instance), instead of being rebuilt per request.
let db: Db | undefined

/**
 * Returns the shared Drizzle client.
 *
 * Lazy so that the runtime config (filled from NUXT_DATABASE_URL at runtime,
 * not at build time) is read when the first request arrives.
 *
 * @returns The Drizzle client.
 * @throws If NUXT_DATABASE_URL is not set.
 */
export function useDb(): Db {
  if (!db) {
    const { databaseUrl } = useRuntimeConfig()
    if (!databaseUrl) {
      throw new Error('NUXT_DATABASE_URL is missing: add it to .env (see .env.example)')
    }
    db = createDb(databaseUrl)
  }
  return db
}
