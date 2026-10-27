/**
 * Seed script: fills a freshly migrated database with the data the app needs
 * to be usable. Run it with `npm run db:seed`.
 *
 * It creates:
 * - the admin account (ADMIN_EMAIL / ADMIN_PASSWORD),
 * - the public demo account (DEMO_EMAIL / DEMO_PASSWORD),
 * - the base exercise catalogue for each of them.
 *
 * Idempotent: an account that already exists is left as is (its password is
 * NOT reset), and missing exercises are added without duplicating the others.
 * It is therefore safe to run again, on the dev branch as on prod.
 *
 * Runs with tsx, outside Nuxt: no auto-imports and no useRuntimeConfig(), so
 * it loads .env itself and builds its own client.
 */
// Must come first: the env variables are read below at module level.
import 'dotenv/config'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { eq, sql } from 'drizzle-orm'
import { createDb, type Db } from './client'
import { createDefaultExercises } from './defaultExercises'
import { exercises, users, type UserRole } from './schema'

// Same hasher and default options as nuxt-auth-utils' hashPassword(), so the
// login route can check these passwords with verifyPassword(). Its helpers
// cannot be imported here: they only run inside Nitro.
const hasher = new Hash(new Scrypt({}))

/**
 * Reads a required environment variable.
 *
 * @param name - Variable name.
 * @returns Its value.
 * @throws If it is missing or empty.
 */
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is missing: add it to .env (see .env.example)`)
  }
  return value
}

/**
 * Creates an account if no account uses this email yet, then gives it the base
 * exercises.
 *
 * @param db - Drizzle client.
 * @param account - Email, plain password and role of the account.
 * @returns The id of the (new or existing) account.
 */
async function seedAccount(
  db: Db,
  account: { email: string, password: string, role: UserRole },
): Promise<number> {
  // Same normalisation the sign-up / login routes must apply.
  const email = account.email.trim().toLowerCase()

  // Compared on lower(email) to match the users_email_uq index.
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))

  let userId: number
  if (existing) {
    userId = existing.id
    console.log(`= ${account.role} ${email} already exists (password unchanged)`)
  }
  else {
    const [created] = await db
      .insert(users)
      .values({ email, passwordHash: await hasher.make(account.password), role: account.role })
      .returning({ id: users.id })
    userId = created!.id
    console.log(`+ ${account.role} ${email} created`)
  }

  // returning() lists only the rows actually inserted (conflicts are skipped).
  const added = await createDefaultExercises(db, userId).returning({ id: exercises.id })
  console.log(`  ${added.length} base exercise(s) added`)
  return userId
}

/** Entry point. */
async function main() {
  // Unpooled URL, like drizzle-kit: a one-off script, not app traffic.
  const db = createDb(requireEnv('DATABASE_URL_UNPOOLED'))

  await seedAccount(db, {
    email: requireEnv('ADMIN_EMAIL'),
    password: requireEnv('ADMIN_PASSWORD'),
    role: 'admin',
  })
  await seedAccount(db, {
    email: requireEnv('DEMO_EMAIL'),
    password: requireEnv('DEMO_PASSWORD'),
    role: 'demo',
  })
  console.log('Seed done.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
