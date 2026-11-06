/**
 * Unit tests of the program rotation (nextProgramDayId in shared/utils/programs.ts).
 */
import { describe, expect, it } from 'vitest'
import { nextProgramDayId } from '../../shared/utils/programs'

// Push (position 0) -> Pull (1) -> Legs (2), given out of order on purpose:
// the rotation must follow `position`, not the order of the array.
const days = [
  { id: 30, position: 2 },
  { id: 10, position: 0 },
  { id: 20, position: 1 },
]

describe('nextProgramDayId', () => {
  it('suggests the first day when no day was ever done', () => {
    expect(nextProgramDayId(days, null)).toBe(10)
  })

  it('suggests the day after the last one done', () => {
    expect(nextProgramDayId(days, 10)).toBe(20)
    expect(nextProgramDayId(days, 20)).toBe(30)
  })

  it('goes back to the first day after the last one', () => {
    expect(nextProgramDayId(days, 30)).toBe(10)
  })

  it('suggests the first day when the last day done is not in the program', () => {
    // e.g. the day was deleted since, or it belongs to another program.
    expect(nextProgramDayId(days, 99)).toBe(10)
  })

  it('suggests nothing for a program without days', () => {
    expect(nextProgramDayId([], null)).toBeNull()
    expect(nextProgramDayId([], 10)).toBeNull()
  })

  it('keeps suggesting the only day of a one-day program', () => {
    expect(nextProgramDayId([{ id: 10, position: 0 }], 10)).toBe(10)
  })
})
