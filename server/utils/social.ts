/**
 * Server helpers of the social feed: who may use it, finding a user by
 * username, and who may see a session.
 */
import type { H3Event } from 'h3'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { follows, users, workouts } from '../db/schema'

/**
 * Guard for the social routes: a logged-in account, not the demo one (anyone
 * can log into it, so a follower there would be anyone), with a username
 * (the only identity other users ever see; the email stays private).
 *
 * @param event - Current request.
 * @returns The user, with a non-null username.
 * @throws 401 if not logged in, 403 for the demo account, 400 if the user has
 *   not picked a username yet (the pages ask for it first).
 */
export async function requireSocialUser(event: H3Event) {
  const user = await requireUser(event)
  if (user.role === 'demo') {
    throw createError({ statusCode: 403, message: 'Le fil social n\'est pas disponible sur le compte démo' })
  }
  if (!user.username) {
    throw createError({ statusCode: 400, message: 'Choisissez d\'abord un pseudo' })
  }
  return { ...user, username: user.username }
}

/**
 * Finds a user by username. Demo accounts never have one (the profile route
 * refuses them), so they can never be found or followed.
 *
 * @param username - Username from the route, any case.
 * @returns The user's id and username.
 * @throws 404 if nobody has this username.
 */
export async function requireUserByUsername(username: string) {
  const [user] = await useDb()
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
  if (!user) throw createError({ statusCode: 404, message: 'Utilisateur introuvable' })
  return { id: user.id, username: user.username! }
}

/**
 * Loads a session the viewer is allowed to see: their own (any state), or a
 * FINISHED session visible to followers of a user they follow (accepted).
 * Missing and forbidden sessions get the same 404, so the API never reveals
 * that a private session exists.
 *
 * @param viewerId - Logged-in user.
 * @param workoutId - The session.
 * @returns Its id, owner id and whether the viewer owns it.
 * @throws 404 if it does not exist or the viewer may not see it.
 */
export async function requireViewableWorkout(viewerId: number, workoutId: number) {
  const [workout] = await useDb()
    .select({
      id: workouts.id,
      userId: workouts.userId,
      visibility: workouts.visibility,
      endedAt: workouts.endedAt,
      followStatus: follows.status,
    })
    .from(workouts)
    // Left join on the viewer's follow of the owner: null when there is none.
    .leftJoin(follows, and(eq(follows.followeeId, workouts.userId), eq(follows.followerId, viewerId)))
    .where(eq(workouts.id, workoutId))

  const mine = workout?.userId === viewerId
  const shared = !!workout
    && workout.endedAt !== null
    && workout.visibility === 'followers'
    && workout.followStatus === 'accepted'
  if (!workout || !(mine || shared)) throw createError({ statusCode: 404, message: 'Séance introuvable' })
  return { id: workout.id, userId: workout.userId, mine }
}

/**
 * SQL condition of the sessions shown in a user's feed: their own finished
 * ones, and the finished, non-private ones of the users they follow
 * (accepted). Same rule as requireViewableWorkout, for lists.
 *
 * @param viewerId - Logged-in user.
 * @returns A condition for a query on `workouts`.
 */
export function feedWorkoutsCondition(viewerId: number) {
  return and(
    isNotNull(workouts.endedAt),
    // Raw SQL with `workouts.` written out: inside Drizzle's select, an
    // interpolated column would render as a bare, ambiguous name.
    sql`(
      workouts.user_id = ${viewerId}
      OR (workouts.visibility = 'followers' AND EXISTS (
        SELECT 1 FROM follows f
        WHERE f.follower_id = ${viewerId} AND f.followee_id = workouts.user_id AND f.status = 'accepted'
      ))
    )`,
  )
}
