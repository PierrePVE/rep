/**
 * Estimated one-rep max (1RM): the heaviest weight a lifter could move for a
 * single rep, guessed from a set of several reps.
 *
 * Lives in shared/ because both sides need it: the server to detect e1rm PRs
 * and compute the stats, the client to show the estimate live while a set is
 * being typed.
 */

/**
 * Above this many reps the set tests endurance more than strength, and every
 * 1RM formula drifts badly, so no estimate is given.
 */
export const MAX_REPS_FOR_ONE_REP_MAX = 12

/**
 * Estimates the 1RM of a set with the Epley formula: weight × (1 + reps / 30).
 *
 * @param weightKg - Weight lifted, in kg.
 * @param reps - Number of reps done with that weight.
 * @returns The estimate in kg rounded to 0.1, or null when the set gives no
 *   meaningful estimate (no reps, more than 12 reps, or bodyweight at 0 kg).
 */
export function estimateOneRepMax(weightKg: number, reps: number): number | null {
  if (reps < 1 || reps > MAX_REPS_FOR_ONE_REP_MAX) return null
  // Bodyweight sets are logged at 0 kg: a "1RM of 0 kg" would only be noise
  // in the PR cards and charts.
  if (weightKg <= 0) return null
  // Epley would give weight × 1.033 for a single, but a single IS a 1RM.
  if (reps === 1) return weightKg
  // Round to 0.1 kg so that float noise (e.g. 93.33333) never shows up, and
  // so that two sets with the same estimate compare as equal (no fake PR).
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10
}
