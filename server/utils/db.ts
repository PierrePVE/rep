/**
 * Database access for the Nitro server.
 *
 * Files in server/utils/ are auto-imported by Nitro, so every API route can
 * call `useDb()` without importing it. The client itself is built by
 * server/db/client.ts (see there for the driver and its limitations).
 */
import { createDb, type Db } from '../db/client'

// Re-exported so routes and helpers get the type through auto-import too.
export type { Db }

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

/**
 * Tells whether a query failed because of a unique constraint (Postgres error
 * 23505), e.g. inserting an email that already has an account.
 * Drizzle wraps driver errors, so the Postgres error may be one or several
 * levels down the `cause` chain.
 *
 * @param error - Error thrown by a query.
 * @returns True for a unique violation.
 */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error
  while (current instanceof Error) {
    if ('code' in current && current.code === '23505') return true
    current = current.cause
  }
  return false
}
