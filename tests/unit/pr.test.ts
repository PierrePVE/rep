/**
 * Unit tests of the personal record detection (shared/utils/pr.ts).
 */
import { describe, expect, it } from 'vitest'
import { detectPrs, type PrSet } from '../../shared/utils/pr'

/** Shorthand for a set: `set(80, 8)` is a work set of 80 kg × 8. */
function set(weightKg: number, reps: number, type: PrSet['type'] = 'normal'): PrSet {
  return { weightKg, reps, type }
}

describe('detectPrs', () => {
  it('never flags the first set of an exercise', () => {
    expect(detectPrs(set(100, 5), [])).toEqual([])
  })

  it('does not flag a set that only equals the records', () => {
    expect(detectPrs(set(80, 8), [set(80, 8)])).toEqual([])
  })

  it('flags several records at once', () => {
    // 80 × 10: e1rm 106.7 > 96, volume 800 > 600, and 10 reps at ≥ 80 kg was
    // never done. Not max_weight, since 80 kg was already lifted: max_weight
    // and rep_max exclude each other (a new max weight has no earlier set at
    // that weight or heavier to beat on reps).
    expect(detectPrs(set(80, 10), [set(75, 8), set(80, 6)]))
      .toEqual(['e1rm', 'set_volume', 'rep_max'])
  })

  it('counts a heavier weight with fewer reps as progress', () => {
    // 80 × 8 then 85 × 6: heavier, and e1rm 102 > 101.3. Volume 510 < 640
    // and no earlier set at ≥ 85 kg, so neither volume nor rep_max.
    expect(detectPrs(set(85, 6), [set(80, 8)])).toEqual(['max_weight', 'e1rm'])
  })

  it('flags a rep max against sets at the same weight or heavier', () => {
    // 9 reps at 80 kg beats the 8 at 80 kg and the 6 at 85 kg.
    expect(detectPrs(set(80, 9), [set(80, 8), set(85, 6)])).toContain('rep_max')
  })

  it('ignores lighter sets for the rep max', () => {
    // 12 reps at 60 kg says nothing about what is possible at 80 kg.
    expect(detectPrs(set(80, 7), [set(80, 8), set(60, 12)])).not.toContain('rep_max')
  })

  it('never flags a drop set', () => {
    expect(detectPrs(set(120, 20, 'drop'), [set(80, 8)])).toEqual([])
  })

  it('never flags a warm-up set', () => {
    expect(detectPrs(set(120, 20, 'warmup'), [set(80, 8)])).toEqual([])
  })

  it('ignores warm-up and drop sets in the history', () => {
    // Only the 80 × 8 work set counts: the 100 kg warm-up (a typo, say) and
    // the 70 × 15 drop set must not hide the PR.
    const history = [set(100, 1, 'warmup'), set(80, 8), set(70, 15, 'drop')]
    expect(detectPrs(set(85, 8), history)).toEqual(['max_weight', 'e1rm', 'set_volume'])
  })

  it('treats a history of only warm-ups as empty', () => {
    expect(detectPrs(set(100, 5), [set(60, 10, 'warmup')])).toEqual([])
  })

  it('gives no e1rm record above 12 reps', () => {
    // 80 × 15 beats 80 × 5 on volume and reps, but has no 1RM estimate.
    expect(detectPrs(set(80, 15), [set(80, 5)])).not.toContain('e1rm')
  })

  it('only checks the rep max for bodyweight sets', () => {
    expect(detectPrs(set(0, 12), [set(0, 10)])).toEqual(['rep_max'])
  })

  it('does not flag the first weighted set after bodyweight ones', () => {
    // First pull-up with a 10 kg belt: it beats "0 kg" but there is no
    // previous weighted record to compare with, like a first set.
    expect(detectPrs(set(10, 5), [set(0, 12)])).toEqual([])
  })
})
