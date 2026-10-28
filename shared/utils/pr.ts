/**
 * Personal record (PR) detection.
 *
 * PRs are not stored: they are computed on the fly by comparing a set with
 * the earlier sets of the same exercise (a few thousand sets a year, so this
 * stays cheap). Lives in shared/ so that the server can flag a PR when a set
 * is saved and the client can reuse the same rules.
 */
import { estimateOneRepMax } from './oneRepMax'
import type { SetType } from './sets'

/**
 * The four kinds of record tracked per exercise:
 * - `max_weight`: heaviest weight lifted, whatever the reps.
 * - `e1rm`      : best estimated one-rep max (sets of 12 reps or fewer).
 * - `set_volume`: best weight × reps on a single set.
 * - `rep_max`   : most reps at a given weight or heavier.
 */
export type PrType = 'max_weight' | 'e1rm' | 'set_volume' | 'rep_max'

/** The fields of a set that the PR rules look at. */
export interface PrSet {
  weightKg: number
  reps: number
  type: SetType
}

/**
 * Compares a new set with the earlier sets of the same exercise.
 *
 * Rules:
 * - Only `normal` sets count, on both sides: a warm-up or a drop set never
 *   becomes a PR, and never hides one from the history either.
 * - A record must be strictly beaten: equalling it is not a PR.
 * - A record needs something to beat: the first set of an exercise, or the
 *   first weighted set after bodyweight ones, is not a PR (otherwise every
 *   new exercise would light up with badges).
 * - Bodyweight sets (0 kg) can only give a `rep_max`.
 *
 * @param next - The set just done.
 * @param history - Earlier sets of the same exercise, any type, any order.
 *   Must not include `next` itself.
 * @returns The records beaten, in the order of PrType (empty when none).
 */
export function detectPrs(next: PrSet, history: PrSet[]): PrType[] {
  if (next.type !== 'normal') return []
  const workSets = history.filter(s => s.type === 'normal')
  if (workSets.length === 0) return []

  const prs: PrType[] = []

  // Weight-based records only make sense against earlier weighted sets:
  // beating "0 kg" with a first weighted pull-up is not a real record.
  const weightedSets = workSets.filter(s => s.weightKg > 0)
  if (next.weightKg > 0 && weightedSets.length > 0) {
    const bestWeight = Math.max(...weightedSets.map(s => s.weightKg))
    if (next.weightKg > bestWeight) prs.push('max_weight')

    // Sets above 12 reps have no estimate (null) and are left out. If none
    // of the earlier sets has one, there is nothing to beat yet.
    const nextE1rm = estimateOneRepMax(next.weightKg, next.reps)
    const earlierE1rms = weightedSets
      .map(s => estimateOneRepMax(s.weightKg, s.reps))
      .filter(e => e !== null)
    if (nextE1rm !== null && earlierE1rms.length > 0 && nextE1rm > Math.max(...earlierE1rms)) {
      prs.push('e1rm')
    }

    const bestVolume = Math.max(...weightedSets.map(s => s.weightKg * s.reps))
    if (next.weightKg * next.reps > bestVolume) prs.push('set_volume')
  }

  // Lighter sets are left out: 12 reps at 60 kg says nothing about what is
  // possible at 80 kg. With no earlier set at this weight or heavier, the set
  // is a new max_weight, not a rep max (heavier, fewer reps = progress).
  const comparableSets = workSets.filter(s => s.weightKg >= next.weightKg)
  if (comparableSets.length > 0 && next.reps > Math.max(...comparableSets.map(s => s.reps))) {
    prs.push('rep_max')
  }

  return prs
}
