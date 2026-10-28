/**
 * Unit tests of the 1RM estimate (shared/utils/oneRepMax.ts).
 */
import { describe, expect, it } from 'vitest'
import { estimateOneRepMax } from '../../shared/utils/oneRepMax'

describe('estimateOneRepMax', () => {
  it('returns the weight itself for a single', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100)
  })

  it('applies the Epley formula', () => {
    // 80 × (1 + 8/30) = 101.333…
    expect(estimateOneRepMax(80, 8)).toBe(101.3)
    // 100 × (1 + 5/30) = 116.666…
    expect(estimateOneRepMax(100, 5)).toBe(116.7)
  })

  it('still estimates at the 12-rep limit', () => {
    expect(estimateOneRepMax(60, 12)).toBe(84)
  })

  it('gives no estimate above 12 reps', () => {
    expect(estimateOneRepMax(60, 13)).toBeNull()
  })

  it('gives no estimate without reps', () => {
    expect(estimateOneRepMax(60, 0)).toBeNull()
  })

  it('gives no estimate for a bodyweight set', () => {
    expect(estimateOneRepMax(0, 10)).toBeNull()
  })
})
