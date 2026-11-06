/**
 * Social feed rules shared by the client and the API: usernames, follow
 * statuses and workout visibility. Explicit imports only: schema.ts imports
 * this file, and drizzle-kit / tsx load it outside Nuxt's auto-imports.
 */
import { z } from 'zod'

/**
 * Username: 3 to 20 lowercase letters, digits, dots or underscores, starting
 * with a letter or digit. Lowercase only, so "Pierre" and "pierre" can never
 * be two people; the API lowercases what the user types. Kept as a string
 * source so the database CHECK uses the exact same rule.
 */
export const USERNAME_PATTERN_SOURCE = '^[a-z0-9][a-z0-9_.]{2,19}$'

/** Validates and normalizes a username typed by the user. */
export const usernameSchema = z.string()
  .trim()
  .toLowerCase()
  .regex(new RegExp(USERNAME_PATTERN_SOURCE), '3 à 20 caractères : lettres, chiffres, points ou tirets bas')

/** Body of PATCH /api/profile. */
export const profileUpdateSchema = z.object({ username: usernameSchema })

/**
 * Follow statuses: a request stays `pending` until the followed person
 * accepts it (user's choice: following is on request, sessions are personal).
 */
export const FOLLOW_STATUSES = ['pending', 'accepted'] as const

/**
 * Who sees a finished session: `followers` (the default) or only its owner.
 */
export const WORKOUT_VISIBILITIES = ['followers', 'private'] as const

export type FollowStatus = typeof FOLLOW_STATUSES[number]
export type WorkoutVisibility = typeof WORKOUT_VISIBILITIES[number]
