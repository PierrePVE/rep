/**
 * Tops up the exercise catalogue of every existing account with the base
 * exercises it does not have yet. Run it with `npm run db:sync-exercises`
 * after DEFAULT_EXERCISES grows (e.g. a new wger import).
 *
 * Only adds: exercises are matched by name, and the ones an account already
 * has (renamed, archived or untouched) are left exactly as they are. Safe to
 * run again, on the dev branch as on prod.
 *
 * Unlike the seed, it needs no account passwords: only DATABASE_URL_UNPOOLED.
 * Runs with tsx, outside Nuxt: explicit imports only.
 */
// Must come first: the env variables are read below at module level.
import 'dotenv/config'
import { asc } from 'drizzle-orm'
import { createDb } from './client'
import { createDefaultExercises } from './defaultExercises'
import { exercises, users } from './schema'

/** Entry point. */
async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED
  if (!url) throw new Error('DATABASE_URL_UNPOOLED is missing: add it to .env (see .env.example)')
  // Unpooled URL, like the seed: a one-off script, not app traffic.
  const db = createDb(url)

  const accounts = await db.select({ id: users.id, email: users.email }).from(users).orderBy(asc(users.id))
  let total = 0
  // One account at a time: a few accounts, and a failure then names the one
  // it stopped at, the earlier ones being already done.
  for (const account of accounts) {
    // returning() lists only the rows actually inserted (conflicts are skipped).
    const added = await createDefaultExercises(db, account.id).returning({ id: exercises.id })
    total += added.length
    console.log(`${account.email}: ${added.length} exercise(s) added`)
  }
  console.log(`Done: ${total} exercise(s) added to ${accounts.length} account(s).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
