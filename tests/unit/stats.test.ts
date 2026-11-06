/**
 * Unit tests of the statistics helpers (shared/utils/stats.ts).
 */
import { describe, expect, it } from 'vitest'
import {
  exerciseRecords,
  exerciseSessions,
  recentPrs,
  weekStreak,
  type StatSet,
} from '../../shared/utils/stats'

/**
 * Shorthand for a set of an exercise: `set(1, '2026-10-01', 80, 8)` is a work
 * set of 80 kg × 8 in session 1, started on 1 October.
 */
function set(workoutId: number, day: string, weightKg: number, reps: number, type: StatSet['type'] = 'normal'): StatSet {
  return { workoutId, startedAt: `${day}T18:00:00.000Z`, weightKg, reps, type }
}

describe('exerciseRecords', () => {
  it('has no records without sets', () => {
    expect(exerciseRecords([])).toEqual({ maxWeight: null, e1rm: null, setVolume: null, repMaxes: [] })
  })

  it('keeps the best of each kind, dated by the first time it was reached', () => {
    const records = exerciseRecords([
      set(1, '2026-10-01', 80, 8),
      set(2, '2026-10-05', 90, 3),
      set(3, '2026-10-09', 90, 3), // equals the max weight: keeps the first date
      set(3, '2026-10-09', 85, 8),
    ])
    expect(records.maxWeight).toEqual({ weightKg: 90, reps: 3, startedAt: '2026-10-05T18:00:00.000Z' })
    // 85 × (1 + 8/30) = 107.7 beats 90 × 1.1 = 99 and 80 × 1.27 = 101.3
    expect(records.e1rm).toEqual({ value: 107.7, weightKg: 85, reps: 8, startedAt: '2026-10-09T18:00:00.000Z' })
    expect(records.setVolume).toEqual({ value: 680, weightKg: 85, reps: 8, startedAt: '2026-10-09T18:00:00.000Z' })
  })

  it('ignores warm-ups and drop sets', () => {
    const records = exerciseRecords([
      set(1, '2026-10-01', 60, 10),
      set(1, '2026-10-01', 100, 5, 'warmup'),
      set(1, '2026-10-01', 40, 30, 'drop'),
    ])
    expect(records.maxWeight?.weightKg).toBe(60)
    expect(records.repMaxes).toEqual([{ weightKg: 60, reps: 10, startedAt: '2026-10-01T18:00:00.000Z' }])
  })

  it('lists the rep max of each weight, heaviest first, without dominated ones', () => {
    const records = exerciseRecords([
      set(1, '2026-10-01', 100, 3),
      set(1, '2026-10-01', 80, 8),
      set(2, '2026-10-05', 80, 10),
      // 70 × 9 is dominated: 10 reps were done at the heavier 80 kg.
      set(2, '2026-10-05', 70, 9),
      set(2, '2026-10-05', 60, 15),
    ])
    expect(records.repMaxes.map(r => [r.weightKg, r.reps])).toEqual([[100, 3], [80, 10], [60, 15]])
  })

  it('gives bodyweight exercises only rep maxes', () => {
    const records = exerciseRecords([set(1, '2026-10-01', 0, 12), set(2, '2026-10-05', 0, 15)])
    expect(records.maxWeight).toBeNull()
    expect(records.e1rm).toBeNull()
    expect(records.setVolume).toBeNull()
    expect(records.repMaxes.map(r => [r.weightKg, r.reps])).toEqual([[0, 15]])
  })
})

describe('exerciseSessions', () => {
  it('groups the sets by session, in order, with the best e1RM and the volume', () => {
    const sessions = exerciseSessions([
      set(1, '2026-10-01', 40, 10, 'warmup'),
      set(1, '2026-10-01', 80, 8),
      set(1, '2026-10-01', 80, 6),
      set(2, '2026-10-05', 0, 12),
    ])
    expect(sessions).toHaveLength(2)
    expect(sessions[0]).toMatchObject({ workoutId: 1, bestE1rm: 101.3, volumeKg: 1120 })
    expect(sessions[0]!.sets).toHaveLength(3)
    // Bodyweight only: no estimate, no volume.
    expect(sessions[1]).toMatchObject({ workoutId: 2, bestE1rm: null, volumeKg: 0 })
  })

  it('counts drop sets in the volume but not in the e1RM', () => {
    const [session] = exerciseSessions([set(1, '2026-10-01', 60, 5), set(1, '2026-10-01', 100, 5, 'drop')])
    expect(session!.volumeKg).toBe(800)
    expect(session!.bestE1rm).toBe(70)
  })
})

describe('recentPrs', () => {
  it('lists the record sets done since the given date, newest first', () => {
    const sets = [
      { ...set(1, '2026-09-01', 80, 8), exerciseId: 1 },
      { ...set(2, '2026-09-20', 85, 8), exerciseId: 1 }, // a PR, but too old
      { ...set(3, '2026-10-10', 90, 8), exerciseId: 1 },
      { ...set(3, '2026-10-10', 50, 5), exerciseId: 1 }, // not a PR
      { ...set(4, '2026-10-12', 20, 10), exerciseId: 2 }, // first set of exercise 2: not a PR
      { ...set(5, '2026-10-15', 22.5, 10), exerciseId: 2 },
    ]
    const prs = recentPrs(sets, '2026-10-01T00:00:00.000Z')
    expect(prs.map(p => [p.exerciseId, p.weightKg, p.reps])).toEqual([[2, 22.5, 10], [1, 90, 8]])
    expect(prs[1]!.types).toEqual(['max_weight', 'e1rm', 'set_volume'])
  })
})

describe('weekStreak', () => {
  // 2026-11-04 is a Wednesday; its week starts on Monday 2026-11-02.
  const today = '2026-11-04'

  it('is 0 without sessions', () => {
    expect(weekStreak([], today)).toBe(0)
  })

  it('counts the weeks in a row with at least one session, this week included', () => {
    expect(weekStreak(['2026-11-02', '2026-10-28', '2026-10-20', '2026-10-21'], today)).toBe(3)
  })

  it('stays alive when this week has no session yet', () => {
    expect(weekStreak(['2026-10-28', '2026-10-20'], today)).toBe(2)
  })

  it('breaks on a week without sessions', () => {
    expect(weekStreak(['2026-11-03', '2026-10-20'], today)).toBe(1)
  })

  it('is 0 when the last session is older than last week', () => {
    expect(weekStreak(['2026-10-20'], today)).toBe(0)
  })

  it('handles weeks across a year change', () => {
    expect(weekStreak(['2027-01-04', '2026-12-31', '2026-12-22'], '2027-01-05')).toBe(3)
  })
})
