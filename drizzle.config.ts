/**
 * drizzle-kit configuration (CLI only: generate / migrate / studio).
 * The app itself never reads this file; at runtime it connects through
 * server/utils/db.ts with the pooled URL.
 */
// Unlike Nuxt, drizzle-kit does not load .env on its own.
import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

// Migrations need the direct (unpooled) connection: the Neon pooler
// does not support everything a migration session may do.
const url = process.env.DATABASE_URL_UNPOOLED
if (!url) {
  throw new Error('DATABASE_URL_UNPOOLED is missing: add it to .env (see .env.example)')
}

export default defineConfig({
  dialect: 'postgresql',
  // Relative paths: a leading "/" would resolve from the drive root (C:\server\...).
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dbCredentials: { url },
  // Must match the casing passed to drizzle() in useDb(), so that
  // camelCase keys (startedAt) map to the same snake_case columns (started_at).
  casing: 'snake_case',
})
